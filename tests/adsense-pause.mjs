import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import * as cheerio from "cheerio";

export function adsensePauseTests({ ok, section, build }) {
  section("AdSense temporary pause: all generated pages retain consent controls");
  const cfg = JSON.parse(readFileSync("config.json", "utf8"));
  const out = "dist-test-adsense-pause";
  const result = build("tests/fixtures/events.test.json", out, {
    TEST_ADS_OFF: "", TEST_AFF_OFF: "", TEST_GA: cfg.analyticsId, TEST_CB: cfg.cookiebotId
  });
  ok(result.status === 0, "Production publisher and consent configuration builds", result.stderr);
  if (result.status !== 0) return;
  ok(Boolean(cfg.adsense.client && cfg.analyticsId && cfg.cookiebotId), "Publisher, GA4 and Cookiebot IDs remain configured");
  const walk = dir => readdirSync(dir, { withFileTypes: true }).flatMap(entry =>
    entry.isDirectory() ? walk(join(dir, entry.name)) : [join(dir, entry.name)]);
  const pages = walk(out).filter(path => path.endsWith(".html"));
  const controls = readFileSync("scripts/client/cookie-controls.js", "utf8").trim();
  const vc = readFileSync("scripts/client/valuecommerce-consent.js", "utf8").trim();
  let vcPages = 0;
  for (const path of pages) {
    const html = readFileSync(path, "utf8"), $ = cheerio.load(html);
    ok(!html.includes("adsbygoogle.js"), path + ": no external AdSense loader (including inline injection)");
    ok($('script[src="/vendor/cookieconsent-3.2.1/cookieconsent.umd.js"]').length === 1 && $('script[src*="cookiebot"]').length === 0, path + ": local CMP only");
    ok($('script[data-ga4-id][data-require-statistics-consent]').length === 1 && $('script[src*="googletagmanager.com/gtag/js"]').length === 0, path + ": GA4 statistics gate preserved");
    const scripts = $('script').map((_, node) => $(node).text().trim()).get();
    ok($('#cookie-settings-open').length === 1 && scripts.includes(controls), path + ": cookie settings and fallback preserved");
    if ($('[data-vc-ad]').length) {
      vcPages++;
      ok(scripts.includes(vc) && $('[data-vc-ad]').toArray().every(node => $(node).is('[hidden]') && $(node).children('template').length === 1), path + ": ValueCommerce gate and inert templates preserved");
    }
  }
  ok(pages.length > 20 && vcPages > 0, "Regression covers all generated page types and ValueCommerce pages");
  ok(readFileSync(join(out, "ads.txt"), "utf8") === `google.com, ${cfg.adsense.client.replace("ca-", "")}, DIRECT, f08c47fec0942fa0\n`, "ads.txt remains unchanged");
}
