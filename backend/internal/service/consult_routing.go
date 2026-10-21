package service

import (
	"context"
	"errors"

	"github.com/google/uuid"

	"github.com/example/pfm/backend/internal/common"
	"github.com/example/pfm/backend/internal/dto"
	"github.com/example/pfm/backend/internal/model"
)

// Reply copy for every non-answer outcome (Vietnamese product copy).
const (
	// Both end on "Thử:" — the client lists the reply's chips right
	// under it as tappable rows, so the sentence leads straight into them.
	msgDegraded     = "Lúc này chưa đọc được câu vừa gõ. Thử:"
	msgUnsupported  = "Chưa hiểu câu này. Thử:"
	msgPartial      = "Chưa hiểu hết câu hỏi nên chưa đưa số. Thử hỏi cụ thể hơn."
	msgNeedsContext = "Câu hỏi còn thiếu ý. Hỏi đủ, ví dụ \"tháng trước tiêu bao nhiêu\"."
	msgComingLater  = "Đánh giá và thử kịch bản sẽ có trong bản sau. Số liệu liên quan ở bên dưới."
	msgSwitchMode   = "Câu này giống một giao dịch cần ghi. Chuyển sang chế độ Ghi giao dịch."
	msgPickCategory = "Danh mục nào?"
	msgAnswered     = ""
)

// route turns an interpretation into a reply. Only a complete query with a
// confident enough Category match reaches AnalyticsService.
func (s *ConsultService) route(ctx context.Context, userID uuid.UUID, p *AIConsultParse, all []*model.Category, currency string) (consultOutcome, error) {
	out := consultOutcome{parse: p, outcome: model.IntentOutcomeUnsupport}
	if p.InvalidOutput {
		// The provider answered; the model's reading just did not fit. An
		// honest "cannot answer this", logged as an error so the question
		// log still counts it as an interpretation miss (plan.md BR-26).
		out.outcome = model.IntentOutcomeError
		out.reply = &dto.ConsultResponse{Kind: string(model.ConsultKindUnsupported), Message: msgUnsupported, Chips: starterChips(currency)[:2]}
		return out, nil
	}
	switch p.Kind {
	case model.ParseKindQuery:
	case model.ParseKindScenario:
		if p.GoalAmountVND != nil {
			return s.routeScenario(ctx, userID, p, currency, out)
		}
		out.reply = &dto.ConsultResponse{Kind: string(model.ConsultKindComingLater), Message: msgComingLater, Chips: comingLaterChips(p.Kind, currency)}
		return out, nil
	case model.ParseKindEvaluate:
		out.reply = &dto.ConsultResponse{Kind: string(model.ConsultKindComingLater), Message: msgComingLater, Chips: comingLaterChips(p.Kind, currency)}
		return out, nil
	case model.ParseKindNeedsContext:
		out.reply = &dto.ConsultResponse{Kind: string(model.ConsultKindNeedsContext), Message: msgNeedsContext, Chips: starterChips(currency)}
		return out, nil
	case model.ParseKindTransactionLike:
		out.reply = &dto.ConsultResponse{Kind: string(model.ConsultKindSwitchMode), Message: msgSwitchMode, Chips: []dto.AnalyticsFollowUp{}, SwitchToRecording: true}
		return out, nil
	default:
		out.reply = &dto.ConsultResponse{Kind: string(model.ConsultKindUnsupported), Message: msgUnsupported, Chips: starterChips(currency)[:2]}
		return out, nil
	}

	// A query the interpreter could only partly map is never answered from
	// the mapped part (spec.md S-AIQ-27).
	if p.Coverage != model.ParseCoverageFull {
		out.reply = &dto.ConsultResponse{Kind: string(model.ConsultKindUnsupported), Message: msgPartial, Chips: starterChips(currency)}
		return out, nil
	}

	today := s.cycles.Now().In(s.cycles.Location()).Format(common.DateOnlyLayout)
	if reply := consultDayGuard(p, today, currency); reply != nil {
		out.reply = reply
		return out, nil
	}
	if reply := consultAnomalyGuard(p, today, currency); reply != nil {
		out.reply = reply
		return out, nil
	}

	query := queryFromParse(p)
	if len(p.CategoryIDs) > 0 && confidence(p) < common.AnalyticsCategoryConfidenceMedium {
		pending := query
		pending.CategoryIDs = nil
		out.outcome = model.IntentOutcomeClarify
		out.reply = &dto.ConsultResponse{
			Kind: string(model.ConsultKindClarifyCategory), Message: msgPickCategory,
			CategoryChoices: categoryChoices(all, query.TxType), PendingQuery: &pending, Chips: []dto.AnalyticsFollowUp{},
		}
		return out, nil
	}

	answer, err := s.analytics.Answer(ctx, userID, query)
	if err != nil {
		// The User asked nothing invalid — an unanswerable combination is
		// the interpreter's mistake, so it reads as "cannot answer", not as
		// a validation error. Ownership failures still surface (BR-01).
		var appErr *common.AppError
		if errors.As(err, &appErr) && appErr.Code == common.ErrCodeInvalidInput {
			out.outcome = model.IntentOutcomeError
			out.reply = &dto.ConsultResponse{Kind: string(model.ConsultKindUnsupported), Message: msgPartial, Chips: starterChips(currency)}
			return out, nil
		}
		return consultOutcome{}, err
	}

	out.outcome = model.IntentOutcomeAnswered
	out.reply = &dto.ConsultResponse{Kind: string(model.ConsultKindAnswer), Message: msgAnswered, Answer: answer, Chips: answer.FollowUps}
	if len(p.CategoryIDs) > 0 && confidence(p) < common.AnalyticsCategoryConfidenceHigh {
		out.reply.BannerCategories = bannerCategories(all, p.CategoryIDs)
	}
	return out, nil
}

func confidence(p *AIConsultParse) float64 {
	if p.CategoryConfidence == nil {
		return 0
	}
	return *p.CategoryConfidence
}

// queryFromParse maps the interpretation onto the same request a chip
// sends; the threshold arrives in đồng and becomes xu here.
func queryFromParse(p *AIConsultParse) dto.AnalyticsQueryRequest {
	q := dto.AnalyticsQueryRequest{
		Metric: p.Metric, GroupBy: p.GroupBy, TxType: p.TxType, Period: p.Period,
		From: p.From, To: p.To, CategoryIDs: p.CategoryIDs, WalletID: p.WalletID, Limit: p.Limit,
	}
	if p.AmountMinVND != nil {
		xu := *p.AmountMinVND * common.VNDToCentsFactor
		q.AmountMin = &xu
	}
	return q
}

func categoryChoices(all []*model.Category, txType string) []dto.ConsultCategoryRef {
	if txType == "" {
		txType = string(model.TransactionTypeExpense)
	}
	out := make([]dto.ConsultCategoryRef, 0, len(all))
	for _, c := range all {
		if string(c.Type) == txType {
			out = append(out, dto.ConsultCategoryRef{ID: c.ID, Name: c.Name})
		}
	}
	return out
}

func bannerCategories(all []*model.Category, ids []uuid.UUID) []dto.ConsultCategoryRef {
	names := make(map[uuid.UUID]string, len(all))
	for _, c := range all {
		names[c.ID] = c.Name
	}
	out := make([]dto.ConsultCategoryRef, 0, len(ids))
	for _, id := range ids {
		out = append(out, dto.ConsultCategoryRef{ID: id, Name: names[id]})
	}
	return out
}

func degradedReply(currency string) *dto.ConsultResponse {
	return &dto.ConsultResponse{Kind: string(model.ConsultKindDegraded), Message: msgDegraded, Chips: starterChips(currency)}
}

// starterChips mirrors the client's starter row (spec.md OQ #3 proposal:
// Q1, Q2, Q9, Q10), so every fallback reply offers questions that work
// without any interpretation.
func starterChips(currency string) []dto.AnalyticsFollowUp {
	thisCycle := string(model.AnalyticsPeriodThisCycle)
	return []dto.AnalyticsFollowUp{
		{Label: "Tháng này tiêu bao nhiêu?", Query: dto.AnalyticsQueryRequest{Metric: string(model.AnalyticsMetricSum), Period: thisCycle, Currency: currency}},
		{Label: "Tiền đi đâu?", Query: dto.AnalyticsQueryRequest{Metric: string(model.AnalyticsMetricBreakdown), GroupBy: string(model.AnalyticsGroupByCategory), Period: thisCycle, Currency: currency}},
		{Label: "Còn bao nhiêu ngân sách?", Query: dto.AnalyticsQueryRequest{Metric: string(model.AnalyticsMetricBudgetStatus), Period: thisCycle, Currency: currency}},
		{Label: "Thu nhập tháng này", Query: dto.AnalyticsQueryRequest{Metric: string(model.AnalyticsMetricSum), TxType: string(model.TransactionTypeIncome), Period: thisCycle, Currency: currency}},
	}
}

// comingLaterChips offers the nearest supported question: an evaluation
// becomes this cycle's total, a what-if becomes where the money went.
func comingLaterChips(kind, currency string) []dto.AnalyticsFollowUp {
	chips := starterChips(currency)
	if kind == model.ParseKindScenario {
		return chips[1:2]
	}
	return chips[:1]
}
