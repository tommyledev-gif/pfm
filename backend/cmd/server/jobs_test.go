package main

import (
	"context"
	"sync/atomic"
	"testing"
	"time"

	"go.uber.org/zap"
)

func TestBackgroundJob_RunsAtStartWhenAsked(t *testing.T) {
	var runs atomic.Int32
	stop := startBackgroundJobs([]backgroundJob{{
		name:       "at start",
		interval:   time.Hour,
		runAtStart: true,
		run:        func(context.Context) { runs.Add(1) },
	}}, zap.NewNop())
	waitFor(t, func() bool { return runs.Load() == 1 })
	stop()
}

func TestBackgroundJob_WaitsForFirstIntervalByDefault(t *testing.T) {
	var runs atomic.Int32
	stop := startBackgroundJobs([]backgroundJob{{
		name:     "after interval",
		interval: time.Hour,
		run:      func(context.Context) { runs.Add(1) },
	}}, zap.NewNop())
	time.Sleep(20 * time.Millisecond)
	stop()
	if got := runs.Load(); got != 0 {
		t.Fatalf("job ran %d times before its first interval, want 0", got)
	}
}

// A panicking job must not take the process down, and must run again on its
// next tick.
func TestBackgroundJob_PanicIsRecoveredAndJobKeepsRunning(t *testing.T) {
	var runs atomic.Int32
	stop := startBackgroundJobs([]backgroundJob{{
		name:     "panics",
		interval: 5 * time.Millisecond,
		run: func(context.Context) {
			runs.Add(1)
			panic("boom")
		},
	}}, zap.NewNop())
	waitFor(t, func() bool { return runs.Load() >= 2 })
	stop()
}

// stop must not return while a run is still in progress: the database pool is
// closed right after it.
func TestBackgroundJob_StopWaitsForRunInProgress(t *testing.T) {
	started := make(chan struct{})
	var finished atomic.Bool
	stop := startBackgroundJobs([]backgroundJob{{
		name:       "slow",
		interval:   time.Hour,
		runAtStart: true,
		run: func(ctx context.Context) {
			close(started)
			<-ctx.Done()
			time.Sleep(20 * time.Millisecond)
			finished.Store(true)
		},
	}}, zap.NewNop())
	<-started
	stop()
	if !finished.Load() {
		t.Fatal("stop returned before the running job finished")
	}
}

func waitFor(t *testing.T, cond func() bool) {
	t.Helper()
	deadline := time.Now().Add(2 * time.Second)
	for !cond() {
		if time.Now().After(deadline) {
			t.Fatal("condition not met within 2s")
		}
		time.Sleep(time.Millisecond)
	}
}
