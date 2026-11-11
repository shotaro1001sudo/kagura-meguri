// 収集元ごとの読み取りのテスト(NPO広島神楽芸術研究所の日程表など)。実際のページと同じ形の見本で確かめる
import { readFileSync } from "node:fs";
import { parse, urls, decode } from "../scripts/adapters/npo-hiroshima.mjs";
import { reconcile, sameEvent } from "../scripts/lib/collect-core.mjs";
import { parse as parseOita, discover as discoverOita } from "../scripts/adapters/kagura-kaikan-oita.mjs";
import { parse as parseHanamaki, urls as hanamakiUrls } from "../scripts/adapters/hanamaki.mjs";
import { parse as parseUnnan } from "../scripts/adapters/unnan-kagura.mjs";
import { parse as parseTakachiho } from "../scripts/adapters/takachiho-yokagura.mjs";
import { parse as parseIwate } from "../scripts/adapters/iwate-kagura-table.mjs";
import { parse as parseMie, discover as discoverMie } from "../scripts/adapters/kankomie.mjs";

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
  section("収集元候補: 利用条件・アダプタ検証前は無効");
  const allSources = JSON.parse(readFileSync("data/sources.json", "utf8").replace(/^﻿/, ""));
  const stagedIds = ["hanamaki-hayachine", "kagura-kaikan-oita", "miyazaki-kanko-events", "okayama-kanko-kagura", "hamada-yokagura", "shimane-kagura-calendar"];
  const staged = allSources.filter((s) => stagedIds.includes(s.id));
  ok(staged.length === 6 && new Set(allSources.map((s) => s.id)).size === allSources.length, "6つの公式候補をID重複なく登録");
  ok(staged.filter((s) => !["kagura-kaikan-oita", "hanamaki-hayachine"].includes(s.id)).every((s) => s.enabled === false && !s.termsChecked && s.reviewStatus === "候補・未接続"), "未検証の残り4候補は収集・自動掲載を起動しない");
  ok(allSources.filter((s) => s.enabled !== false && !s.nationalExpansion).length === 7, "既存3情報源と、実HTML検証済の神楽会館・花巻観光協会・雲南市観光協会・観光三重だけを有効化する");

  section("宮崎・高千穂の夜神楽日程表: 会場は神社ではなく神楽宿");
  const tk = allSources.find((s) => s.id === "takachiho-yokagura");
  const row = (d, area, shrine, yado) => `<td class="list_item"><ul><li>${d}</li><li>${area}</li><li>${shrine}</li><li>${yado}</li><li>3㎞</li><li>100台</li></ul></td>`;
  const tkHtml = "<table><tr>" + row("2026年12月19日（土）", "三田井（浅ヶ部公民館）", "磐下大権現神社", "浅ヶ部公民館神事：13：00～舞入れ：15：00～")
    + row("2026年11月14日（土）", "押方（五ヶ村西公民館）", "中畑神社", "神楽宿：五ヶ村西公民館舞入れ：17：00～神 事：18：00～")
    + row("2026年12月12日（土）", "三田井（上川登公民館）", "赤石神社", "上川登公民館神事のみ 12：30～")
    + row("2026年12月12日（土）", "押方（下押方公民館）", "嶽宮神社", "個人宅神事：16：00～舞入れ：15：30～") + "</tr></table>";
  const tki = parseTakachiho(tkHtml, tk, tk.url);
  ok(tk.adapter === "takachiho-yokagura" && tki.length === 2, "神事のみ・個人宅の行は掲載しない", JSON.stringify(tki.map((x) => x.name)));
  ok(tki[0].venue === "浅ヶ部公民館" && tki[1].venue === "五ヶ村西公民館", "会場は4列目の神楽宿(3列目の神社を会場にしない)", JSON.stringify(tki.map((x) => x.venue)));
  ok(tki[0].start === "2026-12-19T00:00" && tki[0].timeUnknown && tki[0].name === "高千穂の夜神楽 三田井（浅ヶ部公民館）", "名称と日付の読み方は従来どおり(掲載済み・却下済みのIDを変えない)", JSON.stringify(tki[0]));
  const live = JSON.parse(readFileSync("data/events.json", "utf8")).find((e) => e.id === "takachiho-yokagura-530a848d06");
  ok(live?.venue === "浅ヶ部公民館" && live.start === "2026-12-19T13:00" && /磐下大権現神社とは場所が異なる/.test(live.description), "本番データ: 12/19 の会場は神楽宿(浅ヶ部公民館)。神事は13:00、舞入れ15:00");

  section("島根・雲南市観光協会: 月ごとの神楽公演スケジュール");
  const un = allSources.find((s) => s.id === "unnan-kagura");
  ok(un?.adapter === "unnan-kagura" && un.enabled === true && un.termsChecked === "2026-11-09", "規約・robots を確かめて有効化");
  const para = (n, d, v, g, t, extra = "") => `<p>&lt;イベント名&gt;　${n}<br />&lt;日　　時&gt;　${d}<br />&lt;会　　場&gt;　${v}<br />&lt;出演団体&gt;　${g}<br />&lt;時　　間&gt;　${t}${extra}</p>`;
  const unHtml = `<html><head><title>x</title></head><body><h1>【お知らせ】雲南市内神楽団体 神楽公演スケジュール（2026年12月分）</h1>`
    + para("出雲神楽の夕べ", "12月5日（土）", "古代鉄歌謡館（大東町中湯）", "中野神楽保存会（三刀屋町中野）", "19:00～", '<br /><a href="https://www.unnan-kankou.jp/news/x/">＜詳細はこちら＞</a>')
    + para("坂本神社例大祭", "12月6日（日）", "坂本神社（大東町薦澤）", "薦沢神楽社中（大東町薦沢）", "15:00頃～")
    + para("下山佐地区文化祭", "12月13日（日）", "下山佐交流センター（安来市広瀬町）", "薦沢神楽社中（大東町薦沢）", "13:30～", "<br />&lt;料　　金&gt;　500円")
    + para("桃源郷まつり", "1月10日（日）", "はなもも体育館（久野多目的施設）", "南加茂貴船神楽社中（加茂町南加茂）", "11:00～")
    + para("関係者のみの奉納", "12月20日（日）", "某神社（大東町）", "某社中", "10:00～ ※非公開")
    + "</body></html>";
  const ui = parseUnnan(unHtml, un, un.url);
  ok(ui.length === 4, "一般公開でないものは除く", JSON.stringify(ui.map((x) => x.name)));
  ok(ui[0].start === "2026-12-05T19:00" && ui[0].city === "雲南市" && ui[0].address === "大東町中湯" && ui[0].url.endsWith("/news/x/"), "時刻・地名・詳細ページを読む", JSON.stringify(ui[0]));
  ok(ui[1].timeUnknown && ui[1].start === "2026-12-06T00:00" && ui[1].name.includes("神楽(薦沢神楽社中)"), "「頃」の時刻は推測せず時刻未定。名称に神楽がなければ、出演団体を添える", JSON.stringify(ui[1]));
  ok(ui[2].city === "安来市" && ui[2].address === "広瀬町" && ui[2].fee === "500円", "雲南市外の会場は、その市町村で登録する", JSON.stringify(ui[2]));
  ok(ui[3].start === "2027-01-10T11:00" && ui[3].venue === "はなもも体育館(久野多目的施設)" && !ui[3].address, "12月分のページの1月は翌年。地名でないかっこは会場名に残す", JSON.stringify(ui[3]));
  let threw = false; try { parseUnnan(unHtml.replace("（2026年12月分）", ""), un, un.url); } catch { threw = true; }
  ok(threw, "見出しに年月がなければ、年を推測せずに失敗にする");

  section("岩手県 花北・遠野応援隊: 神楽公演情報の表");
  const iw = allSources.find((s) => s.id === "iwate-hanakitatoono");
  ok(iw?.adapter === "iwate-kagura-table" && iw.enabled === true && iw.collectionMode === "events" && iw.termsChecked === "2026-11-09" && iw.linkUrl === "https://www.pref.iwate.jp/", "表を自動で読む。公式リンクは県のトップページ(トップ以外へのリンクは問い合わせ事項のため)");
  const tr = (d, n, b) => `<tr><td>${d}</td><td>${n}</td><td>${b}</td></tr>`;
  const iwHtml = "<table><tr><th>公演日</th><th>名 称</th><th>内容</th></tr>"
    + tr("2027年1月2日（土曜）", "大償神楽舞初め", "10時30分～15時 大償神楽 会場：神楽の館（花巻市大迫町内川目第39地割37-2） 交通アクセス：…")
    + tr("2027年2月7日（日曜）", "菅原神社例大祭", "11時30分～大出早池峰神楽、と平倉神楽 会場：菅原神社（〒028-0663 遠野市附馬牛町下附馬牛5地割50） コメント：岳の人から神楽を習った")
    + tr("2027年2月14日（日曜）", "鱒沢神楽公演", "開場12時45分 開演13時15分 鱒沢神楽 会場：宮守農村婦人の家（遠野市宮守町上鱒沢8-66）")
    + tr("2027年3月1日（月曜）～2日（火曜）", "例大祭", "1日 17時30分～宵宮祭 小倉神楽 会場：早池峯神社（遠野市附馬牛町上附馬牛19-81）")
    + tr("2027年3月6日（土曜）", "遠野まつり", "○郷土芸能パレード 12:05～ 湧水神楽 ○神楽共演会（市役所前）")
    + tr("2027年3月7日（日曜）", "獅子踊り大会", "10時～ 長野獅子踊り 会場：小友地区センター（遠野市小友町）")
    + tr("2027年3月8日（月曜）", "石鳩岡神楽舞初め", "13時～ 石鳩岡神楽 ※中止 会場：石鳩岡振興センター（花巻市東和町石鳩岡5区311）") + "</table>";
  const iwi = parseIwate(iwHtml, iw, iw.url);
  ok(iwi.length === 4, "会場が1つに決まらない行・神楽の団体がない行・中止の行は載せない", JSON.stringify(iwi.map((x) => x.name)));
  ok(iwi[0].start === "2027-01-02T10:30" && iwi[0].kagura === "早池峰神楽" && iwi[0].venue === "神楽の館" && iwi[0].city === "花巻市" && iwi[0].url === "https://www.pref.iwate.jp/", "年は公演日のセルから。大償・岳は早池峰神楽", JSON.stringify(iwi[0]));
  ok(iwi[1].name === "菅原神社例大祭(大出早池峰神楽・平倉神楽)" && iwi[1].kagura === "岩手の神楽" && iwi[1].address === "遠野市附馬牛町下附馬牛5地割50", "名称に神楽がなければ出演団体を添える(コメント文や助詞は拾わない)。郵便番号は住所に入れない", JSON.stringify(iwi[1]));
  ok(iwi[2].start === "2027-02-14T13:15", "開演の時刻を開場より優先する", iwi[2].start);
  ok(iwi[3].timeUnknown && iwi[3].start === "2027-03-01T00:00", "複数日の行は時刻を推測しない", JSON.stringify(iwi[3]));
  let iwThrew = false; try { parseIwate("<table><tr><td>a</td><td>b</td><td>c</td></tr></table>", iw, iw.url); } catch { iwThrew = true; }
  ok(iwThrew, "「公演日」の表がなければ、0件ではなく失敗にする(ページ構造の変化に気づくため)");

  section("三重・観光三重: イベント検索「神楽」の詳細ページ");
  const mie = allSources.find((s) => s.id === "kankomie-kagura");
  ok(mie?.adapter === "kankomie" && mie.enabled === true && mie.termsChecked === "2026-11-09" && mie.requestDelayMs >= 5000, "規約・robots を確かめて有効化(取得間隔5秒)");
  const card = (id, title, d) => `<a class="d-block h-100 card text-decoration-none" href="/event/${id}"><p class="card-description"><span>${d}</span></p><div class="card-body"><p class="card-text fw-bold text-gray-800">${title}</p></div></a>`;
  const list = card(35041, "伊勢大神楽", "2026年12月24日(木)") + card(17003, "【多度大社】 新春開運初神楽", "2027年1月1日") + card(35736, "鸕宮神社秋祭", "2026年12月12日");
  ok(JSON.stringify(discoverMie(list, mie, mie.url)) === JSON.stringify(["https://www.kankomie.or.jp/event/35041"]), "名称に神楽を含む催しだけ詳細を読む(初神楽などの祈祷は除く)");
  const mrow = (k, v) => `<div class="d-md-flex"><div class="mb-0 p-2 bg-light fw-bold col-md-3">${k}</div><div class="mb-0 p-2 col-md-9">${v}</div></div>`;
  const detail = (title, period, venue, addr) => `<html><head><title>${title} | イベント | 観光三重(かんこうみえ)</title></head><body><h1>${title}<small>ヨミガナ</small></h1>${mrow("開催期間", period)}${mrow("会場", venue)}${mrow("住所", addr)}</body></html>`;
  const m1 = parseMie(detail("伊勢大神楽", "2026年12月24日(木)", "増田神社", "桑名市太夫155"), mie, "https://www.kankomie.or.jp/event/35041");
  ok(m1.length === 1 && m1[0].name === "伊勢大神楽" && m1[0].kagura === "伊勢大神楽" && m1[0].start === "2026-12-24T00:00" && m1[0].timeUnknown && m1[0].city === "桑名市" && m1[0].venue === "増田神社", "名称は title から(読み仮名を含めない)。時刻は推測しない", JSON.stringify(m1));
  ok(parseMie(detail("獅子神楽", "毎年12月01日", "神社", "鈴鹿市山本町"), mie, "https://www.kankomie.or.jp/event/1").length === 0, "年のない開催期間は読まない");
  ok(parseMie(detail("鸕宮神社獅子神楽", "御渡祭:2026年12月12日(土)、例大祭:2026年12月20日(日)", "鸕宮神社", "伊賀市"), mie, "https://www.kankomie.or.jp/event/2").length === 0, "日付が複数並び、神楽の日が分からないものは読まない");
  ok(parseMie(detail("伊勢大神楽", "2026年12月24日(木)", "会館", "愛知県名古屋市"), mie, "https://www.kankomie.or.jp/event/3").length === 0 && parseMie(list, mie, mie.url).length === 0, "県外の会場と、一覧ページそのものは取らない");

  section("岩手・花巻観光協会: 月ごとのページから、神楽の催しだけを取り出す");
  const hk = allSources.find((s) => s.id === "hanamaki-hayachine");
  ok(hk.adapter === "hanamaki" && hk.enabled === true && hk.termsChecked === "2026-11-09", "規約・robots を確かめて有効化");
  const hkUrls = hanamakiUrls(hk, new Date("2026-11-30T20:00:00Z")); // 日本時間では12月1日
  ok(hkUrls.length === 3 && hkUrls[0].endsWith("?m=12") && hkUrls[2].endsWith("?m=2"), "日本時間の今月から3か月ぶん(年をまたぐ)", hkUrls.join(" "));
  const ev = (day, title, area, place) => `<div class="main-event cf"><img src="x.jpg" alt="${title}" /><p class="day">${day}</p><h3><a href="event_detail.php?id=1&m=">${title}</a></h3><p class="p-bold"><span>${area}</span>${place}</p><p>説明</p></div>`;
  const hkHtml = ev("2026年12月13日(日)", "おおはさま神楽の日【12月 岳神楽】", "大迫", "花巻市大迫交流活性化センター")
    + ev("2026年9月19日(土)から11月23日(月祝)まで", "【花巻市総合文化財センター】企画展 早池峰神楽ー研究史からたどるー", "大迫", "花巻市総合文化財センター")
    + ev("2026年10月31日(土)、11月1日(日)", "キッチンカー祭り全国神楽まつりの陣", "大迫地区", "大迫交流活性化センター")
    + ev("2026年11月14日(土)", "秋の感謝祭 スイーツフェスタ", "花巻地区", "道の駅石鳥谷");
  const hkItems = parseHanamaki(hkHtml, hk, "https://www.kanko-hanamaki.ne.jp/event/index.php?m=12");
  ok(hkItems.length === 1 && hkItems[0].start === "2026-12-13T00:00" && hkItems[0].timeUnknown && hkItems[0].venue === "大迫交流活性化センター" && hkItems[0].prefecture === "岩手県",
    "神楽の公演だけ(企画展・キッチンカー・神楽以外は除く)。地区名は会場から外し、時刻は未定のまま", JSON.stringify(hkItems));
  ok(hkItems[0].url.startsWith("https://www.kanko-hanamaki.ne.jp/event/event_detail.php"), "詳細ページを公式情報として使う");

  section("大分・神楽会館: 記事投稿日や予約開始日を開催日と誤認しない");
  const oita = allSources.find((s) => s.id === "kagura-kaikan-oita");
  ok(oita && oita.adapter === "kagura-kaikan-oita" && oita.enabled === true && oita.termsChecked === "2026-10-22", "専用アダプタとライブ検証を確認済みの1件だけ有効化");
  const category = `<h1>公演のお知らせ</h1>
    <a href="/performance/304.html">令和8年11月一般公演（第210回）のご案内</a>
    <a href="/performance/305.html">令和8年12月自主公演のご案内</a>
    <a href="/performance/301.html">令和8年度の神楽公演計画のご案内</a>
    <a href="https://outside.example/performance/309.html">令和8年一般公演</a>`;
  const links = discoverOita(category, oita);
  ok(links.length === 2 && links[0].endsWith("/304.html") && links[1].endsWith("/305.html"), "一般/自主公演の記事だけを発見。年間計画・他ドメインは除外", links.join(" / "));
  const page = `<html><body><h1>お知らせ</h1>
    <p>投稿日：2026年10月16日</p><h2>令和８年１１月一般公演（第２１０回）のご案内 ～１０月２０日から予約受付～</h2>
    <p>チケットは令和8年10月20日から予約開始</p>
    <table><tr><th>公演日時</th><td>令和８年１１月１５日（日）１２時３０分～１５時３０分</td></tr>
    <tr><th>出演団体／演目</th><td>浅草流松尾神楽／未定</td></tr>
    <tr><th>入場料</th><td>一般1,200円／中学生以下500円</td></tr>
    </table></body></html>`;
  const item = parseOita(page, oita, links[0])[0];
  ok(item?.start === "2026-11-15T12:30" && item?.end === "2026-11-15T15:30" && item?.url === links[0], "公演日時欄のみから11/15 12:30-15:30を抽出（10/16投稿日・10/20予約開始を除外）", JSON.stringify(item));
  ok(item?.name.includes("一般公演") && !item?.name.includes("予約受付") && item?.prefecture === "大分県" && item?.venue === "神楽会館" && /1,200/.test(item?.fee ?? ""), "タイトル、地域、会場、料金を必要最小限取得", JSON.stringify(item));
  ok(item?.kagura === "豊後神楽", "御嶽神楽以外の団体が出る回は、収集元の既定の神楽の種類のまま", item?.kagura);
  const perf = (td) => parseOita(`<h2>令和8年12月一般公演(第211回)のご案内</h2><table><tr><th>公演日時</th><td>令和8年12月20日(日)12時30分～15時30分</td></tr><tr><th>出演団体／演目</th><td>${td}</td></tr></table>`, oita, links[1])[0]?.kagura;
  ok(perf("御嶽神楽／五方礼始・誓約・太平楽・天孫降臨") === "御嶽神楽" && perf("緒方三社神楽保存会／五穀舞・岩戸開<br>御嶽流吉田俚楽座／平国・八雲払") === "豊後神楽"
    && perf("御嶽神楽／五方礼始<br>緒方三社神楽保存会／岩戸開") === "豊後神楽", "出演が御嶽神楽だけの回だけ、神楽の種類を御嶽神楽にする(SEO-20261110-3。<br> で分かれた団体をすべて見る)");
  const noTime = parseOita('<h2>令和8年12月自主公演のご案内</h2><dl><dt>公演日時</dt><dd>令和8年12月20日(日)</dd></dl>', oita, links[1])[0];
  ok(noTime?.start === "2026-12-20T00:00" && noTime?.timeUnknown, "時刻未発表は時間未定、勝手な開演時刻を付けない", JSON.stringify(noTime));
  ok(parseOita('<h2>令和8年度の神楽公演計画</h2><time>2026年2月4日</time>', oita, links[0]).length === 0, "年度計画や投稿日のみの記事は除外");
  let rejectedBadDate = false;
  try { parseOita('<h2>令和8年11月一般公演</h2><table><tr><th>公演日時</th><td>令和8年13月40日 12時30分</td></tr></table>', oita, links[0]); } catch { rejectedBadDate = true; }
  ok(rejectedBadDate, "不正な公演日は例外にして収集元を変更しない");
  let rejectedMissing = false;
  try { parseOita('<h2>令和8年11月一般公演</h2><time>2026年10月16日</time><p>予約開始 10月20日</p>', oita, links[0]); } catch { rejectedMissing = true; }
  ok(rejectedMissing, "公演日時欄が消えた場合は投稿日・予約日で代用しない");
  const rec = reconcile({ events: [], candidates: [item, item], source: oita, now: new Date("2026-10-22T10:00:00+09:00"), cfg: { autoPublish: false } });
  ok(rec.summary.held.length === 1 && rec.summary.duplicates === 1 && rec.summary.published.length === 0, "dry-runは公開なし・同一日の重複を検出");

  // 既存掲載の神楽会館11月公演と、公式サイト側の表記違いを二重掲載しない。
  const existingOita = { name: "神楽会館 11月一般公演(御嶽神楽)", start: "2026-11-15T12:30",
    prefecture: "大分県", city: "豊後大野市", venue: "神楽会館" };
  const importedOita = { name: "神楽会館 令和8年11月一般公演(第210回)", start: "2026-11-15T12:30",
    prefecture: "大分県", city: "豊後大野市", venue: "神楽会館" };
  ok(sameEvent(existingOita, importedOita), "既存11月公演と公式一般公演を同じ1件と判定");
  ok(!sameEvent(existingOita, { ...importedOita, start: "2026-11-15T15:00" }), "同会場でも異なる開演時刻は統合しない");
  ok(!sameEvent(existingOita, { ...importedOita, city: "大分市" }), "同名会場でも異なる市町村は統合しない");
  ok(!sameEvent(existingOita, { ...importedOita, venue: "" }), "会場が不明なら名前以外を根拠に重複としない");
  const oitaDedup = reconcile({ events: [{ ...existingOita, id: "manual-oita", status: "published" }],
    candidates: [importedOita], source: oita, now: new Date("2026-10-22T09:00:00Z") });
  ok(oitaDedup.summary.duplicates === 1 && oitaDedup.summary.published.length === 0,
    "既存の一般公演を維持し、同じ11月公演の自動再掲載は0件");

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
