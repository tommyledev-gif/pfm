"""Upper bounds for every request this service accepts
(specs/security-hardening-2026-10 US-07).

Each bound sits well above what the Go backend can send (its own limits are in
the comments), so a real request never meets one. They exist so nothing else
on the network, and no backend bug, can make this service hold or forward an
unbounded payload to a paid model.
"""

# A chat message (backend: 1,000 characters) or a stored chat turn.
MESSAGE_MAX_CHARS = 4000
# Prior turns sent with a message (backend: common.AIChatHistoryLimit = 10).
HISTORY_MAX_TURNS = 50
# The caller's own wallets and categories given as context. Not capped by the
# backend; far above any household's real count.
WALLETS_MAX = 500
CATEGORIES_MAX = 1000
# Ids are UUIDs (36), names are at most 100 (wallet) / 50 (category) characters.
ID_MAX_CHARS = 64
NAME_MAX_CHARS = 200
SHORT_FIELD_MAX_CHARS = 64
# One receipt photo: the backend accepts 2.5 MiB, which is ~3.4 MiB as base64.
IMAGE_BASE64_MAX_CHARS = 8 * 1024 * 1024
# Image caption (backend: 300 characters).
CAPTION_MAX_CHARS = 500
# Transactions read from one image (backend: common.AIImageMaxProposals = 20).
IMAGE_MAX_ITEMS = 50
