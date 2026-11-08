// 非公開の「統合管理台帳」(Google スプレッドシート)を、ブラウザを使わずに読むための変換。
// 週次の分析タスクは、Google Drive のコネクタで .xlsx を書き出し(download_file_content)、
// その保存先のファイルを、このスクリプトで JSON に変える。予定タスクは、ブラウザの操作に毎回の承認が要るため、
// 人がいない時刻でも止まらないように、ブラウザを使わない読み方にしている。
//
// 使い方: node scripts/xlsx-to-json.mjs <入力> [出力.json]
//   入力: .xlsx か、コネクタの結果を保存したファイル({ content: base64, ... } の JSON)
//   出力: 省略時は analytics/sheet.json(非公開。.gitignore 済み)
// 出力の形: { "exportedAt": ISO, "sheets": { "シート名": [ { 見出し: 値, ... }, ... ] } }
//   1 行目を見出しにする。空の行は除く。空のセルは null(0 にしない)。日付の書式のセルは "YYYY-MM-DD"(時刻があれば " HH:MM:SS")。
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { inflateRawSync } from "node:zlib";

/** zip の中のファイルを、名前 → Buffer で返す(中央ディレクトリを読む。圧縮なし・deflate のみ) */
export function unzip(buf) {
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65557); i--) if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  if (eocd < 0) throw new Error("zip ではありません(xlsx として読めません)");
  const count = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);
  const files = {};
  for (let n = 0; n < count; n++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) throw new Error("zip の目次が壊れています");
    const method = buf.readUInt16LE(p + 10), size = buf.readUInt32LE(p + 20);
    const nameLen = buf.readUInt16LE(p + 28), extraLen = buf.readUInt16LE(p + 30), commentLen = buf.readUInt16LE(p + 32);
    const local = buf.readUInt32LE(p + 42);
    const name = buf.toString("utf8", p + 46, p + 46 + nameLen);
    const start = local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28);
    const raw = buf.subarray(start, start + size);
    if (method === 0) files[name] = raw;
    else if (method === 8) files[name] = inflateRawSync(raw);
    p += 46 + nameLen + extraLen + commentLen;
  }
  return files;
}

const unesc = (s) => s.replace(/&(lt|gt|amp|quot|apos|#\d+|#x[0-9a-f]+);/gi, (_, e) =>
  ({ lt: "<", gt: ">", amp: "&", quot: '"', apos: "'" })[e] ?? String.fromCodePoint(e[1].toLowerCase() === "x" ? parseInt(e.slice(2), 16) : +e.slice(1)));
const textOf = (xml) => [...xml.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>|<t(?:\s[^>]*)?\/>/g)].map((m) => unesc(m[1] ?? "")).join("");
const attr = (tag, name) => tag.match(new RegExp(`\\s${name}="([^"]*)"`))?.[1];
const colIndex = (ref) => { let n = 0; for (const c of ref.match(/^[A-Z]+/)[0]) n = n * 26 + (c.charCodeAt(0) - 64); return n - 1; };

/** 日付の書式か(組み込みの 14〜22・45〜47、または y・d を含む独自の書式) */
function dateStyles(stylesXml) {
  if (!stylesXml) return new Set();
  const custom = {};
  for (const m of stylesXml.matchAll(/<numFmt\s[^>]*>/g)) custom[attr(m[0], "numFmtId")] = unesc(attr(m[0], "formatCode") ?? "");
  const isDate = (id) => (id >= 14 && id <= 22) || (id >= 45 && id <= 47) || /[yd]/i.test((custom[id] ?? "").replace(/"[^"]*"|\[[^\]]*\]/g, ""));
  const xfs = stylesXml.match(/<cellXfs[^>]*>([\s\S]*?)<\/cellXfs>/)?.[1] ?? "";
  const out = new Set();
  [...xfs.matchAll(/<xf\s[^>]*?\/?>/g)].forEach((m, i) => { if (isDate(+attr(m[0], "numFmtId"))) out.add(i); });
  return out;
}
/** Excel の日付の通し番号 → "YYYY-MM-DD"(時刻があれば " HH:MM:SS") */
export function serialToText(v) {
  const ms = Math.round((v - 25569) * 864e5);
  const iso = new Date(ms).toISOString();
  return iso.slice(11, 19) === "00:00:00" ? iso.slice(0, 10) : `${iso.slice(0, 10)} ${iso.slice(11, 19)}`;
}

/** xlsx の Buffer → { シート名: 行の配列(各行はセルの配列) } */
export function readXlsx(buf) {
  const f = unzip(buf);
  const str = (n) => f[n]?.toString("utf8");
  const shared = [...(str("xl/sharedStrings.xml") ?? "").matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) => textOf(m[1]));
  const dates = dateStyles(str("xl/styles.xml"));
  const rels = Object.fromEntries([...(str("xl/_rels/workbook.xml.rels") ?? "").matchAll(/<Relationship\s[^>]*>/g)].map((m) => [attr(m[0], "Id"), attr(m[0], "Target")]));
  const sheets = {};
  for (const m of (str("xl/workbook.xml") ?? "").matchAll(/<sheet\s[^>]*>/g)) {
    const name = unesc(attr(m[0], "name"));
    const target = rels[attr(m[0], "r:id")]?.replace(/^\/?(xl\/)?/, "xl/");
    const xml = target && str(target);
    if (!xml) continue;
    const rows = [];
    for (const r of xml.matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g)) {
      const cells = [];
      for (const c of r[1].matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
        const tag = c[1], body = c[2] ?? "";
        const ref = attr(tag, "r"), t = attr(tag, "t"), s = +(attr(tag, "s") ?? 0);
        const v = body.match(/<v>([\s\S]*?)<\/v>/)?.[1];
        let val = null;
        if (t === "s") val = v == null ? null : shared[+v] ?? null;
        else if (t === "inlineStr") val = textOf(body);
        else if (t === "str" || t === "e") val = v == null ? null : unesc(v);
        else if (t === "b") val = v === "1";
        else if (v != null && v !== "") val = dates.has(s) ? serialToText(+v) : +v;
        if (val === "") val = null;
        cells[ref ? colIndex(ref) : cells.length] = val;
      }
      rows.push(Array.from(cells, (x) => x ?? null));
    }
    sheets[name] = rows;
  }
  return sheets;
}

/** 1 行目を見出しにして、行をオブジェクトにする。空の行は除く */
export function toRecords(rows) {
  const head = (rows[0] ?? []).map((h, i) => (h == null || h === "" ? `col${i + 1}` : String(h)));
  return rows.slice(1).filter((r) => r.some((x) => x != null)).map((r) => Object.fromEntries(head.map((h, i) => [h, r[i] ?? null])));
}

/** 入力(xlsx か、コネクタの結果の JSON)を Buffer にする */
export function loadInput(path) {
  const buf = readFileSync(path);
  if (buf.readUInt32LE(0) === 0x04034b50) return buf;
  const text = buf.toString("utf8").trim();
  let content = text;
  try { const j = JSON.parse(text); content = j.content ?? j.data ?? j; } catch { /* base64 のみのファイル */ }
  if (typeof content !== "string") throw new Error("コネクタの結果に content(base64)がありません");
  return Buffer.from(content, "base64");
}

if (import.meta.url === `file:///${resolve(process.argv[1] ?? "").replace(/\\/g, "/")}` || process.argv[1]?.endsWith("xlsx-to-json.mjs")) {
  const [input, output = "analytics/sheet.json"] = process.argv.slice(2);
  if (!input) { console.error("使い方: node scripts/xlsx-to-json.mjs <入力の .xlsx かコネクタの結果> [出力.json]"); process.exit(2); }
  const sheets = readXlsx(loadInput(input));
  const out = { exportedAt: new Date().toISOString(), sheets: Object.fromEntries(Object.entries(sheets).map(([n, rows]) => [n, toRecords(rows)])) };
  mkdirSync(dirname(resolve(output)), { recursive: true });
  writeFileSync(output, JSON.stringify(out, null, 1));
  console.log(`書き出しました: ${output}`);
  for (const [n, recs] of Object.entries(out.sheets)) console.log(`- ${n}: ${recs.length} 行`);
}
