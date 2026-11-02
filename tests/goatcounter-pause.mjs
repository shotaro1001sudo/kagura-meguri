import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import * as cheerio from "cheerio";

export function goatcounterPauseTests({ ok, section, build }) {
  section("GoatCounter temporary pause: no loader with or without Cookiebot");
  const cfg = JSON.parse(readFileSync("config.json", "utf8"));
  const walk = dir => readdirSync(dir, { withFileTypes: true }).flatMap(entry =>
    entry.isDirectory() ? walk(join(dir, entry.name)) : [join(dir, entry.name)]);
  for (const cookiebot of [cfg.cookiebotId, ""]) {
    const out = `dist-test-goatcounter-pause-${cookiebot ? "cmp" : "no-cmp"}`;
    const result = build("tests/fixtures/events.test.json", out, {
      TEST_GOATCOUNTER: cfg.goatcounter, TEST_CB: cookiebot,
      TEST_GA: cfg.analyticsId, TEST_ADS_OFF: "", TEST_AFF_OFF: ""
    });
    ok(result.status === 0, "Configured GoatCounter builds during pause", result.stderr);
    if (result.status !== 0) continue;
    const pages = walk(out).filter(path => path.endsWith(".html"));
    for (const path of pages) {
      const $ = cheerio.load(readFileSync(path, "utf8"));
      const scripts = $("script").toArray();
      ok(scripts.every(node => !/gc\.zgo\.at|goatcounter\.com|goatcounter\s*(?:\.\s*(?:count|bind_events)|\[)/i.test($(node).text() + ($(node).attr("src") || ""))) && $("script[data-goatcounter]").length === 0,
        path + ": no GoatCounter loader, inline injection, or count calls");
      ok($('link[href*="gc.zgo.at"],link[href*="goatcounter.com"],img[src*="goatcounter.com"],iframe[src*="goatcounter.com"]').length === 0,
        path + ": no alternative GoatCounter requests");
      ok(!scripts.some(node => /adsbygoogle\.js/.test($(node).text() + ($(node).attr("src") || ""))), path + ": AdSense pause preserved");
      if (cookiebot) {
        ok($('script[data-ga4-id][data-require-statistics-consent]').length === 1, path + ": GA4 consent gate preserved");
      }
    }
    ok(pages.length > 20, "All generated page types covered");
  }
}
