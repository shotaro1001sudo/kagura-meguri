// 住所から緯度経度を自動で入れる: node scripts/geocode.mjs
// 国土地理院の住所検索API(無料・キー不要)を使い、lat/lng が無い開催に追記する。
// 検索順: address(番地まで、任意) → 県+市区町村+会場名 → 県+市区町村。
// 市区町村の中心にしか当たらなかった場合は "geoPrecision": "city" を付ける。ピンの位置は目視で確認し、必要なら address を足して再実行する。
import { readFileSync, writeFileSync, existsSync } from "node:fs";

const FILE = "data/events.json";
const CACHE = "data/geocache.json";
const events = JSON.parse(readFileSync(FILE, "utf8").replace(/^﻿/, ""));
const cache = existsSync(CACHE) ? JSON.parse(readFileSync(CACHE, "utf8")) : {};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function lookup(q) {
  if (q in cache) return cache[q];
  const res = await fetch(`https://msearch.gsi.go.jp/address-search/AddressSearch?q=${encodeURIComponent(q)}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const hits = await res.json();
  await sleep(1100); // 相手先に負荷をかけないよう1秒以上あける
  const top = hits[0];
  cache[q] = top ? { lng: top.geometry.coordinates[0], lat: top.geometry.coordinates[1], title: top.properties.title } : null;
  return cache[q];
}

// "西臼杵郡高千穂町" → 郡を除いた町名も試す
const stripGun = (c = "") => c.replace(/^.*郡/, "");

let ok = 0, ng = 0;
for (const e of events) {
  if (e.lat && e.lng) continue;
  // 番地まである "address" を最優先。国土地理院のAPIは住所検索なので、施設名だけでは市区町村の中心に寄ることが多い
  const cityTitle = `${e.prefecture}${e.city}`;
  const tries = [
    ...(e.address ? [`${e.prefecture}${e.address}`] : []),
    `${cityTitle}${e.venue}`,
    cityTitle,
    `${e.prefecture}${stripGun(e.city)}`,
  ];
  let found = null;
  try {
    for (const q of tries) {
      const r = await lookup(q);
      if (r) {
        // タイトルが「県+市区町村」より細かければ番地レベル、そうでなければ市区町村の中心
        const precision = r.title.length > cityTitle.length && r.title.startsWith(e.prefecture) ? "address" : "city";
        found = { ...r, precision };
        break;
      }
    }
  } catch (err) { console.error(`${e.id}: ${err.message}`); continue; }
  if (found) {
    e.lat = Number(found.lat.toFixed(5));
    e.lng = Number(found.lng.toFixed(5));
    if (found.precision === "city") e.geoPrecision = "city"; else delete e.geoPrecision;
    ok++;
    console.log(`OK  ${e.id} -> ${e.lat},${e.lng} (${found.precision}: ${found.title})`);
  } else { ng++; console.log(`NG  ${e.id} 見つかりません。lat/lng を手で入れてください`); }
}
writeFileSync(FILE, JSON.stringify(events, null, 2));
writeFileSync(CACHE, JSON.stringify(cache, null, 2));
console.log(`完了: 追加 ${ok} 件 / 失敗 ${ng} 件`);
