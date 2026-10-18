package service

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
	"go.uber.org/zap"

	"github.com/example/pfm/backend/internal/common"
	"github.com/example/pfm/backend/internal/dto"
	"github.com/example/pfm/backend/internal/repository"
)

// duplicateGroup is one Wallet / type / calendar day (app timezone) whose
// saved Transactions are read once for every proposal in it.
type duplicateGroup struct {
	walletID uuid.UUID
	txType   string
	day      string
}

// attachPossibleDuplicates marks each proposal that looks like a saved,
// non-deleted Transaction of the caller — same Wallet, type, amount in xu and
// calendar day in common.AppLocation — with the latest such Transaction
// (spec BR-17, plan F36). A warning only: a lookup failure is logged and the
// proposals go out unmarked. Wallet-less proposals are skipped. Returns how
// many proposals were marked.
func (s *ChatImageService) attachPossibleDuplicates(ctx context.Context, userID uuid.UUID, actions []dto.ChatActionResponse) int {
	groups := map[duplicateGroup][]int{}
	dayStarts := map[duplicateGroup]time.Time{}
	for i, a := range actions {
		if a.Payload.WalletID == nil {
			continue
		}
		local := a.Payload.OccurredAt.In(common.AppLocation)
		start := time.Date(local.Year(), local.Month(), local.Day(), 0, 0, 0, 0, common.AppLocation)
		key := duplicateGroup{walletID: *a.Payload.WalletID, txType: a.Payload.Type, day: start.Format(time.DateOnly)}
		groups[key] = append(groups[key], i)
		dayStarts[key] = start
	}

	marked := 0
	for key, indexes := range groups {
		saved, err := s.listSameDay(ctx, userID, key, dayStarts[key])
		if err != nil {
			s.logger.Warn("possible-duplicate lookup failed", zap.String("error_type", fmt.Sprintf("%T", err)))
			continue
		}
		for _, i := range indexes {
			for _, t := range saved { // newest first: the first match is the latest
				if t.Amount == actions[i].Payload.Amount {
					actions[i].PossibleDuplicate = &dto.ChatActionDuplicate{Amount: t.Amount, OccurredAt: t.OccurredAt.UTC()}
					marked++
					break
				}
			}
		}
	}
	return marked
}

func (s *ChatImageService) listSameDay(ctx context.Context, userID uuid.UUID, key duplicateGroup, start time.Time) ([]*savedTransaction, error) {
	walletID, txType := key.walletID, key.txType
	from := start.UTC()
	// To is inclusive in the query: the last instant of the local day.
	to := start.AddDate(0, 0, 1).Add(-time.Nanosecond).UTC()
	rows, err := s.txRepo.ListTransactionsByUser(ctx, userID, repository.ListTransactionsFilter{
		WalletID: &walletID, Type: &txType, From: &from, To: &to, Limit: common.AIImageDuplicateScanLimit,
	})
	if err != nil {
		return nil, fmt.Errorf("service.listSameDay: %w", err)
	}
	out := make([]*savedTransaction, 0, len(rows))
	for _, r := range rows {
		out = append(out, &savedTransaction{Amount: r.Amount, OccurredAt: r.OccurredAt})
	}
	return out, nil
}

// savedTransaction is the part of a saved Transaction the check compares.
type savedTransaction struct {
	Amount     int64
	OccurredAt time.Time
}
