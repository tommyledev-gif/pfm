package service

import (
	"context"
	"errors"
	"sync"
	"time"

	"github.com/google/uuid"

	"github.com/example/pfm/backend/internal/model"
	"github.com/example/pfm/backend/internal/repository"
)

// scriptedReportRepo answers report queries per window, so a test can give
// the current and previous period different totals. Keyed by filter.From.
type scriptedReportRepo struct {
	mu         sync.Mutex
	totals     func(repository.ReportFilter) []model.ReportTypeAmount
	byCategory func(repository.ReportFilter) []model.ReportCategoryEntry
	filters    []repository.ReportFilter
}

func (r *scriptedReportRepo) SumTotals(_ context.Context, _ uuid.UUID, f repository.ReportFilter) ([]model.ReportTypeAmount, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.filters = append(r.filters, f)
	if r.totals == nil {
		return nil, nil
	}
	return r.totals(f), nil
}

func (r *scriptedReportRepo) SumByCategory(_ context.Context, _ uuid.UUID, f repository.ReportFilter) ([]model.ReportCategoryEntry, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.filters = append(r.filters, f)
	if r.byCategory == nil {
		return nil, nil
	}
	return r.byCategory(f), nil
}

// fakeAnalyticsRepo returns staged rows and records the filters it saw.
type fakeAnalyticsRepo struct {
	mu        sync.Mutex
	count     int64
	expenses  []model.AnalyticsExpense
	byWallet  []model.AnalyticsKeyedAmount
	byDay     []model.AnalyticsDayAmount
	topUsage  []model.CategoryUsage
	lastLimit int
	filters   []repository.AnalyticsFilter
}

func (f *fakeAnalyticsRepo) record(filter repository.AnalyticsFilter) {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.filters = append(f.filters, filter)
}

func (f *fakeAnalyticsRepo) ListExpensesByAmount(_ context.Context, _ uuid.UUID, filter repository.AnalyticsFilter, limit int) ([]model.AnalyticsExpense, error) {
	f.record(filter)
	f.lastLimit = limit
	if limit < len(f.expenses) {
		return f.expenses[:limit], nil
	}
	return f.expenses, nil
}

func (f *fakeAnalyticsRepo) CountTransactions(_ context.Context, _ uuid.UUID, filter repository.AnalyticsFilter) (int64, error) {
	f.record(filter)
	return f.count, nil
}

func (f *fakeAnalyticsRepo) SumExpenseByWallet(_ context.Context, _ uuid.UUID, filter repository.AnalyticsFilter) ([]model.AnalyticsKeyedAmount, error) {
	f.record(filter)
	return f.byWallet, nil
}

func (f *fakeAnalyticsRepo) SumExpenseByLocalDay(_ context.Context, _ uuid.UUID, filter repository.AnalyticsFilter, _ string) ([]model.AnalyticsDayAmount, error) {
	f.record(filter)
	return append([]model.AnalyticsDayAmount(nil), f.byDay...), nil
}

func (f *fakeAnalyticsRepo) ListTopCategoriesRecent(_ context.Context, _ uuid.UUID, _ time.Time, _ int) ([]model.CategoryUsage, error) {
	return f.topUsage, nil
}

// fakeConsultClient returns a staged parse (or error) and counts calls.
type fakeConsultClient struct {
	parse   *AIConsultParse
	err     error
	calls   int
	lastReq AIConsultRequest
}

func (c *fakeConsultClient) Parse(_ context.Context, req AIConsultRequest) (*AIConsultParse, error) {
	c.calls++
	c.lastReq = req
	if c.err != nil {
		return nil, c.err
	}
	return c.parse, nil
}

// fakeIntentLogRepo keeps inserted rows; insertErr simulates a log outage.
type fakeIntentLogRepo struct {
	mu        sync.Mutex
	rows      []model.IntentParseLog
	insertErr error
	cutoffs   []time.Time
}

func (f *fakeIntentLogRepo) Insert(_ context.Context, entry model.IntentParseLog) error {
	f.mu.Lock()
	defer f.mu.Unlock()
	if f.insertErr != nil {
		return f.insertErr
	}
	f.rows = append(f.rows, entry)
	return nil
}

func (f *fakeIntentLogRepo) ClearRawTextBefore(_ context.Context, cutoff time.Time) (int64, error) {
	f.cutoffs = append(f.cutoffs, cutoff)
	return 0, nil
}

func (f *fakeIntentLogRepo) DeleteBefore(_ context.Context, cutoff time.Time) (int64, error) {
	f.cutoffs = append(f.cutoffs, cutoff)
	return 0, nil
}

var errFakeUnavailable = errors.New("fake: unavailable")
