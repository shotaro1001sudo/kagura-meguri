// 住所から緯度経度を自動で入れる: node scripts/geocode.mjs
// 国土地理院の住所検索API(無料・キー不要)を使い、lat/lng が無い開催に追記する。
// 検索順: address(番地まで、任意) → 県+市区町村+会場名 → 県+市区町村。
// 番地まで当たらなかった場合は "geoPrecision" を付ける(area=町名まで、city=市区町村の中心)。ピンの位置は目視で確認し、必要なら address を足して再実行する。
import { readFileSync, writeFileSync, existsSync } from "node:fs";

const FILES = (process.env.GEOCODE_FILES ?? "data/events.json,data/regular.json").split(",").filter((f) => existsSync(f));
const CACHE = "data/geocache.json";
// 開催(events.json)と定期公演(regular.json)の両方を処理する
const datasets = FILES.map((f) => ({ file: f, rows: JSON.parse(readFileSync(f, "utf8").replace(/^\uFEFF/, "")) }));
const events = datasets.flatMap((d) => d.rows);
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
  // 検索は必ず「都道府県+市区町村」を含める。結果の住所が市区町村と一致しなければ採用しない
  // (一致しない結果を採ると、都道府県の中心や、別の市町村に置いてしまうため)
  const cityTitle = `${e.prefecture}${e.city ?? ""}`;
  const cityName = stripGun(e.city ?? "");
  const tries = [
    ...(e.address ? [`${cityTitle}${e.address}`] : []),
    ...(e.venue ? [`${cityTitle}${e.venue}`] : []),
    cityTitle,
    `${e.prefecture}${cityName}`,
  ];
  let found = null;
  try {
    for (const q of tries) {
      const r = await lookup(q);
      if (!r) continue;
      if (!r.title.startsWith(e.prefecture) || (cityName && !r.title.includes(cityName))) continue;
      // 市区町村名より後ろの部分で精度を決める: 番地・丁目の数字まである→address / 町名まで→area / 市区町村の中心→city
      const rest = r.title.slice(r.title.indexOf(cityName) + cityName.length);
      const precision = /[0-9０-９]|番|丁目/.test(rest) ? "address" : rest.length > 0 ? "area" : "city";      found = { ...r, precision };
      break;
    }
  } catch (err) { console.error(`${e.id}: ${err.message}`); continue; }  if (found) {
    e.lat = Number(found.lat.toFixed(5));
    e.lng = Number(found.lng.toFixed(5));
    if (found.precision !== "address") e.geoPrecision = found.precision; else delete e.geoPrecision;
    ok++;
    console.log(`OK  ${e.id} -> ${e.lat},${e.lng} (${found.precision}: ${found.title})`);
  } else { ng++; console.log(`NG  ${e.id} 見つかりません。lat/lng を手で入れてください`); }
}
for (const d of datasets) writeFileSync(d.file, JSON.stringify(d.rows, null, 2));
writeFileSync(CACHE, JSON.stringify(cache, null, 2));
console.log(`完了: 追加 ${ok} 件 / 失敗 ${ng} 件`);
