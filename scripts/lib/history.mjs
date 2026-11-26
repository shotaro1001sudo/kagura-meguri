// 「神楽の歴史」(/history/)の本文と年表。
// 年代・出来事は、下の SOURCES の辞典・公的な情報に書かれていることだけを書く。
// 出典は、文末の小さな番号([1] など)で示し、各ページの最後にまとめる。番号は、そのページの本文に初めて出てくる順。
// 出典の文章は、そのまま写さず、要約して書く。内容を変えたら CHECKED(確認日)を更新する。

import { figure, flow, tree, table, yudateDiagram } from "./figures.mjs";

export const CHECKED = "2026-11-26";

export const SOURCES = [
  { id: "kotobank", name: "神楽(日本大百科全書・世界大百科事典・日本国語大辞典ほか)", by: "コトバンク", url: "https://kotobank.jp/word/神楽" },
  { id: "kb-minzokugeino", name: "民俗芸能(日本大百科全書・改訂新版 世界大百科事典)", by: "コトバンク", url: "https://kotobank.jp/word/民俗芸能" },
  { id: "kojiki-iwaya2", name: "古事記ビューアー「天の石屋②」", by: "國學院大學 古事記学センター", url: "https://kojiki.kokugakuin.ac.jp/kojiki/天の石屋②/" },
  { id: "kojiki-iwaya3", name: "古事記ビューアー「天の石屋③」", by: "國學院大學 古事記学センター", url: "https://kojiki.kokugakuin.ac.jp/kojiki/天の石屋③/" },
  { id: "kb-yudate", name: "湯立(日本大百科全書・改訂新版 世界大百科事典ほか)", by: "コトバンク", url: "https://kotobank.jp/word/湯立" },
  { id: "matsue-sada", name: "佐陀神能保存会", by: "松江市", url: "https://www.city.matsue.lg.jp/soshikikarasagasu/bunkasportsbu_bunkashinkoka/bunkaryoku/2/traditionalculturecouncil/17856.html" },
  { id: "bunka-sada", name: "佐陀神能", by: "文化庁 文化遺産オンライン", url: "https://online.bunka.go.jp/heritages/detail/214569" },
  { id: "kb-sada", name: "佐陀神能(改訂新版 世界大百科事典ほか)", by: "コトバンク", url: "https://kotobank.jp/word/佐陀神能" },
  { id: "matsue", name: "第12回市史講座ミニレポート「松江の芸能」", by: "松江市", url: "https://www.city.matsue.lg.jp/material/files/group/34/kouza27-12.pdf" },
  { id: "jh-iwami", name: "日本遺産ストーリー「神々や鬼たちが躍動する神話の世界〜石見地域で伝承される神楽〜」", by: "文化庁 日本遺産ポータルサイト", url: "https://japan-heritage.bunka.go.jp/ja/stories/story079/" },
  { id: "kb-daikagura", name: "太神楽(日本大百科全書・改訂新版 世界大百科事典ほか)", by: "コトバンク", url: "https://kotobank.jp/word/太神楽" },
  { id: "kb-koshitsu-saishi", name: "皇室祭祀(日本大百科全書・改訂新版 世界大百科事典ほか)", by: "コトバンク", url: "https://kotobank.jp/word/皇室祭祀" },
  { id: "hamada", name: "石見神楽の保存・伝承に関する提言書(案)", by: "浜田市(石見神楽伝承内容検討専門委員会)", url: "https://www.city.hamada.shimane.jp/www/contents/1730249812965/simple/shiryou2-1.pdf" },
  { id: "iida", name: "遠山の霜月祭", by: "飯田市", url: "https://www.city.iida.lg.jp/site/bunkazai/shimotsukimatsuri.html" },
  { id: "aichinow", name: "花祭(東栄町)", by: "愛知県公式観光サイト Aichi Now", url: "https://aichinow.pref.aichi.jp/events/detail/1643/" },
  { id: "mext-120", name: "学制百二十年史「文化財保護法の改正」", by: "文部科学省", url: "https://www.mext.go.jp/b_menu/hakusho/html/others/detail/1318555.htm" },
  { id: "miyazaki-kyogikai", name: "全国神楽継承・振興協議会設立総会について(報告)", by: "宮崎県", url: "https://www.pref.miyazaki.lg.jp/documents/73060/73060_20221206151009-1.pdf" },
  { id: "bunka-unesco-r7", name: "報道発表「令和7年度におけるユネスコ無形文化遺産への提案を決定」", by: "文化庁", url: "https://www.bunka.go.jp/koho_hodo_oshirase/hodohappyo/94297901.html" },
  { id: "kyogikai", name: "全国神楽継承・振興協議会", by: "全国神楽継承・振興協議会", url: "https://www.miyazaki-archive.jp/kagura/" },
  { id: "tosa", name: "土佐の神楽", by: "文化庁 文化遺産オンライン", url: "https://online.bunka.go.jp/db/heritages/detail/170195/4" },
];

// 時代ごとのページ。slug は /history/<slug>.html
export const ERAS = [
  { slug: "kodai", title: "古代", span: "神話の時代〜平安時代", lead: "天岩戸の神話から、宮中で御神楽が生まれるまで。" },
  { slug: "chusei", title: "中世", span: "鎌倉〜室町・戦国時代", lead: "湯立や能の影響を受けながら、各地へ広がった時代。" },
  { slug: "kinsei", title: "近世", span: "江戸時代", lead: "出雲流・伊勢流・里神楽が、それぞれに育った時代。" },
  { slug: "kindai", title: "近代・現代", span: "明治時代〜現在", lead: "担い手が民間へ広がり、文化財として守られるようになるまで。" },
];

// 年表(横にスクロールして見る)。era は、くわしく読めるページ。
export const TIMELINE = [
  { year: "神話", text: "天岩戸の前で天鈿女命が舞ったと伝わる(古事記・日本書紀)", era: "kodai", anchor: "iwato" },
  { year: "807年", text: "神事芸能としての「神楽」の語が、『古語拾遺』に初めて出てくる", era: "kodai", anchor: "kagura-word" },
  { year: "1002年", text: "宮中の内侍所御神楽が始まる(1005年とも伝わる)", era: "kodai", anchor: "mikagura" },
  { year: "1281年", text: "異国征討を祈る臨時の神楽が行われる", era: "chusei", anchor: "rinji" },
  { year: "1608年", text: "佐太神社の神職が、能楽の形式を取り入れた「神能」を始めたと伝わる", era: "kinsei", anchor: "sada" },
  { year: "江戸時代", text: "伊勢の太太神楽が各地に広がり、江戸では里神楽が発達する", era: "kinsei", anchor: "ise" },
  { year: "明治時代", text: "神職が神楽を舞うことが禁じられ、民間の人たちも神楽を担うようになる", era: "kindai", anchor: "meiji" },
  { year: "1908年", text: "皇室祭祀令で、御神楽が「小祭」のひとつに定められる", era: "kindai", anchor: "mikagura-modern" },
  { year: "1976年", text: "佐陀神能などが重要無形民俗文化財に指定され、各地の神楽が国の文化財として守られていく", era: "kindai", anchor: "heritage" },
  { year: "2022年", text: "全国神楽継承・振興協議会が設立される", era: "kindai", anchor: "today" },
  { year: "2025年", text: "神楽が、ユネスコ無形文化遺産への新しい提案の候補に選ばれる(審議は2028年の見込み)", era: "kindai", anchor: "today" },
];

/** 出典の番号を、ページごとに振る(本文で初めて出てきた順) */
function makeCiter(esc) {
  const order = [];
  const cite = (...ids) => ids.map((id) => {
    if (!SOURCES.some((s) => s.id === id)) throw new Error(`出典がありません: ${id}`);
    let n = order.indexOf(id) + 1;
    const first = n === 0;
    if (first) { order.push(id); n = order.length; }
    return `<sup class="cite"><a href="#src-${n}"${first ? ` id="ref-${n}"` : ""} aria-label="出典${n}">[${n}]</a></sup>`;
  }).join("");
  const sourcesHtml = () => {
    const list = order.map((id, i) => {
      const s = SOURCES.find((x) => x.id === id);
      return `<li id="src-${i + 1}"><a href="${s.url}" rel="noopener" target="_blank">${esc(s.name)}</a>(${esc(s.by)}) <a class="back" href="#ref-${i + 1}" aria-label="本文の出典${i + 1}へ戻る">↩</a></li>`;
    }).join("");
    return `<h2 id="sources">出典</h2><ol class="sources">${list}</ol>
<p class="meta">確認日: ${CHECKED.replace(/^(\d{4})-0?(\d+)-0?(\d+)$/, "$1年$2月$3日")}。上の辞典や公的な情報をもとに要約しています。神楽の起源や年代には諸説あります。</p>`;
  };
  return { cite, sourcesHtml, used: () => [...order] };
}

/** 年表(横にスクロール)。キーボードでも動かせるよう、tabindex を付ける */
export function timelineHtml({ esc }) {
  const items = TIMELINE.map((t) => {
    const era = ERAS.find((e) => e.slug === t.era);
    return `<li class="tl-item"><span class="tl-year">${esc(t.year)}</span><p>${esc(t.text)}</p><a href="/history/${t.era}.html#${t.anchor}">${esc(era.title)}で、くわしく<span aria-hidden="true"> ›</span></a></li>`;
  }).join("");
  return `<div class="tl" role="region" aria-label="神楽の年表" tabindex="0"><ol class="tl-list">${items}</ol></div>
<p class="meta tl-hint"><span aria-hidden="true">← </span>横にスクロールして、神話の時代から現代まで、たどれます<span aria-hidden="true"> →</span></p>`;
}

/**
 * 時代タブ(総論と4つの時代のページ)と、今のページの見出しの一覧を、本文の横(スマホ・タブレットは上)に置く。
 * スマホ・タブレットでは時代タブだけを横一列に固定し、PCでは今のページの下に見出しを並べる。今読んでいる見出しは reader.js が示す
 * @param {string} key "index" または時代の slug
 * @param {string} html そのページの本文
 */
export function historyReader(key, html) {
  const pages = [{ slug: "index", title: "総論・年表", href: "/history/" }, ...ERAS.map((e) => ({ slug: e.slug, title: e.title, href: `/history/${e.slug}.html` }))];
  const heads = [...html.matchAll(/<h2 id="([^"]+)">([^<]+)<\/h2>/g)].filter(([, id]) => id !== "sources");
  const sub = heads.length ? `<ol class="gnav-sub">${heads.map(([, id, t]) => `<li><a href="#${id}">${t}</a></li>`).join("")}</ol>` : "";
  const nav = `<nav class="toc gnav" id="toc" aria-label="神楽の歴史の目次"><p class="gnav-h">神楽の歴史</p><ol>${pages.map((p, i) => `<li><a href="${p.href}"${p.slug === key ? ' aria-current="page"' : ""}>${i ? `<span class="no">${String(i).padStart(2, "0")}</span>` : ""}${p.title}</a>${p.slug === key ? sub : ""}</li>`).join("")}</ol></nav>`;
  return `<div class="read-layout">${nav}<div class="read-body">${html}</div></div>`;
}

/**
 * 各ページの本文を作る。
 * @param {object} x
 * @param {(s:string)=>string} x.esc
 * @param {(k:string)=>string} x.kaguraLink 神楽の種類ページへのリンク(ページがなければ、名前だけ)
 */
export function historyPages({ esc, kaguraLink }) {
  const pages = {};

  // ---------- 総論 ----------
  {
    const { cite, sourcesHtml, used } = makeCiter(esc);
    pages.index = {
      title: "神楽の歴史・起源とは？神話から現代までを年表で解説",
      h1: "神楽の歴史",
      sub: "神話の時代から現代まで、年表と4つの時代で読む",
      desc: "神楽はいつ、どのように生まれ、広まったのでしょうか。天岩戸の神話、宮中の御神楽、各地の里神楽を年表と4つの時代で紹介。起源や年代の諸説にも触れ、古代から現代までの歩みをたどります。",
      body: () => `
<p>神楽(かぐら)は、神様を迎え、災いを祓い、神様とともに楽しむために神前で奉納される歌と舞です。${cite("kyogikai")}古くは「神遊び」とも呼ばれました。${cite("kotobank")}「かぐら」という言葉は「神座(かみくら)」が変化したもの、というのが定説です。${cite("kotobank")}</p>
<p>全国には4,000を超える神楽があるといわれます。${cite("kyogikai")}ひと口に「神楽」といっても、宮中に伝わる御神楽もあれば、神社の湯立や獅子舞、能のような物語の舞もあり、その姿はさまざまです。このページでは、そうした違いがどんな歴史から生まれたのかを、時代を追ってたどります。</p>

<h2 id="timeline">神楽の年表</h2>
${timelineHtml({ esc })}

<h2 id="eras">4つの時代</h2>
<div class="era-grid">${ERAS.map((e, i) => `<a class="era" href="/history/${e.slug}.html"><span class="no">${String(i + 1).padStart(2, "0")}</span><b>${esc(e.title)}</b><small>${esc(e.span)}</small><span>${esc(e.lead)}</span></a>`).join("")}</div>

<h2 id="types">神楽の大きな分け方</h2>
<p>神楽は、まず宮中で行われる「御神楽(みかぐら)」と、各地の神社や民間で行われる「里神楽(さとかぐら)」に分けられます。${cite("kotobank")}里神楽は、民俗芸能の研究者・本田安次(1906〜2001年)の分類にならって、次の4つに分けるのが一般的です。${cite("kb-minzokugeino", "kotobank")}ただし、これは整理のしかたのひとつです。出雲流を「採物神楽」、伊勢流を「湯立神楽」と呼ぶなど、研究者によって分け方や呼び名は異なります。${cite("kotobank")}</p>
${figure(tree("神楽", [
  { t: "御神楽(みかぐら)", d: "宮中の神楽。毎年12月に賢所で行われる" },
  { t: "里神楽(さとかぐら)", d: "各地の神社や民間で行われる神楽", children: [
    { t: "巫女神楽", d: "神官や巫女の神がかりによる鎮魂や託宣を、もとにした神楽です。" },
    { t: "出雲流", d: "島根県の佐太神社の七座神事と神能が、典型とされます。" },
    { t: "伊勢流", d: "伊勢神宮の湯立神楽に由来します。釜の湯を使う霜月神楽などに、その姿が残っています。" },
    { t: "獅子神楽", d: "獅子頭の力で悪魔払いや火伏せを行い、息災を祈ります。東北の山伏神楽や番楽などがあります。" },
  ] },
], "神楽の分類"), "神楽の大きな分け方を図にしました。里神楽の4つは、本田安次の分類によります。分け方や呼び名は、辞典や研究者によって異なります。")}
<p class="meta">「里神楽」は、東京を中心とする関東の出雲流の神楽を指す言葉としても使われます。${cite("kotobank")}</p>

<h2>時代ごとに読む</h2>
<p><a class="btn" href="/history/kodai.html">古代から読む</a> <a class="btn ghost" href="/guide.html">はじめての神楽ガイド</a> <a class="btn ghost" href="/kagura/">神楽の種類で探す</a></p>
${sourcesHtml()}`,
      used,
    };
    // used は body を呼んだあとで意味を持つ。呼び出し側で body() の後に参照する
  }

  // ---------- 古代 ----------
  {
    const { cite, sourcesHtml, used } = makeCiter(esc);
    pages.kodai = {
      title: "神楽の起源と古代 天岩戸の神話から、宮中の御神楽まで",
      h1: "古代の神楽",
      sub: "神話の時代〜平安時代",
      desc: "神楽の起源とされる天岩戸の神話から、「神楽」という言葉の初見、鎮魂祭、宮中の御神楽の成立(1002年)まで、古代の神楽をたどります。のちに各地へ広がる湯立にも触れ、出典と諸説も示します。",
      body: () => `
<p>神楽の歴史は、神話から始まります。ここでは、神楽の起源として語られる天岩戸の神話から、宮中で御神楽が成立する平安時代までを順に見ていきます。</p>

<h2 id="iwato">天岩戸の神話</h2>
<p>『古事記』と『日本書紀』には、天照大神が天岩戸に隠れ、世界が闇に包まれる話があります。八百万の神々が集まって手立てを相談するなか、天鈿女命(『日本書紀』の表記。『古事記』では天宇受売命)が伏せた桶を踏み鳴らし、神がかりして踊りました。${cite("kojiki-iwaya2")}『古事記』によれば、それを見た神々が笑い、何事かと天照大神が戸を少し開けたところを、天手力男神が引き出して、世界に光が戻ります。${cite("kojiki-iwaya3")}</p>
${figure(flow([
  { t: "天照大神が岩戸に隠れる", d: "世界が闇に包まれる" },
  { t: "八百万の神々が集まる", d: "鶏を鳴かせ、鏡や玉を用意する" },
  { t: "天鈿女命が神がかりして踊る", d: "伏せた桶を踏み鳴らす" },
  { t: "神々が笑う", d: "何事かと、天照大神が戸を少し開ける" },
  { t: "天手力男神が引き出す", d: "注連縄が張られる" },
  { t: "世界に光が戻る", d: "神楽の起源を語る説話とされる" },
], "天岩戸の神話の流れ", "v"), "天岩戸の神話の流れを、『古事記』の記述をもとに整理しました。")}
<p>この天鈿女命の神がかりの舞が、神楽の起源を語る説話とされています。${cite("kotobank")}各地の神楽に「岩戸」の演目があるのは、この神話が神楽の原点として受け継がれているからです。</p>

<h2 id="chinkon">鎮魂祭と猿女氏</h2>
<p>宮中では、新嘗祭の前日に「鎮魂祭」が行われていました。${cite("kotobank")}そこでは御巫女と猿女による神楽の舞があり、『古語拾遺』はこれを天岩戸の天鈿女命に由来するものとしています。${cite("kotobank")}神楽の本質は魂を招き、鎮める作法にあるとされ、猿女氏のほか物部氏や安曇氏など、いくつもの系統の鎮魂の作法が関わったと考えられています。${cite("kotobank")}</p>

<h2 id="kagura-word">「神楽」という言葉が初めて現れる</h2>
<p>「神楽」という言葉が文献に初めて登場するのは、大同2年(807年)の『古語拾遺』とされます。${cite("kotobank")}9世紀の終わりから10世紀の初めにかけて、石清水八幡宮や賀茂の臨時祭の神楽に「神楽」の字が使われるようになりました。${cite("kotobank")}</p>

<h2 id="mikagura">宮中の御神楽の成立</h2>
<p>宮中では貞観年間(859〜877年)に、豊楽院清暑堂で琴を伴う神の宴(琴歌神宴)が整えられました。${cite("kotobank")}そこへ賀茂の臨時祭や石清水八幡宮の臨時祭などの神楽が影響を与え、長保4年(1002年)、あるいは寛弘2年(1005年)に、内侍所の御神楽が始まったと伝えられています。${cite("kotobank")}</p>
<p>はじめは1年おきでしたが、のちに毎年12月の恒例行事になりました。${cite("kotobank")}御神楽は天皇の魂を鎮めるための、祈りの性格が強い儀式でした。${cite("kotobank")}平安時代の中ごろに形式が整えられ、いまも約90首の神楽歌が伝わっています。${cite("kotobank")}楽器は和琴・大和笛・笏拍子で、のちに篳篥が加わりました。${cite("kotobank")}</p>

${figure(flow([
  { t: "もとになった儀式", d: "琴歌神宴・賀茂臨時祭・石清水臨時祭などの神楽" },
  { t: "整理・統一される", d: "平安時代に形が整う" },
  { t: "内侍所御神楽の成立", d: "1002年(1005年とも)。のちに毎年12月の恒例に" },
], "宮中の御神楽が成立するまで", "h"), "宮中の御神楽ができあがるまでの流れです。")}
<h2 id="yudate">湯立とは</h2>
<p>のちに各地の神楽の中心となる「湯立」は、神前の大釜で湯を沸かし、巫女や神職、修験者が笹を湯に浸して、自分や周りの人に振りかける儀礼です。${cite("kb-yudate")}古くは「問い湯」とも呼ばれ、神の意思を問う占いの一種とされていました。${cite("kb-yudate")}</p>

<div class="hnav"><span></span><a class="next" href="/history/chusei.html"><small>次へ</small>中世の神楽 ›</a></div>
${sourcesHtml()}`,
      used,
    };
  }

  // ---------- 中世 ----------
  {
    const { cite, sourcesHtml, used } = makeCiter(esc);
    pages.chusei = {
      title: "中世の神楽 湯立と能の影響で、各地へ広がった時代",
      h1: "中世の神楽",
      sub: "鎌倉〜室町・戦国時代",
      desc: "鎌倉から室町時代にかけて、神楽は宮中から各地の神社へ広がりました。臨時の神楽、湯立神楽の広がり、能との関わり、出雲流神楽の成立を紹介します。中世の神楽の広がりを、出典とともにたどります。",
      body: () => `
<p>平安時代に宮中で形が整った神楽は、中世に入ると祈祷の場で使われるようになり、各地の神社や集落へも広がっていきました。担い手は神職に限らず、山伏(修験者)や巫女もいました。${cite("kotobank")}</p>

<h2 id="rinji">臨時の神楽</h2>
<p>宮中の御神楽は毎年12月の恒例行事でしたが、特別な祈りが必要なときには、臨時の神楽も行われました。弘安4年(1281年)には異国の征討を祈って、室町時代には天皇の病気平癒を願って臨時の神楽が催され、三夜にわたることもありました。${cite("kotobank")}</p>
<p>戦国時代までに途絶えてしまった祭祀の音楽もあるなかで、神楽だけは途切れることなく受け継がれたとされています。${cite("kotobank")}</p>

<h2 id="yudate-spread">湯立神楽の広がり</h2>
<p>中世には、盗みなどの真偽を確かめるために熱湯に手を入れさせる「湯起請」という神判も行われました。${cite("kb-yudate")}いっぽうで湯立は神楽と結びつき、湯立神楽として芸能になりました。東北では霜月神楽の名で呼ばれています。${cite("kb-yudate")}</p>
${figure(yudateDiagram(), "湯立のしくみです。神前の釜で湯を沸かし、巫女や神職が笹などを湯に浸して、自分や周りの人に振りかけます。")}
<p>湯立神楽を広めたのは、伊勢神宮外宮の御師だとされます。${cite("kotobank")}伊勢流の湯立神楽は、のちに伊勢では途絶えてしまいましたが、各地の霜月神楽などにその姿をとどめています。${cite("kotobank")}</p>

<h2 id="noh">能との関わり</h2>
<p>中世は、能が大成した時代でもあります。神楽は能の舞事のひとつにもなり、応永30年(1423年)の『三道』には能の神楽についての記述があります。${cite("kotobank")}逆に神楽の側も、能や田楽、猿楽の要素を取り入れました。里神楽はもともと神官や巫女の神がかりによる鎮魂と託宣でしたが、やがて田楽や猿楽を取り込み、出雲流などの形が生まれたとされます。${cite("kotobank")}</p>

<h2 id="izumo">出雲流神楽のはじまり</h2>
<p>島根県の佐太神社に伝わる「七座神事」と「神能」は、出雲流神楽のもっとも古い典型とされ、成立は中世の終わりから近世の初めごろと考えられています。${cite("kotobank")}</p>

<div class="hnav"><a class="prev" href="/history/kodai.html"><small>前へ</small>‹ 古代の神楽</a><a class="next" href="/history/kinsei.html"><small>次へ</small>近世の神楽 ›</a></div>
${sourcesHtml()}`,
      used,
    };
  }

  // ---------- 近世 ----------
  {
    const { cite, sourcesHtml, used } = makeCiter(esc);
    pages.kinsei = {
      title: "江戸時代の神楽 出雲流・伊勢流・里神楽が育った時代",
      h1: "近世(江戸時代)の神楽",
      sub: "江戸時代",
      desc: "江戸時代、神楽は出雲流の神能、伊勢の太太神楽、江戸の里神楽など、さまざまな形で発展しました。神楽が神社の儀式から身近な芸能へ広がった時代を、出典とともにたどります。",
      body: () => `
<p>江戸時代は、神楽が神社の儀式から、より身近な芸能へと広がっていった時代です。各地で独自の形が整い、いまの神楽の原型の多くがこのころにできあがりました。このページの「出雲流」「伊勢流」という呼び名は、本田安次の分類によるものです。</p>

<h2 id="sada">佐陀神能と出雲流</h2>
<p>佐太神社に仕える神官が慶長13年(1608年)に京へ上ったおり、能楽の所作や演出を習い覚えて帰り、その形式で作ったのが「神能」の始まりといわれています。${cite("matsue-sada")}天正より前に、社家が能楽にならって舞わせたものともいわれます。${cite("bunka-sada")}古くは、佐太神社の支配下にあった3郡半(秋鹿・島根・楯縫の3郡と意宇郡の半分)の神職が、そろって集まり行ったといいます。${cite("kb-sada")}</p>
<p>七座神事は面をつけずに採物を持って舞う舞、式三番は能の「翁」にあたる祝言の舞、神能は面をつけて神話を演じる劇です。${cite("kotobank", "matsue")}能のような神話劇と素朴な採物の舞をあわせ持つ出雲流は、各地の神楽に影響を与えました。${cite("kotobank")}</p>

<h2 id="ise">伊勢の太太神楽と、里神楽</h2>
<p>「太太神楽」は、もともと伊勢神宮に奉納する神楽を、お礼(報賽)の大小で分けた等級の名前でした。のちに奉納神楽そのものの美称となり、伊勢から各地へ広まっていきます。${cite("kotobank")}広まった先では、出雲流の内容が多く取り入れられました。${cite("kotobank")}</p>
<p>民間で行われる神楽を指す言葉が使われ始めたのも、この時代です。辞典は、諸社や民間の神楽という意味での用例として、寛永15年(1638年)の『毛吹草』を挙げています。${cite("kotobank")}江戸では里神楽が発達し、神話をせりふのない劇(黙劇)に仕立てた舞が演じられました。${cite("kotobank")}</p>
<p>各地を回って獅子舞を見せた太神楽は、余興だった曲芸に力を入れるようになり、江戸では寄席の芸になりました。${cite("kb-daikagura")}</p>

<p>この時代に整った神楽の多くは、神職や山伏、巫女などによって受け継がれました。${cite("kotobank")}その姿が大きく変わるのは、次の明治時代です。</p>

<div class="hnav"><a class="prev" href="/history/chusei.html"><small>前へ</small>‹ 中世の神楽</a><a class="next" href="/history/kindai.html"><small>次へ</small>近代・現代の神楽 ›</a></div>
${sourcesHtml()}`,
      used,
    };
  }

  // ---------- 近代・現代 ----------
  {
    const { cite, sourcesHtml, used } = makeCiter(esc);
    pages.kindai = {
      title: "近代・現代の神楽 氏子への継承から、文化財・世界遺産候補まで",
      h1: "近代・現代の神楽",
      sub: "明治時代〜現在",
      desc: "明治時代、神楽の担い手は神職から民間へ広がりました。宮中の御神楽のその後、文化財としての保護、ユネスコ無形文化遺産への動きまで、近代から現代の神楽を出典とともにたどります。",
      body: () => `
<p>明治時代、神楽は大きな転換点を迎えます。それまで神職が担っていた舞が氏子(地域の人たち)の手に渡り、いまの「神楽団」や「社中」のかたちが生まれました。</p>

<h2 id="meiji">明治の改革と、氏子への継承</h2>
${figure(flow([
  { t: "江戸時代まで", d: "神職・山伏・巫女が神楽を担う" },
  { t: "明治時代", d: "神職による神楽を禁じる命令" },
  { t: "民間の人も舞い手に", d: "地域の人たちが神楽を担う" },
], "神楽の担い手の変化", "h"), "神楽の担い手の移り変わりです。明治時代に、民間の人たちも神楽を担うようになりました。")}
<p>明治時代には、神職による神楽や託宣の神事を禁じる政府の命令が出されました。${cite("jh-iwami", "matsue")}それまで神職や山伏、巫女などが担ってきた神楽に、民間の人たちも携わるようになります。${cite("kotobank")}</p>
<p>一方、伊勢神宮の湯立神楽は、明治維新のころに伊勢では絶えてしまいました。${cite("kotobank")}明治7年(1874年)には、江戸で発達した神楽が「郷(里)神楽」と呼ばれるようになります。${cite("kotobank")}</p>

<h2 id="mikagura-modern">宮中の御神楽のその後</h2>
<p>宮中の御神楽は、明治以降、宮内庁楽部の楽人だけで奉仕するようになりました。${cite("kotobank")}明治41年(1908年)の皇室祭祀令で、賢所の御神楽は「小祭」のひとつとされました。祭祀令は昭和22年(1947年)に廃止されましたが、その後もほぼ同じ形で続けられています。${cite("kb-koshitsu-saishi")}いまも毎年12月中旬に、簡略化した御神楽が賢所で行われています。${cite("kotobank")}</p>

<h2 id="heritage">文化財としての保護</h2>
<p>昭和50年(1975年)の文化財保護法の改正で「重要無形民俗文化財」の指定制度ができ、翌昭和51年(1976年)5月4日には、佐陀神能などが指定されました。${cite("mext-120", "bunka-sada")}</p>
<p>その後も各地の神楽が相次いで指定され、国指定の神楽は、2025年の時点で40件とされています。${cite("kotobank")}</p>

<h2 id="today">現代の神楽</h2>
<p>全国に4,000を超えるといわれる神楽ですが、少子高齢化や過疎化によって、存続も継承も難しくなっています。${cite("kyogikai")}2022年10月11日には、神楽を守り盛り上げるために、全国神楽継承・振興協議会の設立総会が開かれました。${cite("miyazaki-kyogikai")}そして2025年11月28日、文化審議会の無形文化遺産部会が、神楽をユネスコ無形文化遺産への新しい提案の候補に選びました。2028年12月ごろに審議される見込みです。${cite("bunka-unesco-r7")}</p>
<p>神楽は、いまも各地で舞い継がれています。<a href="/calendar.html">日付・会場・キーワードから探す</a>や<a href="/kagura/">種類で探す</a>から、近くで観られる神楽を探してみてください。</p>

<div class="hnav"><a class="prev" href="/history/kinsei.html"><small>前へ</small>‹ 近世の神楽</a><a class="next" href="/history/"><small>最初へ</small>年表にもどる ›</a></div>
${sourcesHtml()}`,
      used,
    };
  }

  return pages;
}
