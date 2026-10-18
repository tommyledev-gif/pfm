package service

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
	"go.uber.org/zap"

	"github.com/example/pfm/backend/internal/common"
	"github.com/example/pfm/backend/internal/dto"
	"github.com/example/pfm/backend/internal/model"
)

// sourceKindReceipt / sourceKindHandwritten are the AI's image kinds that
// change a rule (spec BR-15, decision 8).
const (
	sourceKindReceipt     = "receipt"
	sourceKindHandwritten = "handwritten"
)

// ChatImageService owns the image-proposal business rules
// (specs/ai-chat-image-capture plan §3.4). Read-only: nothing is written, the
// image lives only in this request's memory and is never logged.
type ChatImageService struct {
	walletRepo   WalletRepo
	categoryRepo CategoryRepo
	txRepo       TransactionRepo
	aiImage      AIImageClient
	logger       *zap.Logger
	now          func() time.Time
}

// ImageProposalInput is the handler's already shape-checked upload.
type ImageProposalInput struct {
	Image    []byte
	MIMEType string
	Caption  *string
}

func NewChatImageService(walletRepo WalletRepo, categoryRepo CategoryRepo, txRepo TransactionRepo, aiImage AIImageClient, logger *zap.Logger) *ChatImageService {
	return &ChatImageService{walletRepo: walletRepo, categoryRepo: categoryRepo, txRepo: txRepo, aiImage: aiImage, logger: logger, now: time.Now}
}

// ProposeFromImage implements POST /transactions/image-proposals. Never
// writes a Transaction — every action still needs its own confirm (BR-01).
func (s *ChatImageService) ProposeFromImage(ctx context.Context, userID uuid.UUID, in ImageProposalInput) (*dto.ChatImageResponse, error) {
	wallets, err := s.walletRepo.ListWalletsByUser(ctx, userID)
	if err != nil {
		return nil, fmt.Errorf("service.ProposeFromImage: %w", err)
	}
	if len(wallets) == 0 {
		// No AI call: nothing could be confirmed anyway (S-AIIMG-13).
		return ambiguousImageReply(msgImageNoWallet, 0, false), nil
	}
	categories, err := s.categoryRepo.ListCategoriesForUser(ctx, userID, nil)
	if err != nil {
		return nil, fmt.Errorf("service.ProposeFromImage: %w", err)
	}

	now := s.now().UTC()
	reading, err := s.aiImage.ExtractImage(ctx, AIExtractImageRequest{
		Image: in.Image, MIMEType: in.MIMEType, Caption: in.Caption,
		Wallets: toAIWalletContexts(wallets), Categories: toAICategoryContexts(categories),
		Now: now, MaxItems: common.AIImageMaxProposals, ReadLines: common.AIImageReadReceiptLines,
	})
	if busy, ok := isAIImageBusy(err); ok {
		s.logger.Warn("image reading busy", zap.Intp("retry_after_seconds", busy.RetryAfterSeconds))
		return nil, common.NewAIImageBusyError(busy.RetryAfterSeconds)
	}
	if err != nil {
		s.logger.Warn("image reading unavailable", zap.String("error_type", fmt.Sprintf("%T", err)))
		return nil, common.ErrAIServiceUnavailable
	}

	r := resolveImageReading(wallets, categories, reading, now)
	if len(r.actions) == 0 {
		message := msgImageNothingRead
		if r.sawWalletDrop {
			message = msgImageWhichWallet
		}
		return ambiguousImageReply(message, r.skipped, r.truncated), nil
	}
	duplicates := s.attachPossibleDuplicates(ctx, userID, r.actions)

	s.logger.Info("image proposals built",
		zap.String("source_kind", reading.SourceKind), zap.Int("actions_count", len(r.actions)),
		zap.Int("skipped_count", r.skipped), zap.Int("walletless_count", r.walletless),
		zap.Int("duplicate_count", duplicates), zap.Int("review_line_count", r.reviewLines),
		zap.Bool("truncated", r.truncated))

	return &dto.ChatImageResponse{
		Message:      renderImageLeadIn(r.actions, r.skipped, r.truncated, r.linesTooMany),
		Intent:       string(model.ChatIntentCreateTransaction),
		Actions:      r.actions,
		Truncated:    r.truncated,
		SkippedCount: r.skipped,
	}, nil
}

// imageResolution is resolveImageReading's result.
type imageResolution struct {
	actions       []dto.ChatActionResponse
	skipped       int
	walletless    int
	reviewLines   int
	linesTooMany  int
	truncated     bool
	sawWalletDrop bool
}

// resolveImageReading applies the typed flow's resolution (ownership, type,
// VND Wallet, amount bound) one entry at a time, then the image-only rules:
// confidence caps (BR-05, BR-09, BR-15, BR-16, decision 8) and receipt lines.
func resolveImageReading(wallets []*model.Wallet, categories []*model.Category, reading *AIExtractImageResponse, now time.Time) imageResolution {
	r := imageResolution{truncated: reading.Truncated, skipped: reading.UnreadCount}
	entries := reading.Transactions
	if len(entries) > common.AIImageMaxProposals {
		entries, r.truncated = entries[:common.AIImageMaxProposals], true
	}
	readLines := reading.SourceKind == sourceKindReceipt && common.AIImageReadReceiptLines
	gateHandwriting := reading.SourceKind == sourceKindHandwritten && common.AIImageFlagHandwritten

	for _, p := range entries {
		base := AIProposedTransaction{
			AmountVND: p.AmountVND, TxType: p.TxType, CategoryID: p.CategoryID, WalletID: p.WalletID,
			Note: truncateNote(p.Note), OccurredAt: p.OccurredAt, Confidence: p.Confidence,
		}
		resolved, _, walletDrop := resolveActions(wallets, categories, []AIProposedTransaction{base})
		if len(resolved) == 0 {
			r.skipped++
			r.sawWalletDrop = r.sawWalletDrop || walletDrop
			continue
		}
		action := resolved[0]
		uncertain := gateHandwriting || isUncertainDate(p.OccurredAt, action.Payload.OccurredAt, now) ||
			(reading.SourceKind == sourceKindReceipt && !p.TotalVisible)

		if readLines {
			lines, outcome := resolveImageLines(action.Payload.Amount, p.Items, p.Adjustments)
			switch outcome {
			case linesAttached:
				action.Payload.Items, action.Payload.Adjustments = lines.items, lines.adjustments
				if lines.hasReviewMarks() {
					review := lines.review
					action.ReviewLines = &review
					r.reviewLines += len(review.Items) + len(review.Adjustments)
				}
				uncertain = uncertain || lines.hasReviewMarks() || !lines.reconciles
			case linesTooMany:
				r.linesTooMany++
			}
		}
		if uncertain && action.Confidence > common.AIImageReviewConfidence {
			action.Confidence = common.AIImageReviewConfidence
		}
		if action.Payload.WalletID == nil {
			r.walletless++
		}
		r.actions = append(r.actions, action)
	}
	return r
}

// isUncertainDate: no date visible (today was used) or a date in the future
// (spec BR-05).
func isUncertainDate(raw string, resolved, now time.Time) bool {
	if _, err := parseFlexibleTimestamp(raw); err != nil {
		return true
	}
	return resolved.After(now.Add(common.AIImageFutureDateTolerance))
}

func truncateNote(note *string) *string {
	if note == nil {
		return nil
	}
	cut := truncateRunes(*note, common.TransactionNoteMaxLength)
	return &cut
}

func ambiguousImageReply(message string, skipped int, truncated bool) *dto.ChatImageResponse {
	return &dto.ChatImageResponse{
		Message: message, Intent: string(model.ChatIntentAmbiguous), Actions: []dto.ChatActionResponse{},
		Truncated: truncated, SkippedCount: skipped,
	}
}
