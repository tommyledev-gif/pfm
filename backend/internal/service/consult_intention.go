package service

import (
	"context"
	"fmt"

	"github.com/google/uuid"

	"github.com/example/pfm/backend/internal/common"
	"github.com/example/pfm/backend/internal/dto"
	"github.com/example/pfm/backend/internal/model"
)

// WithIntentions lets the consult reply understand "I plan to buy…" sentences
// (specs/ai-chat-spending-intentions US-01). Without it such a sentence reads
// as one the System cannot answer. A method rather than a constructor argument
// so the many callers of NewConsultService stay as they are.
func (s *ConsultService) WithIntentions(intentions *SpendingIntentionService) *ConsultService {
	s.intentions = intentions
	return s
}

// routeIntention turns the interpreter's reading of a sentence into proposals
// the User can keep, edit or discard — one per item the sentence named, all
// weighed together with what is already kept. Nothing is kept here, and no
// figure on a proposal comes from the model: it supplies only what the User
// said (spec.md BR-01).
func (s *ConsultService) routeIntention(ctx context.Context, userID uuid.UUID, p *AIConsultParse, currency string, out consultOutcome) (consultOutcome, error) {
	unsupported := func() (consultOutcome, error) {
		out.reply = &dto.ConsultResponse{Kind: string(model.ConsultKindUnsupported), Message: msgUnsupported, Chips: starterChips(currency)[:2]}
		return out, nil
	}
	if s.intentions == nil || len(p.Intentions) == 0 {
		return unsupported()
	}
	reads := p.Intentions
	truncated := p.IntentionsTruncated
	if len(reads) > common.IntentionMaxPerMessage {
		reads, truncated = reads[:common.IntentionMaxPerMessage], true
	}
	requests := make([]dto.SpendingIntentionRequest, 0, len(reads))
	unreadable := 0
	for _, read := range reads {
		if request, ok := intentionRequest(read, currency); ok {
			requests = append(requests, request)
		} else {
			unreadable++
		}
	}
	proposals, err := s.intentions.BuildDrafts(ctx, userID, requests)
	if err != nil {
		return consultOutcome{}, fmt.Errorf("service.ConsultService.routeIntention: %w", err)
	}
	if proposals == nil {
		return unsupported()
	}
	proposals.Truncated = truncated
	proposals.Skipped += unreadable
	out.outcome = model.IntentOutcomeAnswered
	out.reply = &dto.ConsultResponse{
		Kind: string(model.ConsultKindIntention), Intentions: proposals, Chips: []dto.AnalyticsFollowUp{},
	}
	return out, nil
}

// intentionRequest maps one reading onto the editable set a save takes. The
// amounts arrive in đồng and become xu here, once; one above the supported
// maximum makes that item unusable (spec.md EC-03).
func intentionRequest(read AIIntentionParse, currency string) (dto.SpendingIntentionRequest, bool) {
	total, ok := vndToXu(read.AmountVND)
	if !ok {
		return dto.SpendingIntentionRequest{}, false
	}
	monthly, ok := vndToXu(read.MonthlyVND)
	if !ok {
		return dto.SpendingIntentionRequest{}, false
	}
	req := dto.SpendingIntentionRequest{
		Title: read.Title, Kind: read.Kind, Currency: currency, TotalAmount: total, MonthlyAmount: monthly,
		InstallmentMonths: read.Months, TargetMonth: read.Month,
	}
	// A match below medium confidence is dropped (spec.md BR-03).
	if read.CategoryID != nil && read.CategoryConfidence != nil && *read.CategoryConfidence >= common.AnalyticsCategoryConfidenceMedium {
		req.CategoryID = read.CategoryID
	}
	return req, true
}

// vndToXu converts an amount in đồng to xu; nil stays nil. Not ok when it is
// not above zero or would pass the cap.
func vndToXu(vnd *int64) (*int64, bool) {
	if vnd == nil {
		return nil, true
	}
	if *vnd <= 0 || *vnd > common.IntentionAmountCapXu/common.VNDToCentsFactor {
		return nil, false
	}
	xu := *vnd * common.VNDToCentsFactor
	return &xu, true
}
