package service

import (
	"time"

	"github.com/google/uuid"

	"github.com/example/pfm/backend/internal/common"
	"github.com/example/pfm/backend/internal/dto"
	"github.com/example/pfm/backend/internal/model"
)

// resolveTransferAction turns a proposed transfer ("chuyển 2tr từ VCB sang
// MoMo") into a confirmable action.
//
// Source: the AI's wallet_id, else the default Wallet, under the same VND
// rule as income/expense (resolveWallet) — and dropped for the same reasons.
// Destination: the AI's to_wallet_id when it names another of the caller's
// VND Wallets. Anything else (missing, unknown, the source itself, another
// currency) leaves it nil rather than dropping the proposal: the client then
// has the User pick the receiving Wallet before saving (proposal-wallet.ts).
//
// A transfer has no category and no items. CategoryID is uuid.Nil; the
// client never sends it, and the server files the row under the system
// transfer category (TransactionService.resolveTransfer).
func resolveTransferAction(wallets []*model.Wallet, walletByID map[uuid.UUID]*model.Wallet, p AIProposedTransaction) (dto.ChatActionResponse, dropReason) {
	if p.AmountVND <= 0 || p.AmountVND > common.MaxTransactionAmountCents/common.VNDToCentsFactor {
		return dto.ChatActionResponse{}, dropReasonOther
	}
	source, reason := resolveWallet(wallets, walletByID, p.WalletID)
	if source == nil && reason != dropReasonNoVNDWallet {
		return dto.ChatActionResponse{}, reason
	}

	occurredAt, err := parseFlexibleTimestamp(p.OccurredAt)
	if err != nil {
		occurredAt = time.Now().UTC()
	}

	return dto.ChatActionResponse{
		Type: actionTypeCreateTransaction,
		Payload: dto.TransactionActionPayload{
			WalletID:   source,
			CategoryID: uuid.Nil,
			Amount:     p.AmountVND * common.VNDToCentsFactor,
			Type:       string(model.TransactionTypeTransfer),
			Note:       p.Note,
			OccurredAt: occurredAt,
			ToWalletID: resolveTransferDestination(walletByID, source, p.ToWalletID),
		},
		IdempotencyKey: uuid.New(),
		Confidence:     p.Confidence,
	}, dropReasonNone
}

// resolveTransferDestination returns the AI's destination only when it is
// one of the caller's VND Wallets other than the source.
func resolveTransferDestination(walletByID map[uuid.UUID]*model.Wallet, source *uuid.UUID, toWalletIDStr *string) *uuid.UUID {
	if toWalletIDStr == nil {
		return nil
	}
	id, err := uuid.Parse(*toWalletIDStr)
	if err != nil {
		return nil
	}
	w, ok := walletByID[id]
	if !ok || w.Currency != proposalCurrency || (source != nil && *source == id) {
		return nil
	}
	return &id
}
