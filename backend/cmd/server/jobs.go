package main

import (
	"context"
	"runtime/debug"
	"sync"
	"time"

	"go.uber.org/zap"
)

// backgroundJob is work the server repeats on a timer, outside any HTTP
// request: the budget-crossing check and the table clean-ups (see wire).
type backgroundJob struct {
	name     string
	interval time.Duration
	// runAtStart also runs the job once immediately, instead of only after
	// the first interval has passed.
	runAtStart bool
	run        func(ctx context.Context)
}

// startBackgroundJobs runs each job in its own goroutine (a lightweight
// thread) and returns a function that stops them all and waits for any run
// still in progress to return, so none is cut off mid-query when the
// database pool closes.
func startBackgroundJobs(jobs []backgroundJob, logger *zap.Logger) (stop func()) {
	ctx, cancel := context.WithCancel(context.Background())
	var running sync.WaitGroup
	for _, job := range jobs {
		running.Add(1)
		go func() {
			defer running.Done()
			runEvery(ctx, job, logger)
		}()
	}
	return func() {
		cancel()
		running.Wait()
	}
}

// runEvery runs job on a ticker until ctx is cancelled. A ticker, not a
// sleep loop, so a slow run never makes the next ones pile up.
func runEvery(ctx context.Context, job backgroundJob, logger *zap.Logger) {
	ticker := time.NewTicker(job.interval)
	defer ticker.Stop()

	logger.Info("background job started", zap.String("job", job.name), zap.Duration("interval", job.interval))
	if job.runAtStart {
		runOnce(ctx, job, logger)
	}
	for {
		select {
		case <-ctx.Done():
			logger.Info("background job stopped", zap.String("job", job.name))
			return
		case <-ticker.C:
			runOnce(ctx, job, logger)
		}
	}
}

// runOnce runs the job one time. A panic is logged and the job carries on at
// its next tick: middleware.Recover only guards HTTP requests, and a panic
// nobody recovers ends the whole process, taking every request with it.
func runOnce(ctx context.Context, job backgroundJob, logger *zap.Logger) {
	defer func() {
		if r := recover(); r != nil {
			logger.Error("background job panicked",
				zap.String("job", job.name),
				zap.Any("panic", r),
				zap.ByteString("stack", debug.Stack()),
			)
		}
	}()
	job.run(ctx)
}
