package service

import (
	"testing"

	"github.com/example/pfm/backend/internal/model"
)

func oneDayParse(metric, day string) *AIConsultParse {
	return &AIConsultParse{
		Kind: model.ParseKindQuery, Coverage: model.ParseCoverageFull,
		Metric: metric, Period: "custom", From: day, To: day,
	}
}

// BR-27: the days the catalog cannot answer are turned away with a chip for
// today, before any figure is read (EC-29, EC-30, EC-32).
func TestConsult_DayGuardTurnsAwayUnanswerableDays(t *testing.T) {
	cases := map[string]*AIConsultParse{
		"EC-29 tomorrow":         oneDayParse("sum", "2026-10-15"),
		"EC-30 nonexistent date": oneDayParse("sum", "2026-02-31"),
		"EC-32 one-day compare":  oneDayParse("compare", analyticsToday),
	}
	for name, p := range cases {
		f := newConsultFixture(t)
		f.client.parse = p
		reply := ask(t, f, "câu hỏi")
		if reply.Kind != string(model.ConsultKindUnsupported) || reply.Answer != nil {
			t.Fatalf("%s: got kind %s answer %v", name, reply.Kind, reply.Answer)
		}
		chip := reply.Chips[0].Query
		if chip.Period != "custom" || chip.From != analyticsToday || chip.To != analyticsToday {
			t.Fatalf("%s: first chip must ask about today, got %+v", name, chip)
		}
		if f.logs.rows[0].Outcome != model.IntentOutcomeUnsupport {
			t.Fatalf("%s: outcome = %s", name, f.logs.rows[0].Outcome)
		}
	}
}

// S-AIQ-52 / S-AIQ-58: today and a past day pass the guard and are answered;
// so does a multi-day range that reaches past today ("so far").
func TestConsult_DayGuardLetsAnswerableDaysThrough(t *testing.T) {
	cases := map[string]*AIConsultParse{
		"today":             oneDayParse("sum", analyticsToday),
		"day before":        oneDayParse("top_n", "2026-10-12"),
		"range past today":  {Kind: model.ParseKindQuery, Coverage: model.ParseCoverageFull, Metric: "sum", Period: "custom", From: "2026-10-01", To: "2026-10-31"},
		"named period only": {Kind: model.ParseKindQuery, Coverage: model.ParseCoverageFull, Metric: "sum", Period: "this_cycle"},
	}
	for name, p := range cases {
		f := newConsultFixture(t)
		f.client.parse = p
		if reply := ask(t, f, "câu hỏi"); reply.Kind != string(model.ConsultKindAnswer) {
			t.Fatalf("%s: expected an answer, got %+v", name, reply)
		}
	}
}

// S-AIQ-60 / BR-26: a model output outside the catalog is "cannot answer",
// logged as an error — never the degraded "temporarily unavailable" reply.
func TestConsult_InvalidOutputIsUnsupportedNotDegraded(t *testing.T) {
	f := newConsultFixture(t)
	f.client.parse = &AIConsultParse{Kind: model.ParseKindUnsupported, Coverage: "partial", InvalidOutput: true}
	reply := ask(t, f, "what spent today")
	if reply.Kind != string(model.ConsultKindUnsupported) || reply.Answer != nil || len(reply.Chips) == 0 {
		t.Fatalf("expected unsupported with chips, got %+v", reply)
	}
	if f.logs.rows[0].Outcome != model.IntentOutcomeError {
		t.Fatalf("outcome = %s, want error", f.logs.rows[0].Outcome)
	}
}
