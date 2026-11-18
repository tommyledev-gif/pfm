package service

import (
	"context"
	"fmt"

	"github.com/google/uuid"

	"github.com/example/pfm/backend/internal/dto"
	"github.com/example/pfm/backend/internal/model"
)

// respondOne builds the response of one kept intention, weighed against every
// intention the User keeps (this one included, which the assessment skips).
func (s *SpendingIntentionService) respondOne(ctx context.Context, userID uuid.UUID, kept *model.SpendingIntention) (*dto.SpendingIntentionResponse, error) {
	all, err := s.repo.List(ctx, userID)
	if err != nil {
		return nil, fmt.Errorf("service.SpendingIntentionService.respondOne: %w", err)
	}
	responses, _, err := s.respondMany(ctx, userID, []*model.SpendingIntention{kept}, all)
	if err != nil {
		return nil, err
	}
	return &responses[0], nil
}

// respondMany builds a response per subject, and the portfolio of everything
// in `plans`, with one read of everything the figures need.
func (s *SpendingIntentionService) respondMany(ctx context.Context, userID uuid.UUID, subjects, plans []*model.SpendingIntention) ([]dto.SpendingIntentionResponse, []dto.IntentionPortfolio, error) {
	currencies := make([]string, 0, len(plans))
	ids := make([]uuid.UUID, 0, len(subjects))
	for _, i := range plans {
		currencies = append(currencies, i.Currency)
	}
	for _, i := range subjects {
		if i.CategoryID != nil {
			ids = append(ids, *i.CategoryID)
		}
	}
	assessor, err := s.newIntentionAssessor(ctx, userID, currencies, plans)
	if err != nil {
		return nil, nil, err
	}
	names, err := s.categoryNames(ctx, ids)
	if err != nil {
		return nil, nil, err
	}
	out := make([]dto.SpendingIntentionResponse, 0, len(subjects))
	for _, i := range subjects {
		out = append(out, intentionResponse(i, names, assessor.assess(i)))
	}
	return out, assessor.portfolios(), nil
}

// categoryNames resolves the names of the linked Categories in one query; a
// Category deleted since is simply missing (spec.md EC-14).
func (s *SpendingIntentionService) categoryNames(ctx context.Context, ids []uuid.UUID) (map[uuid.UUID]string, error) {
	names := map[uuid.UUID]string{}
	if len(ids) == 0 {
		return names, nil
	}
	found, err := s.categories.GetCategoriesByIDs(ctx, ids)
	if err != nil {
		return nil, fmt.Errorf("service.SpendingIntentionService.categoryNames: %w", err)
	}
	for _, c := range found {
		names[c.ID] = c.Name
	}
	return names, nil
}

func intentionResponse(i *model.SpendingIntention, names map[uuid.UUID]string, assessment dto.IntentionAssessment) dto.SpendingIntentionResponse {
	res := dto.SpendingIntentionResponse{
		Title: i.Title, Kind: i.Kind, Currency: i.Currency, TotalAmount: i.TotalAmount, MonthlyAmount: i.MonthlyAmount,
		InstallmentMonths: i.InstallmentMonths, TargetMonth: monthLabel(i.TargetMonth), Note: i.Note, Assessment: assessment,
	}
	if i.ID != uuid.Nil {
		id, created, updated := i.ID, i.CreatedAt, i.UpdatedAt
		res.ID, res.CreatedAt, res.UpdatedAt = &id, &created, &updated
	}
	if i.CategoryID != nil {
		if name, ok := names[*i.CategoryID]; ok {
			res.CategoryID, res.CategoryName = i.CategoryID, name
		}
	}
	return res
}

// BuildDrafts turns what the interpreter read from a sentence into proposals
// with their figures, keeping nothing (spec.md US-01). Every draft is weighed
// against the intentions already kept and against the other drafts of the same
// sentence, and the portfolio covers all of them together.
//
// It is as forgiving as a card can be: a month in the past becomes the current
// one, an instalment without a month count is shown incomplete. An item that
// cannot be read at all (no name, an absurd amount) is skipped and counted.
func (s *SpendingIntentionService) BuildDrafts(ctx context.Context, userID uuid.UUID, inputs []dto.SpendingIntentionRequest) (*dto.ConsultIntentions, error) {
	current, err := s.currentMonth(ctx, userID)
	if err != nil {
		return nil, err
	}
	var drafts []*model.SpendingIntention
	var moved []bool
	skipped := 0
	for _, in := range inputs {
		currency, _, err := s.resolveCurrency(ctx, userID, in.Currency)
		if err != nil {
			return nil, err
		}
		normalized, problems := intentionRules{currency: currency, currentMonth: current, movePast: true, lenient: true}.normalize(in)
		if len(problems) > 0 {
			skipped++
			continue
		}
		params := normalized.params
		if err := s.checkCategory(ctx, userID, params.CategoryID); err != nil {
			params.CategoryID = nil // a Category the card cannot use is left off, never fatal
		}
		drafts = append(drafts, &model.SpendingIntention{
			Title: params.Title, Kind: params.Kind, CategoryID: params.CategoryID, Currency: params.Currency,
			TotalAmount: params.TotalAmount, MonthlyAmount: params.MonthlyAmount, InstallmentMonths: params.InstallmentMonths,
			TargetMonth: params.TargetMonth, Note: params.Note,
		})
		moved = append(moved, normalized.monthMoved)
	}
	if len(drafts) == 0 {
		return nil, nil
	}
	kept, err := s.repo.List(ctx, userID)
	if err != nil {
		return nil, fmt.Errorf("service.SpendingIntentionService.BuildDrafts: %w", err)
	}
	plans := append(append([]*model.SpendingIntention{}, kept...), drafts...)
	responses, portfolios, err := s.respondMany(ctx, userID, drafts, plans)
	if err != nil {
		return nil, err
	}
	out := &dto.ConsultIntentions{Items: make([]dto.ConsultIntentionDraft, 0, len(responses)), Portfolios: portfolios, Skipped: skipped}
	for i, res := range responses {
		out.Items = append(out.Items, dto.ConsultIntentionDraft{Draft: res, MonthMoved: moved[i]})
	}
	return out, nil
}
