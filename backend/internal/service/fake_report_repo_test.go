package service

import (
	"context"
	"sync"

	"github.com/google/uuid"

	"github.com/example/pfm/backend/internal/model"
	"github.com/example/pfm/backend/internal/repository"
)

// fakeReportRepo is an in-memory stand-in for ReportRepo, used instead of a
// real Postgres per Go Test Conventions — same approach as
// fakeWalletRepo/fakeBudgetRepo. Unlike those, it does not re-derive
// aggregation from raw Transaction rows (that's the real SQL's job, verified
// against a real DB, not this fake) — it returns whatever a test has staged
// via seedTotals/seedByCategory, and records the last filter it was called
// with so a test can assert ReportService threaded wallet_id/category_id/
// type/from/to correctly.
type fakeReportRepo struct {
	mu         sync.Mutex
	totals     []model.ReportTypeAmount
	byCategory []model.ReportCategoryEntry
	lastFilter repository.ReportFilter
}

func newFakeReportRepo() *fakeReportRepo {
	return &fakeReportRepo{}
}

// seedTotals stages raw (type, currency, amount) rows — same shape the real
// SQL aggregate returns, pivoting into income/expense/net is ReportService's
// job (pivotReportTotals), not this fake's.
func (f *fakeReportRepo) seedTotals(totals ...model.ReportTypeAmount) {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.totals = totals
}

func (f *fakeReportRepo) seedByCategory(entries ...model.ReportCategoryEntry) {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.byCategory = entries
}

func (f *fakeReportRepo) SumTotals(_ context.Context, _ uuid.UUID, filter repository.ReportFilter) ([]model.ReportTypeAmount, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.lastFilter = filter
	return append([]model.ReportTypeAmount(nil), f.totals...), nil
}

func (f *fakeReportRepo) SumByCategory(_ context.Context, _ uuid.UUID, filter repository.ReportFilter) ([]model.ReportCategoryEntry, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.lastFilter = filter
	return append([]model.ReportCategoryEntry(nil), f.byCategory...), nil
}
