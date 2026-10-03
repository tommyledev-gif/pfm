# Feasibility: Recording Transactions from an Image

> Item 2 of the 2026-10-03 request: "AI looks at a receipt, a handwritten note, or an Excel screenshot with matching columns, and creates the matching Transaction proposals — like `TransactionActionCard`."
> Status: **Research only — no code, no spec.** Verdict at the bottom.

---

## 1. What has to happen

```
[photo / gallery image] → mobile → backend → ai-service → vision LLM (tool call)
                                                   ↓
            N proposals (same shape as today's text extraction)
                                                   ↓
       one assistant bubble with N TransactionActionCards → User confirms each
```

Three input families, with different difficulty:

| Input | Typical content | Expected output | Difficulty |
|---|---|---|---|
| Printed receipt / bill | merchant, line items, **total**, date | usually **1** proposal (the total); line items only on request | Low–medium |
| Handwritten note | "cafe 45k, xăng 80k, 2/10" | **several** proposals | Medium–high (handwriting, VN shorthand "k", "tr", "m") |
| Spreadsheet screenshot | rows with date / amount / note / category columns | **one per row** | Low (clean text) but needs column mapping + row cap |

The existing pipeline already supports the hard part on the output side: `ChatResponse.actions` is an **array**, and each action renders as its own `TransactionActionCard` with Confirm / Edit / Delete. Nothing on the confirm/save side has to change.

---

## 2. Options considered

| Option | How | Pros | Cons | Verdict |
|---|---|---|---|---|
| **A. On-device OCR + existing text extractor** | ML Kit text recognition → feed raw text to today's `/extract` | Free, offline OCR | Needs a native module → **does not run in Expo Go** (project is pinned to Expo Go SDK 54, see `mobile/AGENTS.md`); loses table/layout structure; weak on handwriting | ❌ |
| **B. Cloud OCR (Google Vision / AWS Textract) + LLM** | OCR service → text → `/extract` | Strong OCR, table support (Textract) | New vendor, new key, new cost, two hops; still loses layout for the LLM | ❌ for now |
| **C. Multimodal LLM with tool calling** | Send the image straight to a vision model with the same tool-calling schema, returning an array of transactions | One hop; reads layout, tables and handwriting; reuses the existing Groq + Anthropic integration and tool-calling pattern | Token cost per image; hallucination risk on amounts; vision model catalogue changes | ✅ **Recommended** |

---

## 3. Option C — facts checked

**Groq (primary, already integrated):**
- Vision model currently listed: `qwen/qwen3.8-27b` — text + image input, **supports tool use and JSON mode**, 131K context. Llama-4 Scout/Maverick are also referenced by third parties but not on Groq's own vision page today.
- Limits: **max 3 images per request**, **each image ≈ 2048 input tokens**, request with an image URL ≤ 20 MB.
- ⚠️ Groq rotates vision models roughly quarterly (this project already lost `llama-3.3-70b-versatile` on 2026-08-16). The model id **must be an env setting** (like `groq_model` today), with its own name, e.g. `groq_vision_model`.

**Anthropic (fallback):**
- Current fallback is `claude-3-5-haiku-20241022` (`ai-service/app/core/config.py`). Its vision support and remaining lifetime must be verified before relying on it; a current Haiku-class model (e.g. Claude Haiku 4.5) supports image input + tool use. Fallback key is not configured in this environment today, so in practice Groq is the only live path.

**Mobile (Expo Go compatible, no new native code):**
- `expo-image-picker` **is already installed** (camera + gallery, returns base64 or a file URI) and works in Expo Go.
- Downscaling before upload: picker `quality` option is enough for a spike; `expo-image-manipulator` (Expo Go-compatible, not yet installed) gives a fixed max dimension (~1600 px long edge keeps receipts legible at a few hundred KB).

**Backend:**
- Fiber default body limit is **4 MB** (`main.go` sets no `BodyLimit`). A multipart upload of one downscaled JPEG fits; the route should still enforce its own size cap and MIME allow-list (jpeg/png/webp/heic→jpeg on device).
- Needs its own rate limiter — an image costs ~2k tokens before any text, so it must not share `AIChatRateLimiter`'s text budget (same reasoning as `/analytics/consult`).

---

## 4. Proposed shape (for a future spec — not decided)

- **Mobile:** an attach button in the recording input → "Take photo" / "Choose from library" → preview with Send → user bubble shows a small thumbnail → assistant bubble with N proposal cards. Optional "Confirm all" later.
- **Backend:** `POST /ai/chat/image` (multipart: image + optional caption text) → validates size/type, never stores the image, forwards to ai-service, maps result through the **same** Wallet/Category resolution as text chat.
- **ai-service:** `POST /extract-image` → vision model with a tool `record_transactions(items: [{amount_xu, type, note, occurred_at, category_hint, wallet_hint, confidence}])` — flat schema, no nested `$ref` (same constraint as today). Prompt rules: receipts → one item = the printed total unless the caption asks for line items; VN shorthand (`45k`, `1tr2`, `5m`); DD/MM dates; never invent a date (default today, flagged low confidence); cap rows per image (e.g. 20) and say so if truncated.
- **Thread sync:** the image itself must **not** go into the synced thread payload (size, privacy). Keep a local thumbnail only, or just a caption "📷 Ảnh hoá đơn".

---

## 5. Risks

| Risk | Impact | Mitigation |
|---|---|---|
| ⚠️ Mis-read amount (e.g. 45.000 vs 450.000) | Wrong financial record | Results are **always proposals**, never auto-saved; show the thumbnail next to the cards; low-confidence cards visually flagged; amounts as integer xu only |
| Hallucinated rows | Phantom transactions | Same: every row needs Confirm; row cap; prompt forbids inventing rows |
| Privacy (receipts carry names, card digits, addresses) | Data exposure | Image never persisted server-side, never logged; only extracted fields stored after Confirm |
| Vision model withdrawn | Feature dark | Env-configurable model id; Anthropic fallback with a vision-capable model; clear "manual entry" fallback (already exists for AI outages) |
| Free-tier token limits | Throttling | Dedicated limiter; downscale images; one image per request in v1 |
| Expo Go constraint | Blocks native OCR | Option C needs no native module |

---

## 6. Effort estimate (rough)

| Layer | Work | Size |
|---|---|---|
| ai-service | vision client, prompt, tool schema, tests with fixture images | M |
| backend | multipart route, limiter, mapping reuse, tests | S–M |
| mobile | picker + preview + thumbnail bubble + multi-card reply | M |
| Spike (do first) | 10–15 real VN samples (3 receipts, 3 handwritten, 3 sheets…), measure amount accuracy per type | ~1 day |

---

## 7. Verdict

**Feasible, recommended via Option C (vision LLM + tool calling), without leaving Expo Go.** The output side already exists (multi-action replies + confirm per card). The open risk is accuracy on handwriting and on Vietnamese number formats — which is why the first step should be a one-day spike against real samples before writing the spec.

Next steps if approved:
1. Add a Feature-12 user story to `SRS.md` §6 ("Record transactions from an image").
2. Run the spike; record per-type accuracy here.
3. `/cook-ba` → `/cook-plan` for a dedicated `specs/ai-chat-image-capture/`.

Sources: [Groq — Images and Vision](https://console.groq.com/docs/vision) · [Groq — Tool Use](https://console.groq.com/docs/tool-use/overview)
