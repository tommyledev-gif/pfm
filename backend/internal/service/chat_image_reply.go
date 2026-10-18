package service

import (
	"fmt"

	"github.com/example/pfm/backend/internal/common"
	"github.com/example/pfm/backend/internal/dto"
)

// Lead-in copy for image replies (spec US-01 step 11, AC-10–AC-12, EC-10).
// Follows the pfm-ux-copy skill: facts first, at most two sentences, one
// next action; the cards carry the per-proposal detail.
const (
	msgImageNoWallet    = "Chưa có ví. Tạo ví để ghi giao dịch."
	msgImageWhichWallet = "Ghi vào ví nào?"
	msgImageNothingRead = "Không đọc được khoản thu chi nào trong ảnh. Chụp lại rõ hơn."
)

// renderImageLeadIn is the typed flow's confirm sentence plus at most one
// notice, most important first: entries left out by the maximum, Items left
// off an over-long receipt, then entries that could not be read.
func renderImageLeadIn(actions []dto.ChatActionResponse, skipped int, truncated bool, linesTooMany int) string {
	message := renderConfirmMessage(actions)
	switch {
	case truncated:
		return fmt.Sprintf("%s Chỉ đọc %d khoản đầu trong ảnh.", message, common.AIImageMaxProposals)
	case linesTooMany > 0:
		return fmt.Sprintf("%s Hóa đơn có hơn %d món nên chưa kèm chi tiết món.", message, common.TransactionItemsMax)
	case skipped > 0:
		return fmt.Sprintf("%s %d khoản chưa đọc được.", message, skipped)
	default:
		return message
	}
}
