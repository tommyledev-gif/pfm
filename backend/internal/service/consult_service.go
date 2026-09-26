package service

import (
	"context"
	"encoding/json"
	"fmt"
	"sort"
	"strings"
	"time"

	"github.com/google/uuid"
	"go.uber.org/zap"

	"github.com/example/pfm/backend/internal/common"
	"github.com/example/pfm/backend/internal/dto"
	"github.com/example/pfm/backend/internal/model"
)

// ConsultService answers free-text spending questions
// (specs/ai-chat-query-spending/spec.md US-03/US-05/US-07). The AI Service
// only turns text into a structured question; every figure still comes from
// AnalyticsService, and no model text ever reaches the User (plan.md BR-11).
// Anything short of a clean, complete interpretation becomes a reply with
// chips — never a guess (BR-14…BR-16) — and any interpreter failure becomes
// a degraded reply, never an error screen (BR-18).
type ConsultService struct {
	analytics     *AnalyticsService
	analyticsRepo AnalyticsRepo
	wallets       WalletRepo
	categories    CategoryRepo
	client        AIConsultClient
	tokens        *ConsultTokenBudget
	logs          IntentParseLogRepo
	cycles        *CycleResolver
	logger        *zap.Logger
}

func NewConsultService(analytics *AnalyticsService, analyticsRepo AnalyticsRepo, wallets WalletRepo, categories CategoryRepo, client AIConsultClient, tokens *ConsultTokenBudget, logs IntentParseLogRepo, cycles *CycleResolver, logger *zap.Logger) *ConsultService {
	return &ConsultService{
		analytics: analytics, analyticsRepo: analyticsRepo, wallets: wallets, categories: categories,
		client: client, tokens: tokens, logs: logs, cycles: cycles, logger: logger,
	}
}

// consultOutcome is what one question produced, for the reply and the log.
type consultOutcome struct {
	reply   *dto.ConsultResponse
	parse   *AIConsultParse
	outcome string
}

func (s *ConsultService) Consult(ctx context.Context, userID uuid.UUID, req dto.ConsultRequest) (*dto.ConsultResponse, error) {
	started := time.Now()
	currency, err := s.analytics.resolveCurrency(ctx, userID, model.AnalyticsQuery{}, nil)
	if err != nil {
		return nil, fmt.Errorf("service.ConsultService.Consult: %w", err)
	}

	result, err := s.consult(ctx, userID, req, currency)
	if err != nil {
		return nil, err
	}
	s.logParse(ctx, userID, req.Message, result, time.Since(started))
	return result.reply, nil
}

func (s *ConsultService) consult(ctx context.Context, userID uuid.UUID, req dto.ConsultRequest, currency string) (consultOutcome, error) {
	if !s.tokens.Allow() {
		return consultOutcome{reply: degradedReply(currency), outcome: model.IntentOutcomeDegraded}, nil
	}
	aiReq, allCategories, err := s.buildContext(ctx, userID, req.Message)
	if err != nil {
		return consultOutcome{}, err
	}
	parse, err := s.client.Parse(ctx, aiReq)
	if err != nil {
		s.logger.Warn("consult: interpretation unavailable", zap.String("user_id", userID.String()), zap.Error(err))
		return consultOutcome{reply: degradedReply(currency), outcome: model.IntentOutcomeDegraded}, nil
	}
	s.tokens.Record(parse.PromptTokens + parse.CompletionTokens)
	return s.route(ctx, userID, parse, allCategories, currency)
}

// buildContext sends the interpreter every visible Category when there are
// few, otherwise the most used ones over recent cycles topped up to the
// cap (spec.md US-03 EC). The full list is kept for the low-confidence
// picker, which may offer a Category the interpreter never saw.
func (s *ConsultService) buildContext(ctx context.Context, userID uuid.UUID, message string) (AIConsultRequest, []*model.Category, error) {
	all, err := s.categories.ListCategoriesForUser(ctx, userID, nil)
	if err != nil {
		return AIConsultRequest{}, nil, fmt.Errorf("service.ConsultService.buildContext: %w", err)
	}
	wallets, err := s.wallets.ListWalletsByUser(ctx, userID)
	if err != nil {
		return AIConsultRequest{}, nil, fmt.Errorf("service.ConsultService.buildContext: %w", err)
	}

	chosen := all
	if len(all) > common.AnalyticsCategoryContextMax {
		since, err := s.cycles.Window(ctx, userID, -(common.AnalyticsCategoryContextCycles - 1))
		if err != nil {
			return AIConsultRequest{}, nil, fmt.Errorf("service.ConsultService.buildContext: %w", err)
		}
		usage, err := s.analyticsRepo.ListTopCategoriesRecent(ctx, userID, since.Start, common.AnalyticsCategoryContextMax)
		if err != nil {
			return AIConsultRequest{}, nil, fmt.Errorf("service.ConsultService.buildContext: %w", err)
		}
		chosen = topUpCategories(all, usage, common.AnalyticsCategoryContextMax)
	}

	req := AIConsultRequest{
		Message:  message,
		Today:    s.cycles.Now().In(s.cycles.Location()).Format(common.DateOnlyLayout),
		Timezone: common.AppTimezone,
	}
	for _, c := range chosen {
		req.Categories = append(req.Categories, AICategoryContext{ID: c.ID, Name: c.Name, Type: string(c.Type)})
	}
	for _, w := range wallets {
		req.Wallets = append(req.Wallets, AIWalletContext{ID: w.ID, Name: w.Name, IsDefault: w.IsDefault, Currency: w.Currency})
	}
	return req, all, nil
}

// topUpCategories keeps the most used Categories first, then fills the
// remaining slots alphabetically so a rarely used one can still be named.
func topUpCategories(all []*model.Category, usage []model.CategoryUsage, max int) []*model.Category {
	byID := make(map[uuid.UUID]*model.Category, len(all))
	for _, c := range all {
		byID[c.ID] = c
	}
	chosen := make([]*model.Category, 0, max)
	seen := map[uuid.UUID]bool{}
	for _, u := range usage {
		if c, ok := byID[u.ID]; ok && len(chosen) < max {
			chosen = append(chosen, c)
			seen[c.ID] = true
		}
	}
	rest := make([]*model.Category, 0, len(all))
	for _, c := range all {
		if !seen[c.ID] {
			rest = append(rest, c)
		}
	}
	sort.Slice(rest, func(i, j int) bool { return rest[i].Name < rest[j].Name })
	for _, c := range rest {
		if len(chosen) == max {
			break
		}
		chosen = append(chosen, c)
	}
	return chosen
}

// logParse appends the question log row. A failure here never fails the
// answer (spec.md US-07 EC), and the question text is never written to the
// application log (S-AIQ-48).
func (s *ConsultService) logParse(ctx context.Context, userID uuid.UUID, raw string, r consultOutcome, took time.Duration) {
	entry := model.IntentParseLog{
		UserID: userID, RawText: raw, NormalizedText: strings.ToLower(strings.TrimSpace(raw)),
		ParsedIntent: []byte("{}"), Method: model.IntentMethodLLM, Kind: model.IntentKindUninterpreted,
		Outcome: r.outcome, LatencyMs: int32(took.Milliseconds()),
	}
	if p := r.parse; p != nil {
		entry.Kind = p.Kind
		if p.NormalizedText != "" {
			entry.NormalizedText = p.NormalizedText
		}
		if b, err := json.Marshal(p); err == nil {
			entry.ParsedIntent = b
		}
		if p.CategoryConfidence != nil {
			c := float32(*p.CategoryConfidence)
			entry.Confidence = &c
		}
		in, out, cached := int32(p.PromptTokens), int32(p.CompletionTokens), int32(p.CachedTokens)
		entry.TokenIn, entry.TokenOut, entry.CachedTokens = &in, &out, &cached
	}
	if err := s.logs.Insert(ctx, entry); err != nil {
		s.logger.Error("consult: failed to write question log", zap.String("user_id", userID.String()), zap.Error(err))
	}
}
