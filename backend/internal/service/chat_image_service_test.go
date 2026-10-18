package service

import (
	"context"
	"encoding/json"
	"errors"
	"strings"
	"testing"
	"time"

	"github.com/google/uuid"
	"go.uber.org/zap"

	"github.com/example/pfm/backend/internal/common"
	"github.com/example/pfm/backend/internal/dto"
	"github.com/example/pfm/backend/internal/model"
)

// fakeAIImageClient returns a scripted reading (or error) and counts calls.
type fakeAIImageClient struct {
	resp  *AIExtractImageResponse
	err   error
	calls int
}

func (f *fakeAIImageClient) ExtractImage(_ context.Context, _ AIExtractImageRequest) (*AIExtractImageResponse, error) {
	f.calls++
	return f.resp, f.err
}

var imageTestNow = time.Date(2026, 10, 18, 3, 0, 0, 0, time.UTC)

type imageFixture struct {
	svc      *ChatImageService
	ai       *fakeAIImageClient
	txRepo   *fakeTransactionRepo
	userID   uuid.UUID
	cash     *model.Wallet
	food     *model.Category
	stranger *model.Category
}

func newImageFixture(t *testing.T, withWallet bool) *imageFixture {
	t.Helper()
	userID := uuid.New()
	walletRepo, categoryRepo, txRepo := newFakeWalletRepo(), newFakeCategoryRepo(), newFakeTransactionRepo()
	f := &imageFixture{ai: &fakeAIImageClient{}, txRepo: txRepo, userID: userID}
	if withWallet {
		f.cash = &model.Wallet{ID: uuid.New(), UserID: userID, Name: "Tiền mặt", Currency: common.WalletDefaultCurrency, IsDefault: true, CreatedAt: testWalletEpoch}
		walletRepo.wallets[f.cash.ID] = f.cash
	}
	f.food = &model.Category{ID: uuid.New(), UserID: &userID, Name: "Ăn uống", Type: model.CategoryTypeExpense}
	other := uuid.New()
	f.stranger = &model.Category{ID: uuid.New(), UserID: &other, Name: "Không phải của mình", Type: model.CategoryTypeExpense}
	categoryRepo.categories[f.food.ID] = f.food
	categoryRepo.categories[f.stranger.ID] = f.stranger
	f.svc = NewChatImageService(walletRepo, categoryRepo, txRepo, f.ai, zap.NewNop())
	f.svc.now = func() time.Time { return imageTestNow }
	return f
}

func (f *imageFixture) receipt(amountVND int64, date string) AIProposedImageTransaction {
	return AIProposedImageTransaction{AmountVND: amountVND, TxType: "expense", CategoryID: f.food.ID.String(), OccurredAt: date, Confidence: 0.9, TotalVisible: true}
}

func (f *imageFixture) propose(t *testing.T, kind string, entries ...AIProposedImageTransaction) *dto.ChatImageResponse {
	t.Helper()
	f.ai.resp = &AIExtractImageResponse{SourceKind: kind, Transactions: entries}
	resp, err := f.svc.ProposeFromImage(context.Background(), f.userID, ImageProposalInput{Image: []byte("jpg"), MIMEType: "image/jpeg"})
	if err != nil {
		t.Fatalf("ProposeFromImage: %v", err)
	}
	return resp
}

func TestImage_ReceiptTotalBecomesOneProposal(t *testing.T) { // S-AIIMG-01
	f := newImageFixture(t, true)
	resp := f.propose(t, sourceKindReceipt, f.receipt(145000, "2026-10-02"))
	if len(resp.Actions) != 1 || resp.Actions[0].Payload.Amount != 14_500_000 || resp.Actions[0].Confidence != 0.9 {
		t.Fatalf("got %+v", resp.Actions)
	}
	if resp.Actions[0].Payload.WalletID == nil || *resp.Actions[0].Payload.WalletID != f.cash.ID {
		t.Fatal("expected the default VND Wallet")
	}
}

func TestImage_LinesThatReconcileAreAttached(t *testing.T) { // S-AIIMG-02
	f := newImageFixture(t, true)
	entry := f.receipt(108000, "2026-10-02")
	entry.Items = []AIProposedImageItem{{Name: "Sữa", Quantity: 1, AmountVND: 60000}, {Name: "Bánh", Quantity: 2, UnitPriceVND: ptrInt64(20000), AmountVND: 40000}}
	entry.Adjustments = []AIProposedImageAdjustment{{Kind: "tax", Direction: "add", AmountVND: 8000}}
	a := f.propose(t, sourceKindReceipt, entry).Actions[0]
	if len(a.Payload.Items) != 2 || len(a.Payload.Adjustments) != 1 || a.Payload.Adjustments[0].Amount != 800_000 {
		t.Fatalf("lines not attached: %+v", a.Payload)
	}
	if a.Confidence != 0.9 || a.ReviewLines != nil {
		t.Fatalf("reconciled lines must not cap confidence: %v", a.Confidence)
	}
}

func TestImage_UnreconciledLinesKeepTotalAndCapConfidence(t *testing.T) { // S-AIIMG-52
	f := newImageFixture(t, true)
	entry := f.receipt(108000, "2026-10-02")
	entry.Items = []AIProposedImageItem{{Name: "Sữa", Quantity: 1, AmountVND: 100000}}
	a := f.propose(t, sourceKindReceipt, entry).Actions[0]
	if a.Payload.Amount != 10_800_000 || len(a.Payload.Items) != 1 || a.Confidence != common.AIImageReviewConfidence {
		t.Fatalf("got amount %d items %d conf %v", a.Payload.Amount, len(a.Payload.Items), a.Confidence)
	}
}

func TestImage_ReviewMarksTravelBesideThePayload(t *testing.T) { // S-AIIMG-66
	f := newImageFixture(t, true)
	entry := f.receipt(50000, "2026-10-02")
	entry.Items = []AIProposedImageItem{{Name: "SUA TH 1L", Quantity: 1, AmountVND: 30000, NeedsReview: true}, {Name: "Bánh", Quantity: 1, AmountVND: 20000}}
	a := f.propose(t, sourceKindReceipt, entry).Actions[0]
	if a.ReviewLines == nil || len(a.ReviewLines.Items) != 1 || a.ReviewLines.Items[0] != 0 || a.Confidence != common.AIImageReviewConfidence {
		t.Fatalf("got %+v conf %v", a.ReviewLines, a.Confidence)
	}
	// F37: the payload must still decode as a confirm body with unknown fields refused.
	body, _ := json.Marshal(a.Payload)
	var req dto.CreateTransactionRequest
	if err := dto.DecodeStrict(body, &req); err != nil {
		t.Fatalf("payload no longer fits the confirm body: %v", err)
	}
}

func TestImage_AdjustmentDirectionFollowsKind(t *testing.T) {
	f := newImageFixture(t, true)
	entry := f.receipt(80000, "2026-10-02")
	entry.Items = []AIProposedImageItem{{Name: "Cơm", Quantity: 1, AmountVND: 100000}}
	entry.Adjustments = []AIProposedImageAdjustment{{Kind: "discount", Direction: "add", AmountVND: 20000}}
	a := f.propose(t, sourceKindReceipt, entry).Actions[0]
	if a.Payload.Adjustments[0].Direction != dto.AdjustmentDirectionSubtract || a.Confidence != 0.9 {
		t.Fatalf("got %+v conf %v", a.Payload.Adjustments, a.Confidence)
	}
}

func TestImage_TooManyLinesAreLeftOffAndSaid(t *testing.T) { // S-AIIMG-53
	f := newImageFixture(t, true)
	entry := f.receipt(500000, "2026-10-02")
	for i := 0; i <= common.TransactionItemsMax; i++ {
		entry.Items = append(entry.Items, AIProposedImageItem{Name: "x", Quantity: 1, AmountVND: 1000})
	}
	resp := f.propose(t, sourceKindReceipt, entry)
	if len(resp.Actions[0].Payload.Items) != 0 || !strings.Contains(resp.Message, "chưa kèm chi tiết món") {
		t.Fatalf("got %q", resp.Message)
	}
}

func TestImage_MissingAndFutureDatesCapConfidence(t *testing.T) { // S-AIIMG-08, S-AIIMG-09
	f := newImageFixture(t, true)
	resp := f.propose(t, sourceKindReceipt, f.receipt(10000, ""), f.receipt(20000, "2026-12-01"), f.receipt(30000, "2026-10-17"))
	got := []float64{resp.Actions[0].Confidence, resp.Actions[1].Confidence, resp.Actions[2].Confidence}
	if got[0] != common.AIImageReviewConfidence || got[1] != common.AIImageReviewConfidence || got[2] != 0.9 {
		t.Fatalf("confidences %v", got)
	}
}

func TestImage_HandwritingNotCappedWhileFlagIsOff(t *testing.T) { // S-AIIMG-04
	f := newImageFixture(t, true)
	resp := f.propose(t, sourceKindHandwritten, f.receipt(45000, "2026-10-02"), f.receipt(80000, "2026-10-02"))
	if len(resp.Actions) != 2 || resp.Actions[0].Confidence != 0.9 || resp.Actions[0].Payload.Items != nil {
		t.Fatalf("got %+v", resp.Actions)
	}
}

func TestImage_ForeignCategoryIsSkippedAndCounted(t *testing.T) { // S-AIIMG-10
	f := newImageFixture(t, true)
	bad := f.receipt(10000, "2026-10-02")
	bad.CategoryID = f.stranger.ID.String()
	resp := f.propose(t, sourceKindHandwritten, f.receipt(45000, "2026-10-02"), bad)
	if len(resp.Actions) != 1 || resp.SkippedCount != 1 || !strings.Contains(resp.Message, "1 khoản chưa đọc được") {
		t.Fatalf("got %d actions, skipped %d, %q", len(resp.Actions), resp.SkippedCount, resp.Message)
	}
}

func TestImage_ZeroWalletsNeverCallTheAI(t *testing.T) { // S-AIIMG-13
	f := newImageFixture(t, false)
	resp := f.propose(t, sourceKindReceipt, f.receipt(10000, "2026-10-02"))
	if f.ai.calls != 0 || resp.Intent != string(model.ChatIntentAmbiguous) || resp.Message != msgImageNoWallet {
		t.Fatalf("calls %d, %+v", f.ai.calls, resp)
	}
}

func TestImage_NothingReadable(t *testing.T) { // S-AIIMG-12
	f := newImageFixture(t, true)
	resp := f.propose(t, "other")
	if len(resp.Actions) != 0 || resp.Message != msgImageNothingRead {
		t.Fatalf("got %+v", resp)
	}
}

func TestImage_BusyCarriesTheWaitTime(t *testing.T) { // S-AIIMG-58
	f := newImageFixture(t, true)
	wait := 40
	f.ai.err = &AIImageBusyError{RetryAfterSeconds: &wait}
	_, err := f.svc.ProposeFromImage(context.Background(), f.userID, ImageProposalInput{Image: []byte("x"), MIMEType: "image/png"})
	var appErr *common.AppError
	if !errors.As(err, &appErr) || appErr.Code != common.ErrCodeAIImageBusy {
		t.Fatalf("got %v", err)
	}
	if details := appErr.Details.(map[string]interface{}); *(details["retry_after_seconds"].(*int)) != 40 {
		t.Fatalf("details %v", details)
	}
}

func TestImage_UnavailableIsBadGateway(t *testing.T) { // S-AIIMG-22, S-AIIMG-69
	f := newImageFixture(t, true)
	f.ai.err = errors.New("status 503")
	_, err := f.svc.ProposeFromImage(context.Background(), f.userID, ImageProposalInput{Image: []byte("x"), MIMEType: "image/png"})
	if !errors.Is(err, common.ErrAIServiceUnavailable) {
		t.Fatalf("got %v", err)
	}
}

func TestImage_CutOffTotalCapsConfidenceEvenWhenLinesAddUp(t *testing.T) { // EC-37
	f := newImageFixture(t, true)
	entry := f.receipt(908600, "2023-07-01")
	entry.TotalVisible = false
	entry.Items = []AIProposedImageItem{{Name: "Bún", Quantity: 1, AmountVND: 826000}}
	entry.Adjustments = []AIProposedImageAdjustment{{Kind: "tax", Direction: "add", AmountVND: 82600}}
	a := f.propose(t, sourceKindReceipt, entry).Actions[0]
	if a.Confidence != common.AIImageReviewConfidence {
		t.Fatalf("confidence %v", a.Confidence)
	}
}

func ptrInt64(v int64) *int64 { return &v }
