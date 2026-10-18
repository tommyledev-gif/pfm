package common

import "time"

// Image capture (specs/ai-chat-image-capture plan §3.6). Limits confirmed by
// the product owner on 2026-10-04 are marked; the rest are plan-owned.
const (
	// AIImageMaxUploadBytes: base64 grows the image by 4/3 on the way to the
	// AI Service; 2.5 MiB keeps the provider request well inside its limit
	// (plan F4). Mobile sends far less (< 1 MB after downscaling).
	AIImageMaxUploadBytes = 5 * 1024 * 1024 / 2
	// AIImageCaptionMaxLength, AIImageMaxProposals, AIImageRateLimit: confirmed 2026-10-04.
	AIImageCaptionMaxLength = 300
	AIImageMaxProposals     = 20
	AIImageRateLimit        = 10
	AIImageRateLimitWindow  = time.Hour
	// AIImageRequestTimeout covers one provider call plus one truncation
	// retry inside the AI Service (2 × 12 s, plan F40).
	AIImageRequestTimeout = 30 * time.Second
	// AIImageReviewConfidence caps an uncertain proposal below
	// AIChatConfidenceThreshold so the card carries the low-confidence label
	// (spec BR-09, BR-15, BR-16).
	AIImageReviewConfidence = 0.5
	// AIImageFutureDateTolerance: a date later than now plus this is "in the
	// future" (spec BR-05).
	AIImageFutureDateTolerance = 24 * time.Hour
	// AIImageDuplicateScanLimit bounds the saved Transactions read per
	// Wallet/type/day group for the possible-duplicate check (spec BR-17).
	AIImageDuplicateScanLimit = 50
	// AIImageBusyBodyMaxBytes bounds the read of the AI Service's 429 body
	// (plan F34).
	AIImageBusyBodyMaxBytes = 1024

	AIImageFormFieldImage   = "image"
	AIImageFormFieldCaption = "caption"
	// AIImageSniffBytes is what http.DetectContentType looks at.
	AIImageSniffBytes = 512
)

// Phase 0 verdicts (plan §2.4). Set from the accuracy check results.
const (
	// AIImageFlagHandwritten: every proposal read from a handwritten note
	// carries the low-confidence label when true (spec decision 8).
	AIImageFlagHandwritten = false
	// AIImageReadReceiptLines: the AI Service asks for receipt lines only
	// when true.
	AIImageReadReceiptLines = true
)

// AIImageAllowedContentTypes are decided by the image's own bytes, never by
// the name or the declared type (spec BR-12, S-AIIMG-17).
var AIImageAllowedContentTypes = map[string]bool{
	"image/jpeg": true,
	"image/png":  true,
	"image/webp": true,
}
