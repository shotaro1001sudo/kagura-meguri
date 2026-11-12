// 公開なしの神楽会館・実HTMLドライラン。公演ファイルや掲載データは変更しない。
// 実行: node scripts/verify-oita-live.mjs
import { readFileSync } from "node:fs";
import { discover, parse } from "./adapters/kagura-kaikan-oita.mjs";
import { robotsAllows, sleep } from "./lib/util.mjs";
import { reconcile } from "./lib/collect-core.mjs";

const readJson = (path) => JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
const source = readJson("data/sources.json").find((s) => s.id === "kagura-kaikan-oita");
if (!source || source.enabled || source.termsChecked) throw new Error("実HTMLドライランでは収集元はdisabledかつtermsChecked空が必須");
const ua = "KaguraMeguriBot/1.0 (+https://kagurameguri.jp/contact.html)";
const fetchPage = async (url) => {
  const r = await fetch(url, { headers: { "user-agent": ua, "accept-language": "ja" }, signal: AbortSignal.timeout(15000) });
  if (!r.ok) throw new Error(`HTTP ${r.status} (${url})`);
  return r.text();
};
const rule = await robotsAllows(source.url, ua);
if (!rule.ok || /unreachable/i.test(rule.reason)) throw new Error(`一覧のrobotsが未確認/禁止: ${rule.reason}`);
const html = await fetchPage(source.url);
const links = discover(html, source);
const extracted = [];
for (const [index, url] of links.entries()) {
  await sleep(3000);
  const allow = await robotsAllows(url, ua);
  if (!allow.ok || /unreachable/i.test(allow.reason)) throw new Error(`詳細のrobotsが未確認/禁止: ${url}`);
  const detail = await fetchPage(url);
  extracted.push(...parse(detail, source, url));
}
const now = new Date();
const future = extracted.filter((item) => item.start.slice(0, 10) >= new Date(now.getTime() + 9 * 3600e3).toISOString().slice(0, 10));
if (!future.length) throw new Error("将来公演を0件しか検出できませんでした。実HTML/一覧の構造を再点検してください");
const events = readJson("data/events.json");
const regular = readJson("data/regular.json");
const matchesRegular = future.filter((item) => regular.some((r) =>
  String(r.venue || "").includes("神楽会館") || String(r.name || "").includes("神楽会館")));
if (matchesRegular.length) throw new Error("定期公演との重複疑いあり。有効化する前に手動検証してください");
const run = reconcile({ events, candidates: extracted, source, now, cfg: { autoPublish: false } });
if (run.summary.published.length) throw new Error("ドライランなのに新規公演がpublishedになりました");
console.log(JSON.stringify({
  dryRun: true, source: source.id, publicWrites: 0, sourceEnabled: source.enabled,
  discoveredLinks: links.length, extracted: extracted.length, futureEvents: future.map((x) => ({
    name: x.name, start: x.start, end: x.end || null, venue: x.venue, url: x.url
  })),
  held: run.summary.held.length, duplicates: run.summary.duplicates, past: run.summary.past,
  notes: run.summary.notes,
}, null, 2));
