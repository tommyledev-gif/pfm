package service

import (
	"testing"

	"github.com/example/pfm/backend/internal/model"
)

func anomalyParse(period, from, to string) *AIConsultParse {
	return &AIConsultParse{
		Kind: model.ParseKindQuery, Coverage: model.ParseCoverageFull, Metric: "anomaly",
		Period: period, From: from, To: to, Method: model.IntentMethodRegex,
	}
}

// "có j bất thường hnay" read by the phrase rules reaches the anomaly answer.
func TestConsult_AnomalyToday(t *testing.T) {
	f := newConsultFixture(t)
	f.analytics.txByType = map[string][]model.AnalyticsExpense{
		"expense": append(history(30, anomFood, "Ăn uống", flat(100_000)), tx(anomFood, "Ăn uống", 80_000, localAt(14, 8, 0))),
	}
	f.client.parse = anomalyParse("custom", "2026-10-14", "2026-10-14")

	reply := ask(t, f, "có j bất thường hnay")
	if reply.Kind != string(model.ConsultKindAnswer) || reply.Answer == nil || reply.Answer.Chart.Type != "anomaly" {
		t.Fatalf("expected an anomaly answer, got %+v", reply)
	}
	if len(f.logs.rows) != 1 || f.logs.rows[0].Outcome != model.IntentOutcomeAnswered || f.logs.rows[0].Method != model.IntentMethodRegex {
		t.Fatalf("expected one answered regex log row, got %+v", f.logs.rows)
	}
}

// A range the rules cannot compare is turned away with chips that can,
// never the "did not understand" reply.
func TestConsult_AnomalyUnsupportedPeriod(t *testing.T) {
	f := newConsultFixture(t)
	for _, p := range []*AIConsultParse{
		anomalyParse("last_30_days", "", ""),
		anomalyParse("custom", "2026-10-01", "2026-10-05"),
	} {
		f.client.parse = p
		reply := ask(t, f, "dạo này có gì bất thường")
		if reply.Kind != string(model.ConsultKindUnsupported) || reply.Message != msgAnomalyPeriod || reply.Answer != nil {
			t.Fatalf("%s: expected the anomaly period reply, got %+v", p.Period, reply)
		}
		today := reply.Chips[0].Query
		if today.Metric != "anomaly" || today.Period != "custom" || today.From != "2026-10-14" || today.To != "2026-10-14" {
			t.Fatalf("today chip = %+v", today)
		}
	}
}

// A day after today is still the day guard's: no figures.
func TestConsult_AnomalyTomorrowIsGuarded(t *testing.T) {
	f := newConsultFixture(t)
	f.client.parse = anomalyParse("custom", "2026-10-15", "2026-10-15")
	reply := ask(t, f, "mai có gì bất thường")
	if reply.Kind != string(model.ConsultKindUnsupported) || reply.Message != msgDayUnsupported {
		t.Fatalf("expected the day guard reply, got %+v", reply)
	}
}
