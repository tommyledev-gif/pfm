package service

import (
	"testing"

	"github.com/example/pfm/backend/internal/model"
)

// The user's own message: "Spaylater: vớ đen+ trắng 95k, bịt mắt 45k, dây
// chuyền 41k, móc cài mắt kính chống tuột 22k, xịt phồng tóc menitem 123k".
func spaylaterItems() []AIProposedItem {
	return []AIProposedItem{
		{Name: "Vớ đen + trắng", AmountVND: 95000},
		{Name: "Bịt mắt", AmountVND: 45000},
		{Name: "Dây chuyền", AmountVND: 41000},
		{Name: "Móc cài mắt kính chống tuột", AmountVND: 22000},
		{Name: "Xịt phồng tóc Menitem", AmountVND: 123000},
	}
}

// One purchase becomes one proposal; the total is the lines' sum even when
// the model added them up wrong.
func TestResolveActions_PurchaseItems_TotalFromLines(t *testing.T) {
	wallet := testWallet("Spaylater", "VND", true, 0)
	category := testExpenseCategory()
	p := testProposal(category.ID, nil)
	p.AmountVND = 300000 // model's wrong sum
	p.Items = spaylaterItems()
	proposed := []AIProposedTransaction{p}

	actions, skipped, _ := resolveActions([]*model.Wallet{wallet}, []*model.Category{category}, proposed)
	if skipped != 0 || len(actions) != 1 {
		t.Fatalf("expected one action, got %d (skipped %d)", len(actions), skipped)
	}
	payload := actions[0].Payload
	if len(payload.Items) != 5 || payload.Amount != 32600000 {
		t.Fatalf("expected 5 items totaling 326,000 VND in xu, got %d items, amount %d", len(payload.Items), payload.Amount)
	}
	if payload.Items[4].Amount != 12300000 || payload.Items[4].Quantity != 1 {
		t.Fatalf("expected xu amounts and default quantity, got %+v", payload.Items[4])
	}
}

// Any invalid line drops the whole list, never a partial one; the proposal
// stays a plain transaction with the model's amount.
func TestResolveActions_InvalidLine_DropsAllItems(t *testing.T) {
	wallet := testWallet("Tiền mặt", "VND", true, 0)
	category := testExpenseCategory()
	p := testProposal(category.ID, nil)
	p.Items = append(spaylaterItems(), AIProposedItem{Name: "  ", AmountVND: 1000})
	proposed := []AIProposedTransaction{p}

	actions, _, _ := resolveActions([]*model.Wallet{wallet}, []*model.Category{category}, proposed)
	if len(actions) != 1 || actions[0].Payload.Items != nil || actions[0].Payload.Amount != testAmountVND*100 {
		t.Fatalf("expected a plain proposal, got %+v", actions[0].Payload)
	}
}

func TestResolveChatItems_SingleLineIsNotAList(t *testing.T) {
	if _, _, ok := resolveChatItems([]AIProposedItem{{Name: "Cà phê", AmountVND: 45000}}); ok {
		t.Fatal("a single line must not become an items list")
	}
}

func TestResolveChatItems_UnitPriceConverted(t *testing.T) {
	unit := int64(5000)
	items, total, ok := resolveChatItems([]AIProposedItem{
		{Name: "Trà đá", Quantity: 2, UnitPriceVND: &unit, AmountVND: 10000},
		{Name: "Bánh", AmountVND: 20000},
	})
	if !ok || total != 3000000 || items[0].UnitPrice == nil || *items[0].UnitPrice != 500000 {
		t.Fatalf("unexpected result: %+v total=%d ok=%v", items, total, ok)
	}
}
