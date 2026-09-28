# Groq token baseline — free-text consult

Closes `AIQ-T01` in `specs/ai-chat-query-spending/plan.md` (see R-F19, R-F27). Measured 2026-09-28 from inside the production `pfm-ai-service-container`, using the production key and prompt.

## Provider limit

| Item | Value |
|---|---|
| Model | `openai/gpt-oss-120b` (a reasoning model) |
| Service tier | `on_demand` (free) |
| Tokens per minute | **8,000 for the whole organisation**. Consult and recording (`/extract`) share it, and every key in the org shares it too |
| Charged per consult call | about 1.9–2.1k tokens (prompt plus the output reservation `max_tokens`) |

## Output by configuration

Question: "hôm nay tiêu những gì". Same prompt and schema in every run.

| `max_tokens` | `reasoning_effort` | Result | Reasoning tokens | Output tokens |
|---|---|---|---|---|
| 400 | default | ❌ 400 `tool_use_failed` (truncated JSON, or no tool call) | — | — |
| 2000 | default | ✅ | 291–376 | 377–462 |
| 400 | low | ✅ | 122–186 | 208–272 |

"hay tiêu vào thứ mấy" at 400 / default passed once (reasoning 162, output 231). In production it had failed twice, so the default effort sits right at the edge.

## Settings derived from this

| Setting | Value | Why |
|---|---|---|
| `consult_reasoning_effort` (ai-service) | `low` | Keeps the tool call inside the cap |
| `consult_max_tokens` (ai-service) | 600 | About 2× the largest low-effort output measured. Kept small because Groq charges the reservation against the TPM limit |
| `ConsultTokenBudgetPerMinute` (backend) | 6,800 | 8,000 × (100 − 15) / 100: the brief's §13.1 share kept for recording |

The backend records *used* tokens, while Groq charges *reserved* ones. The budget therefore under-counts real consumption by roughly the unused part of the reservation, so a provider 429 can still arrive before the backend's own guard trips. That still ends in a degraded reply, which is the correct outcome for a real capacity limit.

## Open

Capacity for real use (spec Open Question #8): the free tier allows roughly 4 questions a minute across all Users. Options are a separate Groq org for consult, a paid tier, or accepting the limit. That is an owner decision.
