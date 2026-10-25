import { readFileSync } from "node:fs";
import { affiliateCoverage, coverageReport } from "../scripts/lib/affiliate-coverage.mjs";

export function affiliateCoverageTests({ ok, section }) {
  section("週次の自動収集: 新しく掲載した開催に、アフィリエイトが紐づくか");
  const planning = JSON.parse(readFileSync("data/visitor-planning.json", "utf8"));
  const affiliate = { rakutenAffiliateId: "r.test", valueCommerceSid: "1111111", jalanPid: "2222222", jalanActivityPid: "3333333" };
  const auto = { id: "auto-1", name: "自動収集の公演", start: "2026-11-01T18:00:00+09:00", prefecture: "高知県", city: "長岡郡大豊町", auto: true };
  const today = "2026-10-26";
  const cov = affiliateCoverage({ events: [auto], affiliate, planning, today });
  const row = cov.rows[0];
  ok(row.stay.join() === "じゃらん,楽天トラベル" && row.experience && row.rental.length === 2 && row.missing.length === 0, "提携IDと承認済みの広告がそろえば、自動収集の開催にも宿・体験・移動がすべて紐づく", JSON.stringify(row));
  ok(coverageReport(cov).text.includes("✅ 自動収集の公演: 宿 じゃらん・楽天トラベル / 体験 じゃらん遊び・体験 / 移動 レンタカー・カーシェア") && !coverageReport(cov).attention, "レポートに、開催ごとの紐づけを書く(足りなければ注意にする)");
  const none = affiliateCoverage({ events: [auto], affiliate: {}, planning, today });
  ok(none.missingIds.length === 3 && none.rows[0].missing.join() === "宿,体験" && coverageReport(none).attention, "提携IDが未設定なら、紐づかないことを注意として知らせる");
  const soon = affiliateCoverage({ events: [], affiliate, planning, today: "2026-11-15" });
  ok(soon.expiring.length > 0 && soon.expiring.every((o) => o.days <= 14) && coverageReport(soon).attention && coverageReport(soon).text.includes("再確認期限まで"), "掲載の再確認期限が14日以内の広告を、期限切れで表示が止まる前に知らせる");
  const after = affiliateCoverage({ events: [auto], affiliate, planning, today: "2026-11-30" });
  ok(after.rows[0].rental.length === 0 && after.expiring.some((o) => o.days < 0) && coverageReport(after).text.includes("期限が切れて"), "期限切れの広告は紐づけず、止まっていることを知らせる");
  const unknownPref = affiliateCoverage({ events: [{ ...auto, prefecture: "未確認県" }], affiliate, planning, today });
  ok(!unknownPref.rows[0].experience && unknownPref.rows[0].missing.includes("体験"), "47都道府県にない県名は、体験を推測で紐づけない");
  const collect = readFileSync("scripts/collect.mjs", "utf8");
  ok(/affiliateCoverage\(\{ events: published,/.test(collect) && /## アフィリエイトの紐づけ/.test(collect) && /covReport\.attention/.test(collect), "週次の収集レポートに、新規掲載分の紐づけの節があり、注意が要れば Issue で知らせる");
}
