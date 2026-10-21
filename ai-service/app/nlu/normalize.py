"""Text normalization for free-text spending questions (query path only).

specs/ai-chat-query-spending/plan.md AIQ-T30, design brief §II.5.2. This is
new code, not shared: the transaction-recording path (/extract) is left
untouched on purpose — retrofitting it is a separate, riskier change that
needs its own regression set first (brief §II.5.1, P7-b).

The normalized form is what the question log keeps long-term (accent- and
pronoun-stripped, spec.md US-07) and what the phrase rules read
(intent_rules.py). The interpreter still receives the original wording alongside it:
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
    "hnay": "hom nay",
    "hqua": "hom qua",
    "hqa": "hom qua",
    "hum": "hom",
    # "hôm wa", "nhiều wa": "wa" is "qua"/"quá", identical once unaccented.
    "wa": "qua",
    "nhiu": "nhieu",
    "bnhiu": "bao nhieu",
    "r": "roi",
    # "nhiều hơn bth" — "bình thường" (usual), for "anything unusual" questions.
    "bth": "binh thuong",
}

# Informal "recently" phrasings all mean the last 30 days (brief §II.5.2
# step 7). Periods the product cannot resolve (e.g. relative to Tết) are left
# as-is so the interpreter reports them unsupported rather than guessing.
#
# ⚠️ Order matters: Southern "bữa nay" means today, but "mấy bữa nay" means
# "these past days". The longer phrase must be consumed first, or the today
# rule would rewrite its tail (plan.md R-F23).
#
# Regional "this"/"last" forms go first, so the rules after them see one
# spelling: Central "tháng nì", "bữa ni" → "nay"; "tuần rồi" (last week) →
# "trước"; Southern "bữa qua"/"bữa kia" → "hôm qua"/"hôm kia"; and a bare
# "nay" opening the question is Southern for "hôm nay" ("nay tiêu gì").
_TIME_ALIASES = (
    (re.compile(r"\b(thang|tuan|nam|hom|bua) ni\b"), r"\1 nay"),
    (re.compile(r"\b(thang|tuan) roi\b"), r"\1 truoc"),
    (re.compile(r"\b(bua h|bua gio|dao nay|may bua nay|gan day)\b"), "30 ngay qua"),
    (re.compile(r"\bbua nay\b"), "hom nay"),
    (re.compile(r"\bbua (qua|kia)\b"), r"hom \1"),
    (re.compile(r"^nay\b"), "hom nay"),
)

_THOUSAND = 1_000
_MILLION = 1_000_000

# 1tr5 → 1_500_000; the digit after "tr" is hundreds of thousands.
_TR_SHORTHAND = re.compile(r"\b(\d+)\s*tr(\d)\b")
# 1.5 trieu / 1,5 trieu / 2 trieu / 3 cu / 30m — "m" only glued to the digit.
_MILLIONS = re.compile(r"\b(\d+)(?:[.,](\d+))?(?:\s*(?:trieu|tr|cu)|m)\b")
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
