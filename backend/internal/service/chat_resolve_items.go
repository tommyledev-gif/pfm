package service

import (
	"strings"
	"unicode/utf8"

	"github.com/example/pfm/backend/internal/common"
	"github.com/example/pfm/backend/internal/dto"
)

// minChatItems: a single "item" is just the transaction itself, so a list is
// attached only from two lines up (prompt rule 5c).
const minChatItems = 2

// resolveChatItems turns the AI's lines for one purchase into proposal items
// (specs/transaction-line-items, typed chat). Untrusted input: any invalid
// line drops the whole list — never a partial one — and the proposal falls
// back to a plain transaction. The total is recomputed here from the lines,
// never taken from the model's own arithmetic, so the saved Transaction always
// passes the balance rule (BR-07). Returns the total in xu.
func resolveChatItems(proposed []AIProposedItem) ([]dto.ChatActionItem, int64, bool) {
	if len(proposed) < minChatItems || len(proposed) > common.TransactionItemsMax {
		return nil, 0, false
	}
	maxVND := common.MaxTransactionAmountCents / common.VNDToCentsFactor
	items := make([]dto.ChatActionItem, 0, len(proposed))
	var totalVND int64
	for _, p := range proposed {
		name := strings.TrimSpace(p.Name)
		quantity := p.Quantity
		if quantity == 0 {
			quantity = 1
		}
		if name == "" || utf8.RuneCountInString(name) > common.TransactionLineNameMaxLength ||
			quantity < 1 || quantity > common.TransactionItemQuantityMax ||
			p.AmountVND <= 0 || p.AmountVND > maxVND {
			return nil, 0, false
		}
		var unitPrice *int64
		if p.UnitPriceVND != nil {
			if *p.UnitPriceVND <= 0 || *p.UnitPriceVND > maxVND {
				return nil, 0, false
			}
			cents := *p.UnitPriceVND * common.VNDToCentsFactor
			unitPrice = &cents
		}
		totalVND += p.AmountVND
		if totalVND > maxVND {
			return nil, 0, false
		}
		items = append(items, dto.ChatActionItem{
			Name: name, Quantity: quantity, UnitPrice: unitPrice, Amount: p.AmountVND * common.VNDToCentsFactor,
		})
	}
	return items, totalVND * common.VNDToCentsFactor, true
}
