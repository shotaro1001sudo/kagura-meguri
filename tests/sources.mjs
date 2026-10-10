// 収集元ごとの読み取りのテスト(NPO広島神楽芸術研究所の日程表など)。実際のページと同じ形の見本で確かめる
import { readFileSync } from "node:fs";
import { parse, urls, decode } from "../scripts/adapters/npo-hiroshima.mjs";
import { reconcile, sameEvent } from "../scripts/lib/collect-core.mjs";

const block = (id, date, title, body) => `<a name="${id}"></a><table width=700 bgcolor="#AAAAAA" cellspacing=2 cellpadding=0>
<tr><td height=20>　 ${date}<font color="#000000">(土)</font>　　<b>${title}</b></td><td align=right></td></tr>
<tr><td bgcolor="#ffffff" colspan=2><table width=100% cellspacing=8><tr><td>
<a href="./schedata/${id}.jpg" target="_blank"><img src="./schedata/${id}.jpg"></a>${body}</td></tr></table></td></tr></table>`;
const SAMPLE = `<html><body><a href="sche14.cgi?year=2026&mon=11">次の月</a>
${block("344", "2026年10月3日", "【広島県】第78回 芸石神楽競演大会", "■会場／Kumahira Park北広島(千代田運動公園総合体育館）<br>開場/9:30 開演/10:30<br>■入場料／前売2,000円 当日2,500円<br>※チケットは北広島町観光案内所で販売<br><a href=\"https://npo-kagura.jp/x\" target=\"_blank\">https://npo-kagura.jp/x</a>")}
${block("423", "2026年10月2日", "【広島県】神楽門前湯治村「夜神楽」青神楽団", "■会場／神楽門前湯治村（かむくら座）<br>■開門／19：30　開演　20：30")}
${block("429", "2026年10月28日", "【広島県】ひろしま神楽定期公演　中原神楽団", "■会場／広島県民文化センター")}
${block("500", "2026年11月8日", "【島根県】第49回美都町神楽競演大会", "■会場／美都町総合体育館")}
${block("501", "2026年11月15日", "【広島県】あさきた神楽公演", "■会場／未定<br>※詳細は決まり次第")}
</body></html>`;

export function sourcesTests({ ok, section }) {
  section("収集元: NPO広島神楽芸術研究所(神楽日程表)");
  const cfg = JSON.parse(readFileSync("data/sources.json", "utf8").replace(/^﻿/, "")).find((s) => s.id === "npo-hiroshima");
  ok(!!cfg && cfg.termsChecked && cfg.enabled && cfg.adapter === "npo-hiroshima" && /定期公演/.test(cfg.exclude), "収集元に登録済み(規約の確認日あり・定期公演は除く設定)");
  const items = parse(SAMPLE, cfg, "https://www.npo-hiroshima.jp/cgi-bin/schedule2/sche14.cgi?year=2026&mon=10");
  const names = items.map((x) => x.name);
  ok(!names.some((n) => /定期公演|「夜神楽」/.test(n)) && names.length === 3, "定期公演と、湯治村の毎週の「夜神楽」は、取り込まない", names.join(" / "));
  const geiseki = items.find((x) => x.name === "第78回 芸石神楽競演大会");
  ok(geiseki?.start === "2026-10-03T10:30" && !geiseki.timeUnknown && geiseki.prefecture === "広島県" && geiseki.city === "北広島町" && geiseki.venue.startsWith("Kumahira Park北広島") && geiseki.fee === "前売2,000円 当日2,500円", "日付・開演時刻・県・市町(会場から推定)・会場・料金を読む", JSON.stringify(geiseki));
  ok(geiseki?.url === "https://npo-kagura.jp/x", "公式情報は、本文の中の主催者などのリンク(画像は除く)");
  const mito = items.find((x) => /美都町/.test(x.name)), asa = items.find((x) => /あさきた/.test(x.name));
  ok(mito?.prefecture === "島根県" && mito.kagura === "石見神楽" && mito.city === "益田市" && mito.timeUnknown, "島根県の開催は、石見神楽として扱い、町名から市を推定する(時刻がなければ時間未定)");
  ok(asa?.url.endsWith("sche14.cgi?year=2026&mon=10#501") && asa.kagura === "広島神楽", "公式のリンクがなければ、日程表のその行へのリンク");
  const u = urls({ ...cfg, months: 3 }, new Date("2026-11-20T03:00:00Z"));
  ok(u.length === 3 && u[0].endsWith("?year=2026&mon=11") && u[2].endsWith("?year=2027&mon=1"), "今月から3か月分のページを読む(年をまたぐ)", u.join(" "));
  ok(decode(Uint8Array.of(0x90, 0x5f, 0x8a, 0x79)) === "神楽", "ページの文字(Shift_JIS)を読む");

  section("収集の判断: 料金・上限・重複");
  const now = new Date("2026-10-01T00:00:00Z");
  const r = reconcile({ events: [], candidates: items.filter((x) => x.city), source: cfg, now });
  const g = r.events.find((e) => e.name === "第78回 芸石神楽競演大会");
  ok(g?.fee === "前売2,000円 当日2,500円" && g.kagura === "広島神楽", "取得した料金と、神楽の種類が、データに入る");
  const many = Array.from({ length: 20 }, (_, i) => ({ name: `テスト神楽${i}`, prefecture: "広島県", city: "呉市", venue: "神社", start: `2026-10-${String(10 + i).padStart(2, "0")}T18:00`, url: "https://example.jp/" }));
  ok(reconcile({ events: [], candidates: many, source: cfg, now }).summary.held.length === 0 && reconcile({ events: [], candidates: many, source: { ...cfg, maxNewPerSource: undefined }, now }).summary.held.length === 20, "件数の多い収集元は、上限を個別に広げられる(既定の15件を超えると、全部保留)");
  const base = { prefecture: "広島県", start: "2026-11-15T16:00" };
  ok(sameEvent({ ...base, name: "道の駅舞ロードIC千代田「神楽の日」(11月)" }, { ...base, name: "道の駅舞ロードIC千代田「神楽の日」大塚神楽団" }) && !sameEvent({ ...base, name: "呉の神楽 戸田神楽" }, { ...base, name: "呉の神楽 小坪神楽" }), "重複: 名称の前半が十分に同じなら同じ開催。短い共通部分だけなら別の開催");
}
