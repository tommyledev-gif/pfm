// Minimal, dependency-free .xlsx reader — just enough for
// scripts/seed-transactions.mjs to plan an import before uploading the file.
// Reads the way the backend importer (excelize) does: the FIRST sheet in
// workbook order, shared strings resolved, numbers left as their stored text.
// Not a general-purpose parser: no Zip64, no formulas, no dates-as-serials.
import { inflateRawSync } from "node:zlib";

const EOCD_SIGNATURE = 0x06054b50;
const EOCD_MIN_SIZE = 22;
const XML_ENTITIES = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };

/** Central-directory walk → Map of entry name to a lazy UTF-8 decoder. */
function readZipEntries(buffer) {
  let eocd = -1;
  // The end-of-central-directory record may be followed by a comment of up
  // to 64 KiB, so it is searched for backwards rather than read at a fixed
  // offset.
  const floor = Math.max(0, buffer.length - EOCD_MIN_SIZE - 0xffff);
  for (let i = buffer.length - EOCD_MIN_SIZE; i >= floor; i--) {
    if (buffer.readUInt32LE(i) === EOCD_SIGNATURE) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error("not a .xlsx file (no zip directory found)");

  const entries = new Map();
  const entryCount = buffer.readUInt16LE(eocd + 10);
  let p = buffer.readUInt32LE(eocd + 16);
  for (let n = 0; n < entryCount; n++) {
    const method = buffer.readUInt16LE(p + 10);
    const compressedSize = buffer.readUInt32LE(p + 20);
    const nameLength = buffer.readUInt16LE(p + 28);
    const extraLength = buffer.readUInt16LE(p + 30);
    const commentLength = buffer.readUInt16LE(p + 32);
    const localOffset = buffer.readUInt32LE(p + 42);
    const name = buffer.toString("utf8", p + 46, p + 46 + nameLength);
    // The LOCAL header's own name/extra lengths, not the central ones — the
    // two extra fields are allowed to differ.
    const dataStart =
      localOffset + 30 + buffer.readUInt16LE(localOffset + 26) + buffer.readUInt16LE(localOffset + 28);
    const raw = buffer.subarray(dataStart, dataStart + compressedSize);
    entries.set(name, () => (method === 0 ? raw : inflateRawSync(raw)).toString("utf8"));
    p += 46 + nameLength + extraLength + commentLength;
  }
  return entries;
}

function decodeXml(text) {
  return text.replace(/&(#x[0-9a-f]+|#\d+|\w+);/gi, (whole, ref) => {
    if (ref[0] !== "#") return XML_ENTITIES[ref] ?? whole;
    const hex = ref[1] === "x" || ref[1] === "X";
    return String.fromCodePoint(parseInt(ref.slice(hex ? 2 : 1), hex ? 16 : 10));
  });
}

function attr(attrs, name) {
  return new RegExp(`(?:^|\\s)${name}="([^"]*)"`).exec(attrs)?.[1];
}

// A string item is one <t> or several rich-text runs; phonetic hints (<rPh>)
// are not part of the cell's text.
function textOf(xml) {
  const runs = xml.replace(/<rPh\b[\s\S]*?<\/rPh>/g, "").matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g);
  return decodeXml([...runs].map((m) => m[1]).join(""));
}

function firstSheetPath(read) {
  const sheet = /<sheet\b([^>]*)>/.exec(read("xl/workbook.xml"));
  if (!sheet) throw new Error("workbook has no worksheets");
  const relId = attr(sheet[1], "r:id");
  for (const m of read("xl/_rels/workbook.xml.rels").matchAll(/<Relationship\b([^>]*)>/g)) {
    if (attr(m[1], "Id") !== relId) continue;
    const target = attr(m[1], "Target");
    return target.startsWith("/") ? target.slice(1) : `xl/${target}`;
  }
  throw new Error(`worksheet relationship ${relId} not found`);
}

/** "C12" → 2 */
function columnIndex(ref) {
  let index = 0;
  for (const ch of ref.replace(/\d+$/, "")) index = index * 26 + (ch.charCodeAt(0) - 64);
  return index - 1;
}

function cellText(type, inner, sharedStrings) {
  if (type === "inlineStr") return textOf(inner);
  const value = /<v>([\s\S]*?)<\/v>/.exec(inner)?.[1];
  if (value === undefined) return "";
  return type === "s" ? (sharedStrings[Number(value)] ?? "") : decodeXml(value);
}

/**
 * The first worksheet as `{ number, cells }` rows, header included. `number`
 * is the 1-based spreadsheet row — the same numbering the importer reports
 * its per-row errors in.
 */
export function readFirstSheetRows(buffer) {
  const entries = readZipEntries(buffer);
  const read = (name) => {
    const decode = entries.get(name);
    if (!decode) throw new Error(`.xlsx is missing ${name}`);
    return decode();
  };
  const sharedStrings = entries.has("xl/sharedStrings.xml")
    ? [...read("xl/sharedStrings.xml").matchAll(/<si\b[^>]*>([\s\S]*?)<\/si>/g)].map((m) => textOf(m[1]))
    : [];

  const rows = [];
  const sheet = read(firstSheetPath(read));
  for (const rowMatch of sheet.matchAll(/<row\b([^>]*?)(?:\/>|>([\s\S]*?)<\/row>)/g)) {
    const cells = [];
    let next = 0;
    for (const c of (rowMatch[2] ?? "").matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const ref = attr(c[1], "r");
      const col = ref ? columnIndex(ref) : next;
      next = col + 1;
      cells[col] = cellText(attr(c[1], "t"), c[2] ?? "", sharedStrings);
    }
    rows.push({
      number: Number(attr(rowMatch[1], "r")) || rows.length + 1,
      cells: Array.from(cells, (v) => v ?? ""),
    });
  }
  return rows;
}
