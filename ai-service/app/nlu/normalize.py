"""Text normalization for free-text spending questions (query path only).

specs/ai-chat-query-spending/plan.md AIQ-T30, design brief §II.5.2. This is
new code, not shared: the transaction-recording path (/extract) is left
untouched on purpose — retrofitting it is a separate, riskier change that
needs its own regression set first (brief §II.5.1, P7-b).

The normalized form is what the question log keeps long-term (accent- and
pronoun-stripped, spec.md US-07) and what a future regex fast path would
match. The interpreter still receives the original wording alongside it:
Vietnamese without diacritics is ambiguous, and the original is the richer
signal.
"""

import re
import unicodedata

# Pronouns are safe to drop: every question is implicitly about the signed-in
# User. Matched as whole words only, after lowercasing and before accents are
# removed, so "tớ" is dropped but the adjective "to" (big) is not.
_PRONOUNS_ACCENTED = ("tôi", "tui", "tao", "mình", "tớ", "em")
_PRONOUNS_PLAIN = ("toi", "tui", "tao", "minh", "mk", "t")

# Teencode → plain words, applied to accentless text. "k" is handled
# separately because after a digit it means "thousand".
_TEENCODE = {
    "bn": "bao nhieu",
    "bnh": "bao nhieu",
    "ntn": "nhu the nao",
    "tiu": "tieu",
    "dc": "duoc",
    "ko": "khong",
    "k0": "khong",
    "kh": "khong",
    "hok": "khong",
    "j": "gi",
    "vs": "voi",
    "thg": "thang",
    "t2": "thu hai",
}

# Informal "recently" phrasings all mean the last 30 days (brief §II.5.2
# step 7). Periods the product cannot resolve (e.g. relative to Tết) are left
# as-is so the interpreter reports them unsupported rather than guessing.
_TIME_ALIASES = (
    (re.compile(r"\b(bua h|bua gio|dao nay|may bua nay|gan day)\b"), "30 ngay qua"),
)

_THOUSAND = 1_000
_MILLION = 1_000_000

# 1tr5 → 1_500_000; the digit after "tr" is hundreds of thousands.
_TR_SHORTHAND = re.compile(r"\b(\d+)\s*tr(\d)\b")
# 1.5 trieu / 1,5 trieu / 2 trieu / 3 cu
_MILLIONS = re.compile(r"\b(\d+)(?:[.,](\d+))?\s*(?:trieu|tr|cu)\b")
# 500 nghin / 500 ngan / 50k — "k" counts as thousand only right after a digit.
_THOUSANDS = re.compile(r"\b(\d+)(?:[.,](\d+))?\s*(?:nghin|ngan|k)\b")
_WHITESPACE = re.compile(r"\s+")


def unaccent(text: str) -> str:
    """Strips Vietnamese diacritics; đ/Đ are separate letters, not accents."""
    text = text.replace("đ", "d").replace("Đ", "D")
    decomposed = unicodedata.normalize("NFD", text)
    return "".join(ch for ch in decomposed if unicodedata.category(ch) != "Mn")


def normalize(text: str) -> str:
    """Returns the canonical accentless form of a question."""
    text = _WHITESPACE.sub(" ", text.strip()).lower()
    text = _drop_words(text, _PRONOUNS_ACCENTED)
    text = unaccent(text)
    text = _drop_words(text, _PRONOUNS_PLAIN)
    text = _normalize_amounts(text)
    text = _expand_teencode(text)
    for pattern, replacement in _TIME_ALIASES:
        text = pattern.sub(replacement, text)
    return _WHITESPACE.sub(" ", text).strip()


def _drop_words(text: str, words: tuple[str, ...]) -> str:
    return " ".join(w for w in text.split(" ") if w not in words)


def _expand_teencode(text: str) -> str:
    out = []
    for word in text.split(" "):
        if word == "k":  # a bare "k" (not after a digit — amounts ran first) means "không"
            out.append("khong")
        else:
            out.append(_TEENCODE.get(word, word))
    return " ".join(out)


def _normalize_amounts(text: str) -> str:
    text = _TR_SHORTHAND.sub(lambda m: str(int(m.group(1)) * _MILLION + int(m.group(2)) * _MILLION // 10), text)
    text = _MILLIONS.sub(lambda m: str(_scaled(m.group(1), m.group(2), _MILLION)), text)
    return _THOUSANDS.sub(lambda m: str(_scaled(m.group(1), m.group(2), _THOUSAND)), text)


def _scaled(whole: str, fraction: str | None, unit: int) -> int:
    """Integer-only scaling (no float anywhere on a money path): "1,5" × 1e6
    → 1 × 1e6 + 5 × 1e6 / 10."""
    value = int(whole) * unit
    if fraction:
        value += int(fraction) * unit // (10 ** len(fraction))
    return value
