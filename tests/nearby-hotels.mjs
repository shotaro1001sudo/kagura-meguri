// 会場近くの宿(楽天トラベルの施設検索 API)の取り出し・取得スクリプトのテスト(MON-6)。外には通信しない。
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, readFileSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import { cleanHotels, loadHotels, hotelCardsHtml } from "../scripts/lib/nearby-hotels.mjs";
import { overnightKagura } from "../scripts/lib/overnight.mjs";

const basic = (no, extra = {}) => ({ hotelBasicInfo: { hotelNo: no, hotelName: `宿${no}`, hotelInformationUrl: `https://hb.afl.rakuten.co.jp/hgc/x/?pc=${no}`, hotelImageUrl: `https://img.travel.rakuten.co.jp/image/${no}.jpg`, hotelMinCharge: 7700, access: "  駅から\n徒歩5分 ", reviewAverage: 4.04, ...extra } });

// formatVersion 2 と 1 の両方を読む
const v2 = cleanHotels({ hotels: [[basic(1)], [basic(2)]] });
const v1 = cleanHotels({ hotels: [{ hotel: [basic(1)] }, { hotel: [basic(2)] }] });
assert.deepEqual(v2, v1);
assert.equal(v2.length, 2);
assert.deepEqual(v2[0], { no: 1, name: "宿1", url: "https://hb.afl.rakuten.co.jp/hgc/x/?pc=1", image: "https://img.travel.rakuten.co.jp/image/1.jpg", minCharge: 7700, access: "駅から 徒歩5分", review: 4 });

// アフィリエイトでないリンク・楽天トラベル以外の画像・重複・名前なしは出さない。料金・評価が無ければ空にする
const mixed = cleanHotels({ hotels: [
  [basic(3, { hotelInformationUrl: "https://travel.rakuten.co.jp/HOTEL/3/" })],
  [basic(4, { hotelImageUrl: "https://evil.example/4.jpg", hotelThumbnailUrl: "" })],
  [basic(5, { hotelImageUrl: "", hotelThumbnailUrl: "https://img.travel.rakuten.co.jp/thumb/5.jpg" })],
  [basic(5)],
  [basic(6, { hotelName: "" })],
  [basic(7, { hotelImageUrl: "javascript:alert(1)" })],
  [basic(8, { hotelMinCharge: 0, reviewAverage: 0 })],
] });
assert.deepEqual(mixed.map((h) => h.no), [5, 8]);
assert.equal(mixed[0].image, "https://img.travel.rakuten.co.jp/thumb/5.jpg");
assert.equal(mixed[1].minCharge, null);
assert.equal(mixed[1].review, null);
assert.deepEqual(cleanHotels(null), []);
assert.deepEqual(cleanHotels({ error: "wrong_parameter" }), []);

// 古い・壊れたデータは使わない。保存したデータも、もう一度検査する
const saved = { fetchedAt: "2026-11-08T03:00", byEvent: { a: v2, b: [{ ...v2[0], url: "https://example.com/" }] } };
assert.deepEqual(Object.keys(loadHotels(JSON.stringify(saved), "2026-11-10T12:00").byEvent), ["a"]);
assert.equal(loadHotels(JSON.stringify(saved), "2026-11-12T12:00"), null); // 4日後
assert.equal(loadHotels(JSON.stringify(saved), "2026-11-07T12:00"), null); // 未来の日付
assert.equal(loadHotels("{", "2026-11-08T12:00"), null);

// 表示: 名前などはエスケープする
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const html = hotelCardsHtml([{ ...v2[0], name: "<b>宿</b>" }], { eventId: "e1", fetchedAt: "2026-11-08T03:00", esc, attrs: (n) => `rel="sponsored noopener" data-goatcounter-click="${n}"` });
assert(html.includes("&#60;b&#62;宿") && !html.includes("<b><b>"));
assert(html.includes("7,700円〜") && html.includes("11月8日時点") && html.includes("stay-hotel/e1") && html.includes("Supported by Rakuten Developers"));
assert.equal(hotelCardsHtml([], { eventId: "e", fetchedAt: "2026-11-08", esc, attrs: () => "" }), "");

// 夜神楽・夜通しの判定(時刻からは推測しない)
assert.equal(overnightKagura({ name: "高千穂の夜神楽 押方" }), "yokagura");
assert.equal(overnightKagura({ name: "花祭", description: "夜通し舞う" }), "overnight");
assert.equal(overnightKagura({ name: "例祭", start: "2026-11-03T19:00", end: "2026-11-04T08:00" }), "");
assert.equal(overnightKagura({ name: "夜神楽", overnightStay: false }), "");

// 取得スクリプト: 鍵が無ければ通信せず、ファイルも作らない。鍵があれば同じ会場は1回だけ聞き、鍵はログに出さない
const dir = mkdtempSync(join(tmpdir(), "nearby-hotels-"));
try {
  const events = join(dir, "events.json"), out = join(dir, "hotels.json"), mock = join(dir, "mock.mjs"), log = join(dir, "calls.json");
  const ev = (id, extra) => ({ id, status: "published", name: "テストの夜神楽", kagura: "テスト神楽", prefecture: "宮崎県", city: "高千穂町", start: "2026-11-20T18:00", lat: 32.7, lng: 131.3, ...extra });
  writeFileSync(events, JSON.stringify([ev("n1"), ev("n2"), ev("day", { name: "例祭" }), ev("past", { start: "2026-11-01T18:00" }), ev("far", { start: "2027-06-01T18:00" }), ev("nogeo", { lat: undefined }), ev("n3", { lat: 33.1 })]));
  writeFileSync(mock, `import { writeFileSync, readFileSync, existsSync } from "node:fs";
const log = ${JSON.stringify(log)};
globalThis.fetch = async (url, opt) => {
  const calls = existsSync(log) ? JSON.parse(readFileSync(log, "utf8")) : [];
  calls.push({ url: String(url), referer: opt?.headers?.Referer }); writeFileSync(log, JSON.stringify(calls));
  const u = new URL(url);
  if (u.searchParams.get("latitude") === "33.1") return new Response('{"error":"not_found"}', { status: 404 });
  return new Response(JSON.stringify({ hotels: [1, 2, 3, 4, 5].map((n) => [{ hotelBasicInfo: { ...${JSON.stringify(basic(0).hotelBasicInfo)}, hotelNo: n } }]) }), { status: 200 });
};`);
  const run = (env) => spawnSync(process.execPath, ["--import", pathToFileURL(mock).href, "scripts/fetch-hotels.mjs"], { encoding: "utf8", env: { ...process.env, EVENTS_FILE: events, NEARBY_HOTELS_FILE: out, BUILD_NOW: "2026-11-08T03:00", RAKUTEN_APP_ID: "", RAKUTEN_ACCESS_KEY: "", ...env } });
  let r = run({});
  assert.equal(r.status, 0, r.stderr);
  assert(!existsSync(out) && !existsSync(log), "鍵が無ければ通信しない");
  r = run({ RAKUTEN_APP_ID: "app-secret-123", RAKUTEN_ACCESS_KEY: "pk_secret456" });
  assert.equal(r.status, 0, r.stderr);
  const calls = JSON.parse(readFileSync(log, "utf8"));
  assert.equal(calls.length, 2, "同じ会場は1回だけ(n1・n2 で1回、n3 で1回)");
  const q = new URL(calls[0].url).searchParams;
  assert(q.get("applicationId") === "app-secret-123" && q.get("accessKey") === "pk_secret456" && q.get("affiliateId") && q.get("searchRadius") === "3" && calls[0].referer === "https://kagurameguri.jp/");
  const data = JSON.parse(readFileSync(out, "utf8"));
  assert.deepEqual(Object.keys(data.byEvent).sort(), ["n1", "n2"]);
  assert.equal(data.byEvent.n1.length, 3);
  assert(!(r.stdout + r.stderr).includes("secret"), "鍵をログに出さない");
} finally { rmSync(dir, { recursive: true, force: true }); }

console.log("Nearby hotels (MON-6): parse v1/v2, affiliate/image allowlist, staleness, escaping, fetch script (mocked) passed");
