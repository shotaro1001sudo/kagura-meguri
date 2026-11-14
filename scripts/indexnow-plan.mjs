// 公開のワークフロー(deploy.yml)の build ジョブで、作り直したあと・公開する前に動かす。
// いま公開中のサイトマップと dist/sitemap.xml を比べ、IndexNow で知らせるページを決める。
// 結果は GITHUB_OUTPUT の indexnow_body に1行の JSON で渡す(空なら送らない)。送るのは公開のあとの別ジョブ。
// 失敗しても公開は止めない(ワークフロー側で continue-on-error)。
import { readFileSync, appendFileSync } from "node:fs";
import { changedUrls, indexNowBody } from "./lib/indexnow.mjs";

const cfg = JSON.parse(readFileSync("config.json", "utf8"));
const key = cfg.seo?.indexNowKey ?? "";
const OUT = process.env.OUT_DIR ?? "dist";
const after = readFileSync(`${OUT}/sitemap.xml`, "utf8");

let before = null;
try {
  const res = await fetch(`${cfg.baseUrl}/sitemap.xml`, { redirect: "error", signal: AbortSignal.timeout(15000) });
  if (res.ok) before = await res.text();
  else console.log(`公開中のサイトマップを読めませんでした(HTTP ${res.status})。今回は知らせません`);
} catch (err) {
  console.log(`公開中のサイトマップを読めませんでした(${err.name})。今回は知らせません`);
}

const urls = changedUrls(before, after, cfg.baseUrl);
const body = indexNowBody({ baseUrl: cfg.baseUrl, key, urls });
console.log(body ? `IndexNow で知らせるページ: ${urls.length}件` : "IndexNow で知らせるページはありません");
for (const u of urls.slice(0, 20)) console.log(`  ${u}`);
if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `indexnow_body=${body ? JSON.stringify(body) : ""}\n`);
