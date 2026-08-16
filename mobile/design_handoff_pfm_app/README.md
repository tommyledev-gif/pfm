# Handoff: PFM Mobile App (Noctis)

## Overview
Dark-theme personal finance management mobile app. Covers Home (net worth + wallets + recent transactions), Transactions (filterable list), Insights (Spending report + Budgets vs. actual), an AI chat that logs transactions from natural language, Notifications, and Profile. Feature set is aligned to an existing web app (wallets, transactions, categories, budgets, reports, notifications, AI chat, users) — see "Source of truth" below.

## About the design file
`PFM App.dc.html` is a **design reference**, not production code. It's a single self-contained HTML file (custom runtime, not React/Vue source) that renders the full interactive prototype — open it directly in a browser to see/click through the real thing. Treat it as the spec: recreate this UI and behavior in the target codebase's actual stack (the Next.js/React app the features come from) using its existing components, API hooks, and design system — do not copy the file's markup or runtime as-is.

Ignore the outer phone bezel / status bar chrome in the file (from a generic device-frame helper) — that's preview scaffolding, not part of the app UI.

## Fidelity
**High-fidelity.** Colors, type, spacing, icons, and states below are final; recreate pixel-close using the target codebase's component library (buttons, cards, lists) rather than one-off CSS, and its real data hooks in place of the hardcoded arrays described here.

## Source of truth for features
The prototype's IA was corrected to match an existing web app's pages: Wallets, Transactions, Categories, Budgets, Reports, Notifications, AI Chat (natural-language transaction entry), Users. Mobile screens map as:
- Home → aggregates Wallets + Transactions
- Transactions → Transactions page
- Insights → Reports (Spending tab) + Budgets (Budgets tab)
- AI Chat → AI Chat page (transaction-entry-by-description, not a Q&A bot)
- Notifications (opened from the bell) → Notifications page
- Profile → Wallets/Categories/Users management entry points + account

## Screens

### Home
- Header: app logo/wordmark (left), notification bell with unread dot (opens Notifications), avatar circle (opens Profile).
- Hero card: neon green (`#85FF33`) rounded-24px card. Label pill "Total Balance · All Wallets", big balance number (sum of all wallet balances, black text `#06130A`), an edit icon button and a full-width "Add Transaction" button (both black pill buttons, `#06130A` bg, green icon/text) — Add Transaction should open the AI chat / manual entry flow.
- "Your Wallets": horizontal scroll of wallet cards (name, type — Cash/Bank/E-wallet, balance), color dot per wallet type.
- "Recent Transactions": last 4 transactions, "See all" → Transactions screen. Row = icon circle (colored, initial letter) + name/time + amount (green if income, white if expense) + sub-label (category · wallet).

### Transactions
- Title, filter chips (All / Income / Expense — active chip green bg `#85FF33` + black text, inactive dark surface).
- Full transaction list, same row style as Home.

### Insights (bottom-nav bar-chart icon)
Two sub-tabs, underline-style, active = white text + green underline: **Spending** / **Budgets**.
- **Spending tab**: date-range label; two stat cards (Income / Expense) side by side; below, a card containing a donut chart (SVG, 5 category segments, center label shows category name + amount, defaults to "By Category" + total expense) — **segments and legend rows are clickable**: clicking a segment or its legend row highlights that segment (others fade to ~35% opacity) and swaps the center label to that category's name + $ amount; clicking the same one again deselects. Below the donut, a legend list per category: color dot, name, "$amount · pct%", thin colored progress bar.
- **Budgets tab**: "+ New budget" action (top right). List of budget cards, one per category: category name + status text (pct used, or "Over budget" in peach `#FF9E96` if spent > limit). Each card shows **two stacked horizontal bars** — "Budget" (muted `rgba(255,255,255,0.22)` fill) and "Actual" (category color, or peach if over) — both bars scaled against the same max (the largest limit across all budgets) so lengths are comparable, with the dollar value right-aligned next to each bar.

### AI Chat
- Center-aligned header: sparkle icon (mint `#7EEBC0`) + "Noctis AI".
- Chat thread: user messages = lavender (`#B49AFF`) bubble, right-aligned, dark text. AI messages = dark surface bubble, left-aligned, white text. When the AI parses a transaction from the user's text, it renders a **transaction card** inside its bubble: merchant name + amount (top row), two pill tags (category, wallet), and a full-width green "Confirm & Save" button. Typing indicator = 3 pulsing dots.
- Input bar: floating pill above the bottom nav, rounded input + circular green send button. Enter key or send button both submit.
- Behavior to implement for real: parse the free-text description into {merchant, amount, category, wallet} (via an LLM call or the web app's existing parser), show the card, and on confirm create the transaction via the existing API.

### Notifications (opened via bell icon, not a nav tab)
- Header: back chevron, "Notifications" title, "Show unread only" toggle button (pill, green when active) — mirrors the web app's exact toggle.
- Grouped by day ("Today", "Yesterday", etc). Each row: colored icon circle, title + timestamp, body text. Unread rows get a 3px green left border. Toggling "unread only" filters the list client-side.

### Profile
- Avatar, name, email, centered.
- 3 stat cards: Net Worth, Income (period), Expense (period) — all derived, not hardcoded input.
- Settings rows: Wallets, Categories, Household Members (maps to the web app's invite-only Users feature), Security, Help & Support — each a plain row with icon + label + chevron. "Log out" row styled in peach at the bottom.

## Design tokens
- Background (device): near-black `#000`/`#050B14` (obsidian).
- Surface card: `#12161F`, border `1px solid rgba(255,255,255,0.07–0.08)`.
- Text: primary `#F5F6F8`, secondary `rgba(255,255,255,0.4–0.55)`.
- Accent — Neon green: `#85FF33` (primary actions, active nav, active tab, active filter chip). Text-on-green: `#06130A`.
- Accent — Lavender: `#B49AFF` (user chat bubble, one wallet/avatar color).
- Accent — Mint: `#7EEBC0` (AI icon, positive amounts, one category/wallet color).
- Accent — Peach: `#FF9E96` (expense totals, over-budget state, log out).
- Accent — Mustard: `#F2C94C`, Accent — Periwinkle: `#9FB3FF` (category/budget colors).
- Corner radius: 24px cards/hero, 16–20px list cards, pill/full round for buttons and nav.
- Typography: Inter, weights 400/500/600/700/800. Numbers/headers bold-to-800; labels/secondary text 400–600 at 11–13px.
- Bottom nav: floating pill (`rgba(15,17,22,0.72)`, `backdrop-filter: blur(16px)`, 1px white/8% border), 4 icons evenly spaced with a small 5px green dot under the active icon; a raised 60px green circular button, centered, overlapping the top edge of the pill, always visible, opens AI Chat.

## Interactions summary
- Bottom nav: Home / Transactions / Insights / Profile in the pill; AI Chat via the raised center circle.
- Bell icon → full-screen Notifications overlay (back chevron returns).
- Transactions filter chips, Insights sub-tab switch, donut segment/legend selection, unread-only toggle — all client-side state swaps, no page nav.
- AI chat: type → send (button or Enter) → user bubble appears instantly → typing indicator (~1.3s) → AI reply with transaction card.

## Assets
No external images — avatars are colored circles with initials (placeholder for real user/contact photos); no icon font, all icons are minimal inline SVGs (rects/circles/simple line paths).

## Files
- `PFM App.dc.html` — full interactive prototype (open in any browser).
