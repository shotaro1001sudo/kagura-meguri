// 夜神楽・夜通しの開催の近くの宿を、楽天トラベルの施設検索 API(楽天ウェブサービス)で取る(MON-6)。
// 公開(deploy)のたびに取り直し、data/nearby-hotels.json に書く(Git には入れない)。料金・写真は取得時点のもの。
// 鍵(RAKUTEN_APP_ID / RAKUTEN_ACCESS_KEY)が無いとき・取れないときは何もしない(ページは今までどおり)。公開は止めない。
//
// 環境変数:
//   RAKUTEN_APP_ID        楽天ウェブサービスのアプリID(必須)
//   RAKUTEN_ACCESS_KEY    アクセスキー(新しい API で必須)
//   RAKUTEN_HOTEL_ENDPOINT  施設検索の URL(公式の最新版に合わせて変えられる)
//   NEARBY_HOTELS_FILE    書き出し先(既定 data/nearby-hotels.json)
//   BUILD_NOW             日本時間の現在(テスト用)
import { readFileSync, writeFileSync } from "node:fs";
import { overnightKagura } from "./lib/overnight.mjs";
import { cleanHotels, HOTEL_RADIUS_KM, HOTELS_PER_EVENT, HOTEL_LOOKAHEAD_DAYS } from "./lib/nearby-hotels.mjs";

const OUT = process.env.NEARBY_HOTELS_FILE ?? "data/nearby-hotels.json";
const ENDPOINT = process.env.RAKUTEN_HOTEL_ENDPOINT || "https://openapi.rakuten.co.jp/engine/api/Travel/SimpleHotelSearch/20170426";
const SITE = "https://kagurameguri.jp/";
const appId = (process.env.RAKUTEN_APP_ID ?? "").trim(), accessKey = (process.env.RAKUTEN_ACCESS_KEY ?? "").trim();
const readJson = (p) => JSON.parse(readFileSync(p, "utf8").replace(/^﻿/, ""));

if (!appId) { console.log("楽天の宿: RAKUTEN_APP_ID が未設定のため、取得しません(宿の写真カードは出ません)"); process.exit(0); }
const cfg = readJson("config.json");
const affiliateId = cfg.affiliate?.rakutenAffiliateId ?? "";
if (!affiliateId) { console.log("楽天の宿: 楽天アフィリエイトIDが未設定のため、取得しません"); process.exit(0); }

const nowJst = process.env.BUILD_NOW ?? new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 16);
const today = nowJst.slice(0, 10);
const until = new Date(Date.parse(today + "T00:00:00Z") + HOTEL_LOOKAHEAD_DAYS * 864e5).toISOString().slice(0, 10);
const events = readJson(process.env.EVENTS_FILE ?? "data/events.json")
  .filter((e) => e.status === "published" && e.stayLinks !== false && overnightKagura(e))
  .filter((e) => (e.end ?? e.start).slice(0, 10) >= today && e.start.slice(0, 10) <= until)
  .filter((e) => Number.isFinite(e.lat) && Number.isFinite(e.lng));

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function search(lat, lng) {
  const q = new URLSearchParams({ applicationId: appId, affiliateId, format: "json", formatVersion: "2", datumType: "1", latitude: String(lat), longitude: String(lng), searchRadius: String(HOTEL_RADIUS_KM), hits: String(HOTELS_PER_EVENT * 2), responseType: "small" });
  if (accessKey) q.set("accessKey", accessKey);
  const res = await fetch(`${ENDPOINT}?${q}`, { headers: { Referer: SITE, Origin: SITE.slice(0, -1), "User-Agent": "kagurameguri-build" }, signal: AbortSignal.timeout(15000) });
  if (res.status === 404) { const body = await res.text(); if (/not_found/i.test(body)) return []; throw new Error(`HTTP 404 ${body.slice(0, 120)}`); } // 該当なし
  if (!res.ok) throw new Error(`HTTP ${res.status} ${(await res.text()).slice(0, 160)}`);
  return cleanHotels(await res.json());
}

const byEvent = {}, cache = new Map();
let errors = 0;
for (const e of events) {
  const key = `${e.lat.toFixed(3)},${e.lng.toFixed(3)}`; // 同じ会場はまとめて1回だけ聞く
  if (!cache.has(key)) {
    try { cache.set(key, await search(e.lat, e.lng)); }
    catch (err) {
      errors++; cache.set(key, []);
      // 鍵の値は出さない(エラー文に URL が入らないよう、メッセージだけ)
      console.warn(`楽天の宿: ${e.id} の取得に失敗: ${String(err.message).replaceAll(appId, "***").replaceAll(accessKey || "\u0000", "***")}`);
      if (errors >= 3) { console.warn("楽天の宿: 失敗が続いたため、取得をやめます"); break; }
    }
    await sleep(1100); // 1秒に1回まで
  }
  const list = cache.get(key).slice(0, HOTELS_PER_EVENT);
  if (list.length) byEvent[e.id] = list;
}
writeFileSync(OUT, JSON.stringify({ fetchedAt: nowJst, radiusKm: HOTEL_RADIUS_KM, byEvent }, null, 2) + "\n");
console.log(`楽天の宿: 対象 ${events.length} 件の開催のうち ${Object.keys(byEvent).length} 件に宿を掲載(問い合わせ ${cache.size} 回、失敗 ${errors} 回)`);
