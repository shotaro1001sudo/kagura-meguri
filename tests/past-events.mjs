// 終わった開催・開催予定のない種類と県のページを、検索に残すかどうか(scripts/lib/past-events.mjs と build.mjs)
// - 終わった開催: 説明があり、終わってから400日以内で、同じ催しの次の回がなければ検索に残す(サイトマップにも入れる)
// - 次の回があれば noindex にして、冒頭から次の回のページへ案内する。説明のない・古い開催も noindex
// - 開催予定が0件の種類・県のページ: 直近1年の開催の記録と解説があれば検索に残し、「これまでの開催」と近くの開催予定を出す
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import * as cheerio from "cheerio";
import { editionName, editionKey, nextEdition, keepPastIndexed, recentPast, PAST_KEEP_DAYS } from "../scripts/lib/past-events.mjs";

const read = (p) => readFileSync(p, "utf8");

export function pastEventsTests({ ok, section, build }) {
  section("終わった開催の決まり(past-events.mjs)");
  ok(editionName("第20回千代田まつり") === "千代田まつり" && editionName("第61回 大朝神楽競演大会") === "大朝神楽競演大会", "回の番号を外して、同じ催しにまとめる");
  ok(editionName("令和8年度 テスト神楽大会") === "テスト神楽大会" && editionName("2026 テスト神楽（大会）") === "テスト神楽(大会)", "年・年度と全角かっこをそろえる");
  const a = { id: "a", name: "第1回 テスト祭", prefecture: "岡山県", city: "岡山市", start: "2025-11-01T10:00", description: "説明" };
  const b = { ...a, id: "b", name: "第2回テスト祭", start: "2026-11-01T10:00" };
  const other = { ...a, id: "c", city: "倉敷市", start: "2026-11-02T10:00" };
  ok(editionKey(a) === editionKey(b) && editionKey(a) !== editionKey(other), "県・市区町村・回を除いた名前が同じなら、同じ催し");
  ok(editionKey({ ...a, series: "s1" }) === "series:s1", "series があれば、それで見分ける");
  ok(nextEdition(a, [a, b, other])?.id === "b" && nextEdition(b, [a, b, other]) === null, "次の回は、同じ催しの後の回");
  ok(keepPastIndexed(a, { today: "2026-10-09", next: null }) === true, "説明があり、次の回がなく、400日以内なら検索に残す");
  ok(keepPastIndexed(a, { today: "2026-10-09", next: b }) === false, "次の回があれば検索に載せない");
  ok(keepPastIndexed({ ...a, description: " " }, { today: "2026-10-09", next: null }) === false, "説明がなければ検索に載せない");
  ok(keepPastIndexed(a, { today: "2026-12-10", next: null }) === false && PAST_KEEP_DAYS === 400, "終わってから400日を過ぎたら検索に載せない");
  const isUp = (e) => e.start >= "2026-10-09";
  ok(recentPast([a, b, { ...a, id: "d", start: "2026-09-01T10:00" }, { ...a, id: "old", start: "2025-09-01T10:00" }], { today: "2026-10-09", isUpcoming: isUp }).map((e) => e.id).join() === "d,a", "これまでの開催は、直近1年の終わった開催(新しい順)");

  section("終わった開催のページ・開催予定のない種類と県のページ(検索に残すか・案内)");
  const dir = mkdtempSync(join(tmpdir(), "past-events-")), out = "dist-test-past-events";
  try {
    const base = { venue: "テスト会場", fee: "無料", url: "https://example.com/p", status: "published" };
    const evs = [
      { ...base, id: "pe-ended", name: "第5回 テスト庄内の祭り", kagura: "庄内神楽", prefecture: "大分県", city: "由布市", start: "2026-09-05T10:00", end: "2026-09-05T15:00", description: "終わった開催のテスト。" },
      { ...base, id: "pe-y1", name: "第1回 テスト年次神楽まつり", kagura: "備中神楽", prefecture: "岡山県", city: "岡山市", start: "2025-11-01T10:00", end: "2025-11-01T15:00", description: "去年の回。" },
      { ...base, id: "pe-y2", name: "第2回 テスト年次神楽まつり", kagura: "備中神楽", prefecture: "岡山県", city: "岡山市", start: "2026-11-01T10:00", end: "2026-11-01T15:00", description: "今年の回。" },
      { ...base, id: "pe-thin", name: "テスト説明なし神楽", prefecture: "鳥取県", city: "鳥取市", start: "2026-09-20T10:00", end: "2026-09-20T12:00" },
      { ...base, id: "pe-ancient", name: "テスト古い神楽", kagura: "テスト古神楽", prefecture: "沖縄県", city: "那覇市", start: "2025-07-01T10:00", end: "2025-07-01T12:00", description: "古い開催。" },
    ];
    const evFile = join(dir, "events.json");
    writeFileSync(evFile, JSON.stringify(evs));
    const r = build(evFile, out);
    ok(r.status === 0, "ビルドが通る", (r.stderr ?? "").slice(0, 300));
    if (r.status) return;
    const page = (p) => cheerio.load(read(join(out, p)));
    const robots = (p) => page(p)('meta[name="robots"]').attr("content") ?? "";
    const locs = [...read(join(out, "sitemap.xml")).matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => decodeURIComponent(m[1]));
    const inSm = (p) => locs.some((u) => u.endsWith(p));

    const ended = page("events/pe-ended.html");
    ok(/^index,follow/.test(robots("events/pe-ended.html")) && inSm("/events/pe-ended.html"), "説明があり次の回のない終わった開催は、検索に残し、サイトマップに入れる");
    ok(ended(".d-top .ended-note").text().includes("この開催は終了しました") && ended(".ended-note").text().includes("次の回の日程は、公式の発表を確かめ次第"), "冒頭で終了を知らせ、次の回は発表を確かめ次第と書く");
    ok(ended(".ended-note a[href='/kagura/%E5%BA%84%E5%86%85%E7%A5%9E%E6%A5%BD.html']").length === 1 && ended(".ended-note a[href='/pref/%E5%A4%A7%E5%88%86%E7%9C%8C.html']").length === 1, "同じ種類・同じ県の日程へ案内する");
    ok(ended('meta[name="description"]').attr("content").includes("で開催された") && !ended('meta[name="description"]').attr("content").includes("で開催される"), "説明文は過去形");
    ok(ended(".tocal").length === 0 && ended(".d-side").length === 0, "終わった開催には、カレンダー登録・宿の列を出さない");

    const y1 = page("events/pe-y1.html");
    ok(robots("events/pe-y1.html") === "noindex,follow" && !inSm("/events/pe-y1.html"), "次の回がある終わった開催は、検索に載せない");
    ok(y1(".ended-note a.btn[href='/events/pe-y2.html']").length === 1 && y1(".ended-note").text().includes("2026年11月1日"), "次の回のページへ、日付とボタンで案内する");
    ok(/^index,follow/.test(robots("events/pe-y2.html")) && inSm("/events/pe-y2.html"), "次の回(開催前)は検索に載る");
    ok(page("events/pe-y2.html")(".ended-note").length === 0, "開催前のページには終了の案内を出さない");

    ok(robots("events/pe-thin.html") === "noindex,follow" && !inSm("/events/pe-thin.html"), "説明のない終わった開催は、検索に載せない");
    ok(robots("events/pe-ancient.html") === "noindex,follow" && !inSm("/events/pe-ancient.html"), "終わってから400日を過ぎた開催は、検索に載せない");

    const k = page("kagura/庄内神楽.html");
    ok(/^index,follow/.test(robots("kagura/庄内神楽.html")) && inSm("/kagura/庄内神楽.html"), "開催予定のない種類のページも、これまでの開催と解説があれば検索に残す");
    ok(k("#k-past").length === 1 && k(".past-list a[href='/events/pe-ended.html']").length === 1 && k(".ended-note").text().includes("次の日程は、公式の発表を確かめ次第載せます"), "これまでの開催と、次の日程の載せ方を出す");
    ok(k(".kagura-jumps a[href='#k-past']").length === 1, "ページ内の案内に「これまでの開催」を入れる");
    ok(k(".hero p").text().trim() === "開催予定はありません", "見出しの下の件数の文は変えない");
    ok(robots("kagura/テスト古神楽.html") === "noindex,follow" && !inSm("/kagura/テスト古神楽.html"), "解説も直近の記録もない種類のページは、検索に載せない");

    ok(/^index,follow/.test(robots("pref/大分県.html")) && inSm("/pref/大分県.html") && page("pref/大分県.html")("#pref-past").length === 1, "開催予定のない県のページも、直近の記録と解説があれば検索に残す");
    ok(robots("pref/鳥取県.html") === "noindex,follow" && !inSm("/pref/鳥取県.html"), "解説も説明つきの記録もない県のページは、検索に載せない");
    ok(robots("pref/沖縄県.html") === "noindex,follow" && !inSm("/pref/沖縄県.html"), "直近1年の記録がない県のページは、検索に載せない");
    const ok2 = page("pref/岡山県.html");
    ok(ok2(".ended-note").length === 0 && ok2("#pref-past").length === 0, "開催予定のある県のページには、開催予定なしの案内を出さない");
    ok(ok2("details.past-more a[href='/events/pe-y1.html']").length === 1 && !ok2("details.past-more").attr("open"), "開催予定のある県のページでも、これまでの開催はたたんで載せる(終了ページへのリンクが切れない)");
  } finally {
    rmSync(dir, { recursive: true, force: true });
    rmSync(out, { recursive: true, force: true });
  }
}
