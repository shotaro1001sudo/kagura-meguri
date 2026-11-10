// 数字: 集客(検索とサイトの訪問)と、掲載の量と鮮度。読むだけ。数字は毎週月曜の分析が、このPCに取り込む(公開しない)
import { h, view, fmtN, md, whenText, note, loading, more } from "./ui.js";
import { overview, loadOverview, columnChart, hbars, deltaOf, tile, tileLink } from "./dash.js";

function trafficPart(T) {
  if (!T?.has) return [note("info", "日ごとの数字が、まだありません。毎週月曜の分析のあとに出ます。")];
  const s = T.sessions, q = T.search;
  const span = (w) => (w ? `${md(w.cur.from)}〜${md(w.cur.to)}` : "");
  const enough = (w, k) => !!w && w.cur[k] >= 6 && w.prev[k] >= 6;
  const tiles = h("div", { class: "stats" },
    tile("サイトの訪問", fmtN(s?.cur.sessions), h("small", { class: "mut" }, span(s)), s ? deltaOf(s.cur.sessions, s.prev.sessions, { enough: enough(s, "gaDays") }) : ""),
    tile("検索からのクリック", fmtN(q?.cur.clicks), h("small", { class: "mut" }, span(q)), q ? deltaOf(q.cur.clicks, q.prev.clicks, { enough: enough(q, "gscDays") }) : ""),
    tile("検索に出た回数", fmtN(q?.cur.impr), h("small", { class: "mut" }, span(q)), q ? deltaOf(q.cur.impr, q.prev.impr, { enough: enough(q, "gscDays") }) : ""),
    tile("検索の平均の順位", q?.cur.pos == null ? "—" : q.cur.pos.toFixed(1) + "位", h("small", { class: "mut" }, "小さいほど上"), q ? deltaOf(q.cur.pos, q.prev.pos, { lowerBetter: true, abs: true, rank: true, enough: enough(q, "gscDays") }) : ""),
    tile("広告のクリック", fmtN(T.affClicks28?.count), h("small", { class: "mut" }, T.affClicks28 ? `28日間(${md(T.affClicks28.from)}〜${md(T.affClicks28.to)})` : "まだ記録がありません")));
  const weekly = (k, daysK, unit, label) => { const weeks = T.weeks.slice(Math.max(0, T.weeks.findIndex((w) => w[daysK] > 0))); return columnChart({
    label, unit,
    items: weeks.map((w, i) => ({ label: md(w.from), sub: w[daysK] < 7 ? `${w[daysK]}日分` : "", value: w[k], partial: w[daysK] < 7,
      tip: [`${fmtN(w[k])} ${unit === "回" ? "" : unit}`.trim(), `${md(w.from)}〜${md(w.to)} の週`, `値のある日 ${w[daysK]}/7 日${i === weeks.length - 1 ? "(今週)" : ""}`] })),
    table: { head: ["週", label.replace(/(週ごとの)/, ""), "値のある日"], rows: weeks.map((w) => [`${md(w.from)}〜${md(w.to)}`, fmtN(w[k]), `${w[daysK]}/7`]) },
  }); };
  const page = (p) => { try { return decodeURI(p); } catch { return p; } };
  const lists = h("div", { class: "cols" },
    T.pages.length ? h("div", { class: "card" }, h("h3", null, "検索から来たページ(28日)"), hbars(T.pages.map((p) => ({ label: page(p.key), value: p.clicks, note: `表示 ${fmtN(p.impr)}・${p.pos.toFixed(1)}位` })))) : "",
    T.queries.length ? h("div", { class: "card" }, h("h3", null, "検索された言葉(28日)"), hbars(T.queries.map((p) => ({ label: p.key, value: p.clicks, note: `表示 ${fmtN(p.impr)}・${p.pos.toFixed(1)}位` })))) : "",
    T.sources.length ? h("div", { class: "card" }, h("h3", null, "どこから来たか(28日・訪問)"), hbars(T.sources.map((p) => ({ label: p.key, value: p.sessions })))) : "");
  return [tiles,
    h("div", { class: "cols" }, h("div", { class: "card" }, weekly("sessions", "gaDays", "回", "週ごとのサイトの訪問")), h("div", { class: "card" }, weekly("clicks", "gscDays", "回", "週ごとの検索からのクリック"))),
    lists,
    more("数字の出どころ・注意", h("p", { class: "mut" }, `検索の数字は Google Search Console、訪問の数字は GA4(Google アナリティクス)のものです(訪問は「セッション」とも呼びます)。毎週月曜の分析が、このPCに取り込みます。検索は2〜3日遅れて確定します。日ごとの数字: ${T.updated ?? "—"} まで${T.range28 ? ` ・ 28日の内訳: ${T.range28}` : ""}`),
      T.caveats.length ? h("ul", { class: "mut caveats" }, T.caveats.map((c) => h("li", null, c))) : "")];
}

function listingPart(Lg) {
  if (!Lg) return "";
  const tiles = h("div", { class: "stats" },
    tileLink("これからの開催", fmtN(Lg.upcoming), ["events", { evFilter: "upcoming" }], h("small", { class: "mut" }, `うち自動で集めたもの ${fmtN(Lg.auto)}`)),
    tile("7日以内", fmtN(Lg.next7)), tile("30日以内", fmtN(Lg.next30)), tile("定期公演", fmtN(Lg.regular)),
    tileLink("保留中", fmtN(Lg.pending), ["todo"], h("small", { class: "mut" }, "掲載か却下を決める")),
    tileLink("確認日が60日を過ぎた", fmtN(Lg.stale), ["events", { evFilter: "stale" }], h("small", { class: "mut" }, "公式情報で確かめ直す")),
    tile("時刻未定(14日以内)", fmtN(Lg.timeUnknown14)), tile("地図の位置なし", fmtN(Lg.noGeo)));
  const chart = columnChart({ label: "これからの開催(週ごと・開始日)", unit: "件",
    items: Lg.weeks.map((w, i) => ({ label: md(w.from), sub: i === 0 ? "今週" : "", value: w.count, tip: [`${w.count} 件`, `${md(w.from)}〜${md(w.to)} の週`] })),
    table: { head: ["週", "開催"], rows: Lg.weeks.map((w) => [`${md(w.from)}〜${md(w.to)}`, String(w.count)]) } });
  const c = Lg.collect;
  return [tiles, h("div", { class: "cols" }, h("div", { class: "card" }, chart), h("div", { class: "card" }, h("h3", null, "地方ごと(30日以内)"), hbars(Lg.regions.map((r) => ({ label: r.name, value: r.count }))))),
    c ? h("p", { class: "small" }, `前回の自動収集(${whenText(c.date)}): 新しく掲載 ${fmtN(c.published)} 件 ・ 保留 ${fmtN(c.held)} 件 ・ エラー ${fmtN(c.errors)} 件`) : "",
    Lg.expiring.length ? h("div", { class: "card" }, h("h3", null, "期限が近い広告リンク"), h("ul", { class: "small" }, Lg.expiring.map((o) => h("li", null, `${o.title}: ${o.expiresAt}${o.days < 0 ? "(切れて、表示が止まっています)" : `(あと ${o.days} 日)`}`)))) : ""];
}

export function numbersView() {
  const O = overview();
  if (!O) return [view.ovError ? note("warn", `数字を読めませんでした(${view.ovError})。 `, h("button", { class: "btn sm", onclick: () => loadOverview(true) }, "もう一度読み込む")) : loading("数字を集めています…(数秒かかります)")];
  return [
    h("p", { class: "lead" }, "サイトに人が来ているか、開催が十分に載っているかを見ます。読むだけの画面です。売上は「目標・収益」にあります。"),
    h("section", { "aria-labelledby": "num-traffic" }, h("h2", { id: "num-traffic", class: "sec" }, "集客(直近7日と、前の7日との比べ)"), trafficPart(O.traffic)),
    h("section", { "aria-labelledby": "num-listing" }, h("h2", { id: "num-listing", class: "sec" }, "掲載の量と鮮度"), h("p", { class: "mut small" }, "数字を押すと、その一覧が開きます。"), listingPart(O.listing)),
    h("p", { class: "mut small" }, "グラフは、棒にマウスを置くか、Tab キーで選ぶと値が出ます。「表で見る」で、表でも見られます。これらの数字は、公開のサイトや GitHub には出しません。"),
  ];
}
