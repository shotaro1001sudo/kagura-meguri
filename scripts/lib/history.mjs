// 「神楽の歴史」(/history/)の本文と年表。
// 年代・出来事は、下の SOURCES の辞典・公的な情報に書かれていることだけを書く。
// 出典は、文末の小さな番号([1] など)で示し、各ページの最後にまとめる。番号は、そのページの本文に初めて出てくる順。
// 出典の文章は、そのまま写さず、要約して書く。内容を変えたら CHECKED(確認日)を更新する。

import { figure, flow, tree, table, yudateDiagram } from "./figures.mjs";

export const CHECKED = "2026-10-20";

export const SOURCES = [
  { id: "kotobank", name: "神楽(日本大百科全書・世界大百科事典・日本国語大辞典ほか)", by: "コトバンク", url: "https://kotobank.jp/word/神楽" },
  { id: "wiki-kagura", name: "神楽", by: "Wikipedia", url: "https://ja.wikipedia.org/wiki/神楽" },
  { id: "wiki-mikagura", name: "御神楽", by: "Wikipedia", url: "https://ja.wikipedia.org/wiki/御神楽" },
  { id: "wiki-yudate", name: "湯立", by: "Wikipedia", url: "https://ja.wikipedia.org/wiki/湯立" },
  { id: "wiki-iwato", name: "天岩戸", by: "Wikipedia", url: "https://ja.wikipedia.org/wiki/天岩戸" },
  { id: "wiki-sada", name: "佐陀神能", by: "Wikipedia", url: "https://ja.wikipedia.org/wiki/佐陀神能" },
  { id: "matsue", name: "第12回市史講座ミニレポート「松江の芸能」", by: "松江市", url: "https://www.city.matsue.lg.jp/material/files/group/34/kouza27-12.pdf" },
  { id: "wiki-iwami", name: "石見神楽", by: "Wikipedia", url: "https://ja.wikipedia.org/wiki/石見神楽" },
  { id: "hamada", name: "石見神楽の保存・伝承に関する提言書(案)", by: "浜田市(石見神楽伝承内容検討専門委員会)", url: "https://www.city.hamada.shimane.jp/www/contents/1730249812965/simple/shiryou2-1.pdf" },
  { id: "wiki-takachiho", name: "高千穂の夜神楽", by: "Wikipedia", url: "https://ja.wikipedia.org/wiki/高千穂の夜神楽" },
  { id: "iida", name: "遠山の霜月祭", by: "飯田市", url: "https://www.city.iida.lg.jp/site/bunkazai/shimotsukimatsuri.html" },
  { id: "aichinow", name: "花祭(東栄町)", by: "愛知県公式観光サイト Aichi Now", url: "https://aichinow.pref.aichi.jp/events/detail/1643/" },
  { id: "wiki-bitchu", name: "備中神楽", by: "Wikipedia", url: "https://ja.wikipedia.org/wiki/備中神楽" },
  { id: "wiki-shonai", name: "庄内神楽", by: "Wikipedia", url: "https://ja.wikipedia.org/wiki/庄内神楽" },
  { id: "hiroshima-city", name: "広島市「ひろしま市民と市政」(神楽の紹介)", by: "広島市", url: "https://www.city.hiroshima.lg.jp/asakitaku/machi/1027757/1007622.html" },
  { id: "wiki-ise", name: "伊勢大神楽", by: "Wikipedia", url: "https://ja.wikipedia.org/wiki/伊勢大神楽" },
  { id: "wiki-juyo", name: "重要無形民俗文化財", by: "Wikipedia", url: "https://ja.wikipedia.org/wiki/重要無形民俗文化財" },
  { id: "kyogikai", name: "全国神楽継承・振興協議会", by: "全国神楽継承・振興協議会", url: "https://www.miyazaki-archive.jp/kagura/" },
  { id: "tosa", name: "土佐の神楽", by: "文化庁 文化遺産オンライン", url: "https://online.bunka.go.jp/db/heritages/detail/170195/4" },
];

// 時代ごとのページ。slug は /history/<slug>.html
export const ERAS = [
  { slug: "kodai", title: "古代", span: "神話の時代〜平安時代", lead: "天岩戸の神話から、宮中で御神楽が生まれるまで。" },
  { slug: "chusei", title: "中世", span: "鎌倉〜室町・戦国時代", lead: "湯立や能の影響を受けながら、各地へ広がった時代。" },
  { slug: "kinsei", title: "近世", span: "江戸時代", lead: "出雲流・伊勢流・里神楽が、それぞれに育った時代。" },
  { slug: "kindai", title: "近代・現代", span: "明治時代〜現在", lead: "担い手が神職から氏子へ移り、文化財として守られるようになるまで。" },
];

// 年表(横にスクロールして見る)。era は、くわしく読めるページ。
export const TIMELINE = [
  { year: "神話", text: "天岩戸の前で天鈿女命が舞ったと伝わる(古事記・日本書紀)", era: "kodai", anchor: "iwato" },
  { year: "807年", text: "『古語拾遺』に「神楽」の語が初めて出てくる", era: "kodai", anchor: "kagura-word" },
  { year: "1002年", text: "宮中の内侍所御神楽が始まる(1005年とも伝わる)", era: "kodai", anchor: "mikagura" },
  { year: "1281年", text: "異国征討を祈る臨時の神楽が行われる", era: "chusei", anchor: "rinji" },
  { year: "1608年", text: "佐太神社の神職が、能楽の形式を取り入れた「神能」を始めたと伝わる", era: "kinsei", anchor: "sada" },
  { year: "江戸時代", text: "伊勢の太太神楽が各地に広がり、江戸では里神楽が発達する", era: "kinsei", anchor: "ise" },
  { year: "明治時代の初め", text: "神職が神楽を舞うことが禁じられ、多くの地域で氏子が舞い手になる", era: "kindai", anchor: "meiji" },
  { year: "1908年", text: "皇室祭祀令で、御神楽が「小祭」のひとつに定められる", era: "kindai", anchor: "mikagura-modern" },
  { year: "1976年", text: "重要無形民俗文化財の指定が始まり、各地の神楽が国の文化財として守られていく", era: "kindai", anchor: "heritage" },
  { year: "2022年", text: "全国神楽継承・振興協議会が設立される", era: "kindai", anchor: "today" },
  { year: "2025年", text: "神楽が、ユネスコ無形文化遺産への2028年の提案候補に選ばれる", era: "kindai", anchor: "today" },
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
<p>神楽は、まず宮中で行われる「御神楽(みかぐら)」と、各地の神社や民間で行われる「里神楽(さとかぐら)」に分けられます。${cite("kotobank")}里神楽は、さらに次の4つに分けるのが一般的です。${cite("kotobank")}</p>
${figure(tree("神楽", [
  { t: "御神楽(みかぐら)", d: "宮中の神楽。毎年12月に賢所で行われる" },
  { t: "里神楽(さとかぐら)", d: "各地の神社や民間で行われる神楽", children: [
    { t: "巫女神楽", d: "神官や巫女の神がかりによる鎮魂や託宣を、もとにした神楽です。" },
    { t: "出雲流", d: "島根県の佐太神社の七座神事と神能が、典型とされます。" },
    { t: "伊勢流", d: "伊勢神宮の湯立神楽に由来します。釜の湯を使う霜月神楽などに、その姿が残っています。" },
    { t: "獅子神楽", d: "獅子頭の力で悪魔払いや火伏せを行い、息災を祈ります。東北の山伏神楽や番楽などがあります。" },
  ] },
], "神楽の分類"), "神楽の大きな分け方を図にしました。分け方や呼び名は、辞典や研究者によって異なります。")}
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
      desc: "神楽の起源とされる天岩戸の神話から、「神楽」という言葉の初見、鎮魂祭、宮中の御神楽の成立(1002年)、平安時代の湯立まで、古代の神楽をたどります。",
      body: () => `
<p>神楽の歴史は、神話から始まります。ここでは、神楽の起源として語られる天岩戸の神話から、宮中で御神楽が成立する平安時代までを順に見ていきます。</p>

<h2 id="iwato">天岩戸の神話</h2>
<p>『古事記』と『日本書紀』には、天照大神が天岩戸に隠れ、世界が闇に包まれる話があります。八百万の神々が集まって手立てを相談するなか、天鈿女命(『日本書紀』の表記。『古事記』では天宇受売命)が伏せた桶を踏み鳴らし、神がかりして踊りました。${cite("wiki-iwato")}『古事記』によれば、それを見た神々が笑い、何事かと天照大神が戸を少し開けたところを、天手力男神が引き出して、世界に光が戻ります。${cite("wiki-iwato")}</p>
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
<p>宮中では貞観年間(859〜877年)に、豊楽院清暑堂で琴を伴う神の宴(琴歌神宴)が整えられました。${cite("kotobank")}そこへ賀茂の臨時祭や石清水八幡宮の臨時祭などの神楽が影響を与え、長保4年(1002年)、あるいは寛弘2年(1005年)に、内侍所の御神楽が始まったと伝えられています。${cite("kotobank", "wiki-mikagura")}</p>
<p>はじめは1年おきでしたが、のちに毎年12月の恒例行事になりました。${cite("kotobank")}御神楽は天皇の魂を鎮めるための、祈りの性格が強い儀式でした。${cite("kotobank")}平安時代の中ごろには神楽の様式が完成し、いまも約90首の神楽歌が伝わっています。${cite("wiki-kagura")}楽器は和琴・大和笛・笏拍子で、のちに篳篥が加わりました。${cite("kotobank")}</p>

${figure(flow([
  { t: "もとになった儀式", d: "琴歌神宴・賀茂臨時祭・石清水臨時祭などの神楽" },
  { t: "整理・統一される", d: "平安時代に形が整う" },
  { t: "内侍所御神楽の成立", d: "1002年(1005年とも)。のちに毎年12月の恒例に" },
], "宮中の御神楽が成立するまで", "h"), "宮中の御神楽ができあがるまでの流れです。")}
<h2 id="yudate">湯立の始まり</h2>
<p>のちに各地の神楽の中心となる「湯立」は、神前の釜で湯を沸かし、神がかりした巫女が笹や幣を湯に浸して振りかける儀式です。${cite("wiki-yudate")}古くは祓いよりも禊の意味合いが強く、神の意思を問う占いとして重んじられて「問湯」と呼ばれました。${cite("wiki-yudate")}平安時代の『貞観儀式』を見ると、宮中の行事として湯立が行われていたことが分かります。${cite("wiki-yudate")}</p>

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
      desc: "鎌倉から室町時代にかけて、神楽は宮中から各地の神社へ広がりました。臨時の神楽、湯立神楽の広がり、能との関わり、出雲流神楽の成立を紹介します。",
      body: () => `
<p>平安時代に宮中で形が整った神楽は、中世に入ると祈祷の場で使われるようになり、各地の神社や集落へも広がっていきました。担い手は神職に限らず、山伏(修験者)や巫女もいました。${cite("kotobank")}</p>

<h2 id="rinji">臨時の神楽</h2>
<p>宮中の御神楽は毎年12月の恒例行事でしたが、特別な祈りが必要なときには、臨時の神楽も行われました。弘安4年(1281年)には異国の征討を祈って、室町時代には天皇の病気平癒を願って臨時の神楽が催され、三夜にわたることもありました。${cite("kotobank")}</p>
<p>戦国時代までに途絶えてしまった祭祀の音楽もあるなかで、神楽だけは途切れることなく受け継がれたとされています。${cite("kotobank")}</p>

<h2 id="yudate-spread">湯立神楽の広がり</h2>
<p>中世の「湯起請」は、神の意思を問う占い「問湯」の流れをくむもので、「湯立」とも呼ばれました。${cite("wiki-yudate")}いっぽうで巫女舞や湯立神楽、霜月神楽は、湯立の儀式が民俗芸能として育ったものとされています。${cite("wiki-yudate")}</p>
${figure(yudateDiagram(), "湯立のしくみです。神前の釜で湯を沸かし、神がかりした巫女が笹などを湯に浸して、自分や周りの人に振りかけます。")}
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
      desc: "江戸時代、神楽は出雲流の神能、伊勢の太太神楽、江戸の里神楽など、さまざまな形で発展しました。神楽が神社の儀式から身近な芸能へ広がった時代をたどります。",
      body: () => `
<p>江戸時代は、神楽が神社の儀式から、より身近な芸能へと広がっていった時代です。各地で独自の形が整い、いまの神楽の原型の多くがこのころにできあがりました。</p>

<h2 id="sada">佐陀神能と出雲流</h2>
<p>慶長13年(1608年)、佐太神社の幣主祝・宮川兵部少輔秀行が京から能楽の形式を持ち帰ったのが、「神能」の始まりとされます。${cite("wiki-sada")}それから明治維新まで、秋鹿・島根・楯縫の各郡と意宇郡の西半分の社家が佐陀大社に集まり、この神事を奉仕しました。${cite("wiki-sada")}</p>
<p>七座神事は面をつけずに採物を持って舞う舞、式三番は能の「翁」にあたる祝言の舞、神能は面をつけて神話を演じる劇です。${cite("wiki-sada", "matsue")}能のような神話劇と素朴な採物の舞をあわせ持つ出雲流は、各地の神楽に影響を与えました。${cite("kotobank")}</p>

<h2 id="ise">伊勢の太太神楽と、里神楽</h2>
<p>「太太神楽」は、もともと伊勢神宮に奉納する神楽を、お礼(報賽)の大小で分けた等級の名前でした。のちに奉納神楽そのものの美称となり、伊勢から各地へ広まっていきます。${cite("kotobank")}広まった先では、出雲流の内容が多く取り入れられました。${cite("kotobank")}</p>
<p>民間で行われる神楽を指す言葉が使われ始めたのも、この時代です。辞典は、諸社や民間の神楽という意味での用例として、寛永15年(1638年)の『毛吹草』を挙げています。${cite("kotobank")}江戸では里神楽が発達し、神話をせりふのない劇(黙劇)に仕立てた舞が演じられました。${cite("kotobank")}</p>
<p>江戸時代の終わりごろになると、寄席では神楽よりも、演芸色の強い太神楽の曲芸がよく演じられるようになりました。${cite("wiki-kagura")}</p>

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
      desc: "明治時代、神楽の担い手は神職から氏子へ移りました。宮中の御神楽のその後、文化財としての保護、ユネスコ無形文化遺産への動きまで、近代から現代の神楽をたどります。",
      body: () => `
<p>明治時代、神楽は大きな転換点を迎えます。それまで神職が担っていた舞が氏子(地域の人たち)の手に渡り、いまの「神楽団」や「社中」のかたちが生まれました。</p>

<h2 id="meiji">明治の改革と、氏子への継承</h2>
${figure(flow([
  { t: "江戸時代まで", d: "神職・山伏・巫女が神楽を担う" },
  { t: "明治時代の初め", d: "神楽の様式の改正と、神職の演舞の禁止" },
  { t: "氏子が舞い手に", d: "地域の人たちが舞う(神俗交代)" },
  { t: "神楽団・社中の誕生", d: "地域ごとに、舞い手の団体が生まれる" },
], "神楽の担い手の変化", "h"), "神楽の担い手の移り変わりです。明治時代の初めに、神職から氏子へと移りました。")}
<p>明治の初め、国学者による神楽の様式の改正や、神職が神楽を舞うことを禁じる命令などをきっかけに、多くの地域で氏子が舞い手を務めるようになりました(神俗交代)。${cite("wiki-iwami", "matsue")}明治維新のあとは、神職だけでなく民間の人たちも神楽を演じるようになります。${cite("kotobank")}</p>
<p>一方、伊勢神宮の湯立神楽は、明治維新のころに伊勢では絶えてしまいました。${cite("kotobank")}明治7年(1874年)には、江戸で発達した神楽が「郷(里)神楽」と呼ばれるようになります。${cite("kotobank")}</p>

<h2 id="mikagura-modern">宮中の御神楽のその後</h2>
<p>宮中の御神楽は、明治以降、宮内庁楽部の楽人だけで奉仕するようになりました。${cite("kotobank")}明治41年(1908年)の皇室祭祀令で「小祭」のひとつと定められ、昭和22年(1947年)、敗戦にともなって祭祀令は廃止されました。${cite("wiki-mikagura")}いまも毎年12月中旬に、簡略化した御神楽が賢所で行われています。${cite("wiki-mikagura")}</p>

<h2 id="heritage">文化財としての保護</h2>
<p>昭和50年(1975年)の文化財保護法の改正で「重要無形民俗文化財」の指定制度ができ、翌昭和51年(1976年)5月4日に第1回として30件が指定されました。${cite("wiki-juyo")}</p>
<p>その後も各地の神楽が相次いで指定され、国指定の神楽は、2025年の時点で40件とされています。${cite("kotobank")}</p>

<h2 id="today">現代の神楽</h2>
<p>全国に4,000を超えるといわれる神楽ですが、少子高齢化や過疎化によって、存続も継承も難しくなっています。${cite("kyogikai")}2022年10月11日には、神楽を守り盛り上げるために、全国神楽継承・振興協議会の設立総会が開かれました。${cite("wiki-kagura")}そして2025年11月28日、文化庁は神楽を、ユネスコ無形文化遺産への2028年の提案候補に選んでいます。${cite("wiki-kagura")}</p>
<p>神楽は、いまも各地で舞い継がれています。<a href="/calendar.html">日付・場所で探す</a>や<a href="/kagura/">種類で探す</a>から、近くで観られる神楽を探してみてください。</p>

<div class="hnav"><a class="prev" href="/history/kinsei.html"><small>前へ</small>‹ 近世の神楽</a><a class="next" href="/history/"><small>最初へ</small>年表にもどる ›</a></div>
${sourcesHtml()}`,
      used,
    };
  }

  return pages;
}
