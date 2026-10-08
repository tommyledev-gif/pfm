#!/usr/bin/env python3
"""Lint locale JSON của Budgest/PFM: bắt "mùi AI" và lỗi i18n cơ học.

Dùng:
    python scripts/lint_copy.py locales/                 # quét thư mục
    python scripts/lint_copy.py locales/vi.json locales/en.json
    python scripts/lint_copy.py locales/ --strict        # WARN cũng làm fail
    python scripts/lint_copy.py locales/ --allow-particles

Cấu trúc file được nhận diện:
    locales/vi.json, locales/en.json            (1 file/ngôn ngữ)
    locales/vi/common.json, locales/en/common.json   (namespace)

Exit code: 1 nếu có ERROR (hoặc WARN khi --strict), ngược lại 0.

Giới hạn đã biết: hiểu placeholder {{var}} (i18next) và {var}; ICU plural lồng
nhau chưa được parse. Lint chỉ bắt được dấu hiệu bề mặt; không thay cho việc
đọc lại copy bằng mắt.
"""
from __future__ import annotations

import argparse
import json
import re
import sys
import unicodedata
from collections import defaultdict
from pathlib import Path

VI_DIACRITICS = set(
    "àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ"
)
PLURAL_RE = re.compile(r"^(?P<base>.+)_(?P<cat>zero|one|two|few|many|other)$")
EMOJI_RE = re.compile("[\U0001F300-\U0001FAFF\u2600-\u27BF\u2B50\u2B55\uFE0F]")
PH_I18N = re.compile(r"\{\{\s*([\w.]+)[^}]*\}\}")
PH_ICU = re.compile(r"(?<!\{)\{\s*([\w.]+)[^{}]*\}(?!\})")
TAG_RE = re.compile(r"</?(\w+)>")

# Giới hạn độ dài theo slot (từ khóa ở cuối segment cuối của key). VI: âm tiết, EN: từ.
SLOT_LIMITS = {
    "button": 4, "cta": 4, "tab": 2, "chip": 7, "label": 5, "title": 7,
    "placeholder": 8, "toast": 8, "hint": 20, "helper": 20,
    "body": 30, "message": 30, "description": 30,
}
SHORT_SLOTS = {"button", "cta", "tab", "chip", "label", "title", "placeholder", "toast"}

# (id, level, regex, message). Regex chạy với re.IGNORECASE.
VI_RULES = [
    ("em-dash", "ERROR", r"—", "Dấu gạch dài (—) là dấu hiệu AI. Dùng dấu chấm hoặc hai chấm, hoặc tách câu."),
    ("emoji", "ERROR", None, "Emoji không có trong UI copy."),
    ("exclaim-multi", "ERROR", r"!.*!|!!", "Nhiều dấu '!' trong một chuỗi."),
    ("exclaim", "WARN", r"!", "Dấu '!' làm giọng giống quảng cáo. Bỏ nếu không phải cảnh báo thật."),
    ("chatbot-opener", "ERROR", r"^\s*(chắc chắn rồi|tất nhiên|dưới đây là|tuyệt vời|rất vui)", "Mở bài kiểu chatbot. Đi thẳng vào dữ kiện."),
    ("chatbot-closer", "ERROR", r"(hy vọng (điều )?này|cần (gì|thêm).{0,30}(hỏi|cho mình biết|liên hệ))", "Kết bài kiểu chatbot. Bỏ."),
    ("particle", "ERROR", r"\b(nhé|nha|nhỉ|nè|ạ)\s*[.!?…]*$", "Particle cuối câu (nhé/nha/ạ). Mặc định cấm; xem vi-style.md mục 3."),
    ("vui-long", "ERROR", r"\bvui lòng\b", "'Vui lòng' là filler lịch sự. Dùng động từ trực tiếp."),
    ("sorry", "ERROR", r"(rất tiếc|xin lỗi vì sự bất tiện|chúng tôi xin lỗi)", "Xin lỗi dài. Nói lỗi gì và làm gì."),
    ("oops", "ERROR", r"\b(oops|ooops|úi|ôi)\b", "'Oops/Ôi' trong lỗi: giảm độ tin cậy với app tiền."),
    ("hay-cung", "ERROR", r"\bhãy cùng\b", "'Hãy cùng' là giọng quảng cáo."),
    ("quy-khach", "ERROR", r"\bquý (khách|vị)\b", "Bỏ xưng hô trang trọng; dùng câu bỏ chủ ngữ."),
    ("khong-chi-ma-con", "ERROR", r"không chỉ.{1,60}mà còn", "Cấu trúc 'không chỉ... mà còn...' là mùi AI. Nói thẳng điều có."),
    ("fluff-strong", "ERROR", r"(hành trình|đồng hành|nâng tầm|bứt phá|đột phá|kiến tạo|làm chủ tài chính|tự do tài chính|tương lai tài chính)", "Từ marketing rỗng."),
    ("fluff-weak", "WARN", r"(thông minh|tối ưu|toàn diện|mượt mà|tiện lợi|dễ dàng|nhanh chóng|hiệu quả|chuyên nghiệp|khám phá|trải nghiệm)", "Từ marketing: thay bằng con số hoặc việc cụ thể, hoặc bỏ."),
    ("mot-cach", "WARN", r"\bmột cách\b", "'một cách + tính từ': bỏ hoặc đổi thành động từ."),
    ("giup-ban", "WARN", r"(để giúp bạn|giúp bạn|cho phép bạn)", "Nói app làm gì, không nói app 'giúp'."),
    ("du-ban-la", "WARN", r"\bdù bạn là\b", "'Dù bạn là... hay...' là mùi AI."),
    ("ban-co-the", "WARN", r"^\s*(bạn có thể|hãy)\b", "Bỏ 'Bạn có thể/Hãy', dùng động từ trực tiếp."),
    ("thanh-cong", "WARN", r"thành công", "'Thành công' thường thừa: 'Đã lưu' là đủ."),
    ("da-duoc", "WARN", r"\bđã được\b", "Bị động kiểu dịch: 'Đã tạo' thay cho 'Đã được tạo'."),
    ("formal-verb", "WARN", r"\b(thực hiện|tiến hành|khởi tạo|thao tác|điều chỉnh|tiêu chí)\b", "Từ hành chính/danh hóa. Dùng động từ thường: làm/tạo/mở/đổi/xóa."),
    ("de-co-the", "WARN", r"\bđể có thể\b", "'để có thể' thường thừa: bỏ 'có thể'."),
    ("hoac-two-actions", "WARN", r"\bhoặc\b", "'hoặc' trong chuỗi dài thường nối 2 hành động: giữ 1 hành động, đẩy cái kia thành nút/link."),
    ("self-ref", "WARN", r"\b(mình|tụi mình|chúng mình)\b", "App tự xưng 'mình'. Mặc định bỏ chủ ngữ (glossary, quyết định còn mở #5). Chip là lời user thì bỏ qua."),
    ("chung-toi", "WARN", r"\bchúng tôi\b", "App không tự xưng 'chúng tôi' trong UI."),
    ("he-thong", "WARN", r"\b(hệ thống|sự cố)\b", "Jargon/né tránh. Nói cái gì không làm được."),
    ("generic-error", "WARN", r"^\s*(đã xảy ra lỗi|có lỗi xảy ra|đã có lỗi|lỗi hệ thống)\W*$", "Lỗi trơn không nói gì. Nói việc gì chưa làm được và làm gì tiếp (fallback errors.unknown thì bỏ qua)."),
    ("money-literal", "ERROR", r"\d[\d.,]*\s?(₫|đ\b|vnđ|vnd)", "Hardcode tiền trong chuỗi. Format bằng Intl rồi truyền placeholder."),
    ("date-literal", "WARN", r"\b\d{1,2}/\d{1,2}(/\d{2,4})?\b", "Hardcode ngày. Format bằng Intl.DateTimeFormat."),
    ("spaced-hyphen", "WARN", r"\s-\s", "Gạch nối có khoảng trắng dùng như dấu gạch dài. Tách thành 2 câu."),
    ("mid-ellipsis", "WARN", r"\.\.\.\s*\S", "'...' giữa câu. Chỉ dùng ở placeholder/đang tải, ở cuối chuỗi."),
]

EN_RULES = [
    ("em-dash", "ERROR", r"—", "Em dash reads as AI. Use a period, colon, or split the sentence."),
    ("emoji", "ERROR", None, "No emoji in UI copy."),
    ("exclaim-multi", "ERROR", r"!.*!|!!", "Multiple '!' in one string."),
    ("exclaim", "WARN", r"!", "'!' reads like marketing. Drop unless it's a real warning."),
    ("chatbot-opener", "ERROR", r"^\s*(sure|certainly|absolutely|great|here'?s|here is|of course)\b", "Chatbot opener. Start with the data."),
    ("chatbot-closer", "ERROR", r"(hope (this|that) helps|let me know if|feel free to)", "Chatbot closer. Remove."),
    ("oops", "ERROR", r"\b(oops|whoops|uh[- ]oh)\b", "'Oops' weakens trust in a money app."),
    ("sorry", "WARN", r"\b(sorry|apologi[sz]e)\b", "Long apologies. Say what failed and what to do."),
    ("please", "WARN", r"^\s*please\b", "Drop leading 'Please'; use the imperative."),
    ("lets", "WARN", r"^\s*let'?s\b", "'Let's' is chatty marketing."),
    ("fluff-strong", "ERROR", r"\b(journey|seamless(ly)?|effortless(ly)?|empower(s|ing)?|elevate|unlock|supercharge|delve|leverage|streamline|revolutioni[sz]e)\b", "Marketing/AI vocabulary."),
    ("fluff-weak", "WARN", r"\b(smart|powerful|robust|intuitive|easily|simply|effective(ly)?|comprehensive|insights?)\b", "Vague adjectives. Use a number or a concrete action."),
    ("successfully", "WARN", r"\bsuccessfully\b", "'Successfully' is redundant: 'Saved' is enough."),
    ("not-only", "ERROR", r"not only.{1,60}but (also)?", "'Not only... but also...' is an AI tell."),
    ("you-can", "WARN", r"^\s*you can\b", "Lead with the verb, not 'You can'."),
    ("money-literal", "ERROR", r"[\d][\d.,]*\s?(₫|vnđ|vnd|usd|\$)|[\$₫]\s?\d", "Hardcoded money. Format with Intl and pass a placeholder."),
    ("date-literal", "WARN", r"\b\d{1,2}/\d{1,2}(/\d{2,4})?\b", "Hardcoded date. Use Intl.DateTimeFormat."),
    ("spaced-hyphen", "WARN", r"\s-\s", "Spaced hyphen used as a dash. Split into two sentences."),
    ("mid-ellipsis", "WARN", r"\.\.\.\s*\S", "Mid-sentence '...'. Only for placeholders/loading, at the end."),
]


class Issue:
    def __init__(self, level, file, key, rule, msg, text=""):
        self.level, self.file, self.key, self.rule, self.msg, self.text = level, file, key, rule, msg, text

    def __str__(self):
        t = f'  "{self.text}"' if self.text else ""
        return f"{self.level:5} {self.file}  {self.key}  [{self.rule}] {self.msg}{t}"


def flatten(data, prefix=""):
    out = {}
    if isinstance(data, dict):
        for k, v in data.items():
            key = f"{prefix}.{k}" if prefix else str(k)
            if isinstance(v, dict):
                out.update(flatten(v, key))
            elif isinstance(v, str):
                out[key] = v
    return out


def detect(path: Path, langs):
    stem = path.stem.split("-")[0].lower()
    if stem in langs:
        return stem, ""
    parent = path.parent.name.split("-")[0].lower()
    if parent in langs:
        return parent, path.stem
    return None, None


def placeholders(s: str):
    names = set(PH_I18N.findall(s))
    rest = PH_I18N.sub("", s)
    names |= set(PH_ICU.findall(rest))
    return names, set(TAG_RE.findall(s))


def group_plurals(flat):
    groups = defaultdict(dict)
    for k, v in flat.items():
        m = PLURAL_RE.match(k)
        if m:
            groups[m["base"]][m["cat"]] = v
        else:
            groups[k][None] = v
    return groups


def slot_of(key: str):
    seg = PLURAL_RE.sub(lambda m: m["base"], key).split(".")[-1].lower()
    for slot in SLOT_LIMITS:
        if seg == slot or seg.endswith("_" + slot) or seg.endswith(slot.capitalize().lower()):
            return slot
    return None


def is_meta_key(key: str):
    return any(seg.startswith("_") for seg in key.split("."))


def count_units(s: str):
    s = PH_I18N.sub("X", s)
    return len([w for w in re.split(r"\s+", s.strip()) if w])


def lint_string(lang, file, key, text, args):
    issues = []
    rules = VI_RULES if lang == "vi" else EN_RULES

    if text != text.strip() or "  " in text:
        issues.append(Issue("ERROR", file, key, "whitespace", "Khoảng trắng thừa đầu/cuối hoặc 2 dấu cách liên tiếp.", text))
    if unicodedata.normalize("NFC", text) != text:
        issues.append(Issue("ERROR", file, key, "nfc", "Chuỗi không phải Unicode NFC (dấu tổ hợp). Chuẩn hóa NFC.", text))

    for rid, level, pattern, msg in rules:
        if rid == "particle" and args.allow_particles:
            continue
        if rid == "emoji":
            if EMOJI_RE.search(text):
                issues.append(Issue(level, file, key, rid, msg, text))
            continue
        if re.search(pattern, text, re.IGNORECASE):
            # 'exclaim' WARN trùng với exclaim-multi ERROR: không báo hai lần
            if rid == "exclaim" and re.search(r"!.*!|!!", text):
                continue
            # lỗi generic là fallback hợp lệ cho key errors.unknown
            if rid == "generic-error" and "unknown" in key.lower():
                continue
            # 'hoặc' chỉ đáng báo khi chuỗi đủ dài để chứa 2 hành động
            if rid == "hoac-two-actions" and count_units(text) < 10:
                continue
            # chip là lời của user (role-play): 'mình' là đúng giọng
            if rid == "self-ref" and slot_of(key) == "chip":
                continue
            issues.append(Issue(level, file, key, rid, msg, text))

    if lang == "vi":
        letters_words = [w for w in re.split(r"\s+", PH_I18N.sub("", text)) if re.search(r"[A-Za-zÀ-ỹ]", w)]
        if len(letters_words) >= 4 and not any(c in VI_DIACRITICS for c in text.lower()):
            issues.append(Issue("ERROR", file, key, "no-diacritics", "Chuỗi VI dài mà không có chữ có dấu: có thể đã mất dấu.", text))

    slot = slot_of(key)
    if slot:
        units = count_units(text)
        limit = SLOT_LIMITS[slot]
        if units > limit:
            issues.append(Issue("WARN", file, key, "length", f"{units} đơn vị > ~{limit} cho slot '{slot}'. Cắt hoặc tách ý.", text))
        if slot in SHORT_SLOTS and text.rstrip().endswith(".") and not text.rstrip().endswith("..."):
            issues.append(Issue("WARN", file, key, "trailing-period", f"Slot '{slot}' là cụm từ: không chấm cuối.", text))
    return issues


def lint_parity(ns, by_lang, primary, args):
    """So khớp key, placeholder, plural giữa các ngôn ngữ trong cùng namespace."""
    issues = []
    groups = {lang: group_plurals(flat) for lang, (_, flat) in by_lang.items()}
    files = {lang: str(path.name if not ns else f"{path.parent.name}/{path.name}") for lang, (path, _) in by_lang.items()}

    all_bases = set().union(*[set(g) for g in groups.values()]) if groups else set()
    for base in sorted(all_bases):
        if is_meta_key(base):
            continue
        present = [l for l in groups if base in groups[l]]
        for lang in groups:
            if base not in groups[lang]:
                issues.append(Issue("ERROR", files[lang], base, "missing-key", f"Thiếu key (có ở: {', '.join(present)})."))
        if len(present) < 2:
            continue

        # plural
        for lang in present:
            cats = {c for c in groups[lang][base] if c}
            if not cats:
                continue
            if lang == "vi" and cats - {"other"}:
                issues.append(Issue("ERROR", files[lang], base, "plural-vi", f"VI chỉ có category 'other' (CLDR). Đang có: {sorted(cats)}."))
            if lang == "en" and not {"one", "other"} <= cats:
                issues.append(Issue("ERROR", files[lang], base, "plural-en", f"EN cần cả '_one' và '_other'. Đang có: {sorted(cats)}."))

        # placeholder + tag parity, so sánh bản 'other' (hoặc bản duy nhất)
        def pick(lang):
            g = groups[lang][base]
            return g.get(None) or g.get("other") or next(iter(g.values()))

        ref_lang = primary if primary in present else present[0]
        ref_ph, ref_tags = placeholders(pick(ref_lang))
        for lang in present:
            if lang == ref_lang:
                continue
            ph, tags = placeholders(pick(lang))
            if ph != ref_ph:
                issues.append(Issue("ERROR", files[lang], base, "placeholder-mismatch",
                                    f"Placeholder khác {ref_lang}: {sorted(ph)} vs {sorted(ref_ph)}."))
            if tags != ref_tags:
                issues.append(Issue("ERROR", files[lang], base, "tag-mismatch",
                                    f"Thẻ <Trans> khác {ref_lang}: {sorted(tags)} vs {sorted(ref_tags)}."))
    return issues


def collect(paths, langs):
    found = defaultdict(dict)  # ns -> lang -> (path, flat)
    for p in map(Path, paths):
        files = [p] if p.is_file() else sorted(p.rglob("*.json"))
        for f in files:
            lang, ns = detect(f, langs)
            if not lang:
                continue
            try:
                data = json.loads(f.read_text(encoding="utf-8"))
            except json.JSONDecodeError as e:
                print(f"ERROR {f}: JSON không hợp lệ: {e}", file=sys.stderr)
                sys.exit(2)
            found[ns][lang] = (f, flatten(data))
    return found


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("paths", nargs="+")
    ap.add_argument("--langs", default="vi,en", help="Danh sách ngôn ngữ, ngôn ngữ đầu là primary (mặc định vi,en)")
    ap.add_argument("--strict", action="store_true", help="WARN cũng làm fail")
    ap.add_argument("--allow-particles", action="store_true", help="Cho phép nhé/nha/ạ (chỉ khi brief bề mặt đó yêu cầu)")
    args = ap.parse_args()

    langs = [l.strip().lower() for l in args.langs.split(",") if l.strip()]
    primary = langs[0]
    found = collect(args.paths, set(langs))
    if not found:
        print("Không tìm thấy file locale nào khớp --langs.", file=sys.stderr)
        sys.exit(2)

    issues = []
    for ns, by_lang in found.items():
        for lang, (path, flat) in by_lang.items():
            fname = path.name if not ns else f"{path.parent.name}/{path.name}"
            for key, text in flat.items():
                if is_meta_key(key):
                    continue
                issues.extend(lint_string(lang if lang in ("vi", "en") else "en", fname, key, text, args))
        if len(by_lang) > 1:
            issues.extend(lint_parity(ns, by_lang, primary, args))

    order = {"ERROR": 0, "WARN": 1}
    issues.sort(key=lambda i: (order[i.level], i.file, i.key))
    for i in issues:
        print(i)

    errors = sum(1 for i in issues if i.level == "ERROR")
    warns = sum(1 for i in issues if i.level == "WARN")
    print(f"\n{errors} ERROR, {warns} WARN")
    sys.exit(1 if errors or (args.strict and warns) else 0)


if __name__ == "__main__":
    main()
