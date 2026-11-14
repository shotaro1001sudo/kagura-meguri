// IndexNow: 公開の前後のサイトマップを比べ、新しいページ・変わったページだけを、公開のあとに知らせる
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import YAML from "yaml";
import { sitemapEntries, changedUrls, indexNowBody, validKey, INDEXNOW_MAX_URLS } from "../scripts/lib/indexnow.mjs";

const read = (p) => readFileSync(p, "utf8");
const sm = (rows) => `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${rows.map(([u, d]) => `<url><loc>https://kagurameguri.jp${u}</loc><lastmod>${d}</lastmod></url>`).join("")}</urlset>`;

export function indexNowTests({ ok, section, OUT }) {
  section("IndexNow: 新しいページ・変わったページだけを知らせる");
  const before = sm([["/", "2026-11-13"], ["/events/a.html", "2026-11-01"], ["/events/b.html", "2026-11-02"]]);
  const after = sm([["/", "2026-11-14"], ["/events/a.html", "2026-11-01"], ["/events/c.html", "2026-11-14"]]);
  ok(sitemapEntries(after).size === 3 && sitemapEntries(after).get("https://kagurameguri.jp/") === "2026-11-14", "サイトマップの場所と更新日を読める");
  const urls = changedUrls(before, after, "https://kagurameguri.jp");
  ok(JSON.stringify(urls) === JSON.stringify(["https://kagurameguri.jp/", "https://kagurameguri.jp/events/c.html"]), "更新日が変わったページと、新しいページだけ(変わらないページ・消えたページは送らない)", urls.join(", "));
  ok(changedUrls(null, after, "https://kagurameguri.jp").length === 0, "公開中のサイトマップが読めないときは、何も送らない(全部を送らない)");
  ok(changedUrls("<html>error</html>", after, "https://kagurameguri.jp").length === 0, "サイトマップでないもの(エラーのページなど)と比べても、全部を送らない");
  ok(changedUrls(sm([["/x.html", "1"]]), sm([["/x.html", "2"]]).replace("https://kagurameguri.jp/x.html", "https://example.com/x.html"), "https://kagurameguri.jp").length === 0, "このサイト以外の URL は送らない");
  const many = sm(Array.from({ length: INDEXNOW_MAX_URLS + 5 }, (_, i) => [`/events/e${i}.html`, "2026-11-14"]));
  ok(changedUrls(sm([["/", "1"]]), many, "https://kagurameguri.jp").length === INDEXNOW_MAX_URLS, "1回に送るのは、仕様の上限まで");

  const body = indexNowBody({ baseUrl: "https://kagurameguri.jp", key: "8bab1ad7b85b62ae1bc650226be4ba63", urls });
  ok(body?.host === "kagurameguri.jp" && body.keyLocation === "https://kagurameguri.jp/8bab1ad7b85b62ae1bc650226be4ba63.txt" && body.urlList.length === 2, "送る中身: ホスト・キーの場所・URL の一覧");
  ok(indexNowBody({ baseUrl: "https://kagurameguri.jp", key: "8bab1ad7b85b62ae1bc650226be4ba63", urls: [] }) === null && indexNowBody({ baseUrl: "https://kagurameguri.jp", key: "bad key!", urls }) === null, "URL が無い・キーが不正なときは送らない");
  ok(validKey("abcd1234") && !validKey("short") && !validKey("a/b/c/d/e"), "キーは8〜128文字の英数字とハイフンだけ");

  section("IndexNow: キーのファイルと、公開のワークフロー");
  const cfg = JSON.parse(read("config.json"));
  const key = cfg.seo?.indexNowKey;
  ok(validKey(key), "設定にキーがある(公開してよい値)");
  ok(existsSync(join(OUT, `${key}.txt`)) && read(join(OUT, `${key}.txt`)) === key, "サイトの直下に、キーと同じ中身のファイルを置く");
  const dy = YAML.parse(read(".github/workflows/deploy.yml"));
  const steps = dy.jobs.build.steps;
  const plan = steps.findIndex((s) => s.id === "indexnow"), build = steps.findIndex((s) => s.run === "node scripts/build.mjs"), upload = steps.findIndex((s) => /upload-pages-artifact/.test(s.uses ?? ""));
  ok(plan > build && plan < upload && steps[plan]["continue-on-error"] === true, "知らせるページは、作り直したあと・公開の前に決め、失敗しても公開を止めない");
  ok(dy.jobs.build.outputs?.indexnow_body === "${{ steps.indexnow.outputs.indexnow_body }}", "決めた中身を、公開のあとのジョブに渡す");
  const job = dy.jobs.indexnow;
  ok(JSON.stringify(job?.needs) === JSON.stringify(["build", "deploy"]) && job["continue-on-error"] === true && JSON.stringify(job.permissions) === "{}", "送るのは公開が済んだあと。権限なし。失敗しても公開の成否を変えない");
  const run = job?.steps?.[0]?.run ?? "";
  ok(job?.steps?.[0]?.env?.BODY === "${{ needs.build.outputs.indexnow_body }}" && !/\$\{\{/.test(run) && run.includes("https://api.indexnow.org/indexnow"), "中身は環境変数で渡し、コマンドに直接埋め込まない");
}
