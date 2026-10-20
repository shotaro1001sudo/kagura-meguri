// 「神楽の歴史」(/history/)の本文と年表。
// 年代・出来事は、下の SOURCES の辞典・公的な情報に書かれていることだけを書く。
// 出典は、文末の小さな番号([1] など)で示し、各ページの最後にまとめる。番号は、そのページの本文に初めて出てくる順。
// 出典の文章は、そのまま写さず、要約して書く。内容を変えたら CHECKED(確認日)を更新する。

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
  { id: "hiroshima", name: "広島市「ひろしま市民と市政」(神楽の紹介)", by: "広島市", url: "https://www.city.hiroshima.lg.jp/asakitaku/machi/1027757/1007622.html" },
  { id: "wiki-ise", name: "伊勢大神楽", by: "Wikipedia", url: "https://ja.wikipedia.org/wiki/伊勢大神楽" },
  { id: "wiki-juyo", name: "重要無形民俗文化財", by: "Wikipedia", url: "https://ja.wikipedia.org/wiki/重要無形民俗文化財" },
  { id: "kyogikai", name: "全国神楽継承・振興協議会", by: "全国神楽継承・振興協議会", url: "https://www.miyazaki-archive.jp/kagura/" },
  { id: "tosa", name: "土佐の神楽", by: "文化庁 文化遺産オンライン", url: "https://online.bunka.go.jp/db/heritages/detail/170195/4" },
];

// 時代ごとのページ。slug は /history/<slug>.html
export const ERAS = [
  { slug: "kodai", title: "古代", span: "神話の時代〜平安時代", lead: "天岩戸の神話から、宮中の御神楽の成立まで。" },
  { slug: "chusei", title: "中世", span: "鎌倉〜室町・戦国時代", lead: "湯立と能の影響を受けて、各地へ広がった時代。" },
  { slug: "kinsei", title: "近世", span: "江戸時代", lead: "出雲流・伊勢流・里神楽がそれぞれに育った時代。" },
  { slug: "kindai", title: "近代・現代", span: "明治時代〜現在", lead: "担い手が神職から氏子へ移り、文化財として守られるまで。" },
];

// 年表(横にスクロールして見る)。era は、くわしく読めるページ。
export const TIMELINE = [
  { year: "神話", text: "天岩戸の前で、天鈿女命が舞ったと伝わる(古事記・日本書紀)", era: "kodai", anchor: "iwato" },
  { year: "807年", text: "『古語拾遺』に「神楽」の語が初めて出てくる", era: "kodai", anchor: "kagura-word" },
  { year: "1002年", text: "宮中の内侍所御神楽が始まる(1005年とも伝わる)", era: "kodai", anchor: "mikagura" },
  { year: "1189年", text: "高千穂に伝わる文書に、「七日七夜のごじんらく」の記述", era: "chusei", anchor: "takachiho" },
  { year: "1281年", text: "異国征討を祈る臨時の神楽が行われる", era: "chusei", anchor: "rinji" },
  { year: "1512年", text: "佐太神社で「御座之祭」が行われた記録", era: "chusei", anchor: "izumo" },
  { year: "1608年", text: "佐太神社の神職が、能楽の形式を取り入れた神能を始めたと伝わる", era: "kinsei", anchor: "sada" },
  { year: "江戸時代", text: "伊勢の太太神楽が各地に広がり、江戸では里神楽が発達する", era: "kinsei", anchor: "ise" },
  { year: "1800年代前半", text: "備中で、西林国橋が神代神楽を加えて、備中神楽の形を整える", era: "kinsei", anchor: "bitchu" },
  { year: "明治時代の初め", text: "神職が神楽を舞うことが禁じられ、氏子が舞い手になる", era: "kindai", anchor: "meiji" },
  { year: "1908年", text: "皇室祭祀令で、御神楽が「小祭」の一つに定められる", era: "kindai", anchor: "mikagura-modern" },
  { year: "1919年", text: "佐太神社古伝神事保存協会が結成される(大正8年)", era: "kindai", anchor: "sada-modern" },
  { year: "1976年", text: "重要無形民俗文化財の指定が始まり、佐陀神能が指定される", era: "kindai", anchor: "heritage" },
  { year: "1978〜81年", text: "高千穂の夜神楽、備中神楽、土佐の神楽、伊勢大神楽などが、国の重要無形民俗文化財に指定される", era: "kindai", anchor: "heritage" },
  { year: "2011年", text: "佐陀神能が、ユネスコの無形文化遺産に登録される", era: "kindai", anchor: "unesco" },
  { year: "2022年", text: "全国神楽継承・振興協議会が設立される", era: "kindai", anchor: "today" },
  { year: "2025年", text: "神楽が、ユネスコ無形文化遺産の2028年の提案候補に選ばれる", era: "kindai", anchor: "today" },
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
<p class="meta">確認日: ${CHECKED.replace(/^(\d{4})-0?(\d+)-0?(\d+)$/, "$1年$2月$3日")}。上の辞典・公的な情報をもとに、要約しています。神楽の起源や年代には、諸説があります。</p>`;
  };
  return { cite, sourcesHtml, used: () => [...order] };
}

/** 年表(横にスクロール)。キーボードでも動かせるよう、tabindex を付ける */
export function timelineHtml({ esc }) {
  const items = TIMELINE.map((t) => {
    const era = ERAS.find((e) => e.slug === t.era);
    return `<li class="tl-item"><span class="tl-year">${esc(t.year)}</span><p>${esc(t.text)}</p><a href="/history/${t.era}.html#${t.anchor}">${esc(era.title)}で、くわしく<span aria-hidden="true"> ›</span></a></li>`;
  }).join("");
  return `<div class="tl" role="region" aria-label="神楽の年表(横にスクロールできます)" tabindex="0"><ol class="tl-list">${items}</ol></div>
<p class="meta tl-hint"><span aria-hidden="true">← </span>横にスクロールして、神話の時代から現代まで、たどれます<span aria-hidden="true"> →</span></p>`;
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
      title: "神楽の歴史 神話から現代までの年表と、4つの時代",
      h1: "神楽の歴史",
      sub: "神話の時代から現代まで、年表と4つの時代で読む",
      desc: "神楽は、いつ、どのように生まれ、広まったのか。天岩戸の神話、宮中の御神楽、湯立と能の影響、江戸時代の広がり、明治の改革、文化財としての保護まで、辞典と公的な情報をもとに、横にスクロールできる年表とあわせて解説します。",
      body: () => `
<p>神楽(かぐら)は、神様を迎え、災いを祓い、神様とともに楽しむために、神前で奉納される歌と舞です。${cite("kyogikai")}古くは「神遊び」とも呼ばれました。${cite("kotobank")}「かぐら」という言葉は、「神座(かみくら)」が変化したものとする説が、定説とされています。${cite("kotobank")}</p>
<p>全国には、4,000を超える神楽があるといわれます。${cite("kyogikai")}同じ「神楽」でも、宮中で伝わる御神楽、神社の湯立、獅子舞、能のような物語の舞と、姿は大きく違います。このページでは、その違いが、どのような歴史から生まれたのかを、時代を追ってたどります。</p>

<h2 id="timeline">神楽の年表</h2>
${timelineHtml({ esc })}

<h2 id="eras">4つの時代</h2>
<div class="era-grid">${ERAS.map((e, i) => `<a class="era" href="/history/${e.slug}.html"><span class="no">${String(i + 1).padStart(2, "0")}</span><b>${esc(e.title)}</b><small>${esc(e.span)}</small><span>${esc(e.lead)}</span></a>`).join("")}</div>

<h2 id="types">神楽の大きな分け方</h2>
<p>神楽は、まず、宮中で行われる「御神楽(みかぐら)」と、各地の神社や民間で行われる「里神楽(さとかぐら)」に分けられます。${cite("kotobank")}里神楽は、さらに、次の4つに分けるのが一般的です。${cite("kotobank")}</p>
<table class="info"><tr><th>巫女神楽</th><td>神官や巫女の神がかりによる、鎮魂や託宣を、もとにした神楽です。</td></tr>
<tr><th>出雲流</th><td>島根県の佐太神社の七座神事と神能が、典型とされます。${kaguraLink("高千穂神楽")}も、この系統に挙げられることがあります。</td></tr>
<tr><th>伊勢流</th><td>伊勢神宮の湯立神楽に由来します。釜の湯を使う霜月神楽・${kaguraLink("花祭")}・${kaguraLink("遠山の霜月祭")}などに、その姿が残ります。</td></tr>
<tr><th>獅子神楽</th><td>獅子頭の力で、悪魔払いや火伏せ、息災を祈ります。東北の山伏神楽や番楽、${kaguraLink("伊勢大神楽")}などがあります。</td></tr></table>
<p class="meta">分け方や呼び名は、辞典や研究者によって異なります。「里神楽」は、東京を中心とする関東の出雲流の神楽を指す言葉としても使われます。${cite("kotobank")}</p>

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
      desc: "神楽の起源は、天岩戸の前で天鈿女命が舞った神話にあるとされます。「神楽」の語の初見、鎮魂祭、宮中の御神楽の成立(1002年)、平安時代の湯立まで、古代の神楽を、辞典と公的な情報をもとに解説します。",
      body: () => `
<p>神楽の歴史は、神話から始まります。ここでは、神楽の起源として語られる天岩戸の神話から、宮中の御神楽が成立する平安時代までを、順に見ていきます。</p>

<h2 id="iwato">天岩戸の神話</h2>
<p>『古事記』『日本書紀』には、天照大神が天岩戸に隠れて、世界が闇に包まれる話があります。八百万の神々が集まって対策を話し合ううちに、天鈿女命(『日本書紀』では天鈿女命、『古事記』では天宇受売命)が、桶を伏せて踏み鳴らし、神がかりして踊ります。${cite("wiki-iwato")}『古事記』では、これを見た神々が笑い、不思議に思った天照大神が戸を少し開けたところを、天手力男神が引き出して、世界に光が戻ります。${cite("wiki-iwato")}</p>
<p>この天鈿女命の神がかりの舞が、神楽の起源を語る説話とされています。${cite("kotobank")}各地の神楽に「岩戸」の演目があるのは、この神話が、神楽の原点として受け継がれているためです。</p>

<h2 id="chinkon">鎮魂祭と猿女氏</h2>
<p>宮中では、新嘗祭の前日に、「鎮魂祭」が行われていました。${cite("kotobank")}鎮魂祭には、御巫女と猿女による神楽の舞があり、『古語拾遺』は、これを天岩戸の天鈿女命に由来するとしています。${cite("kotobank")}神楽の本質は、魂を招き、鎮める作法にあるとされ、猿女氏のほか、物部氏、安曇氏など、複数の系統の鎮魂の作法が関わったと考えられています。${cite("kotobank")}</p>

<h2 id="kagura-word">「神楽」という言葉の初めて</h2>
<p>「神楽」という言葉が、文献に初めて出てくるのは、大同2年(807年)の『古語拾遺』とされます。${cite("kotobank")}9世紀の終わりから10世紀の初めには、石清水八幡宮や賀茂の臨時祭の神楽で、「神楽」の字が使われるようになりました。${cite("kotobank")}</p>

<h2 id="mikagura">宮中の御神楽の成立</h2>
<p>宮中では、貞観年間(859〜877年)に、豊楽院清暑堂で、琴を伴う神の宴(琴歌神宴)が整えられました。${cite("kotobank")}これに、賀茂の臨時祭や石清水八幡宮の臨時祭などの神楽が影響して、長保4年(1002年)、または寛弘2年(1005年)に、内侍所の御神楽が始まったと伝えられます。${cite("kotobank", "wiki-mikagura")}</p>
<p>はじめは隔年に行われ、のちに、毎年12月の恒例の行事になりました。${cite("kotobank")}御神楽は、天皇の魂を鎮めることを目的としたもので、祈りの性格の強い儀式でした。${cite("kotobank")}平安時代の中ごろには、神楽の様式が完成し、約90首の神楽歌が伝わっています。${cite("wiki-kagura")}楽器は、和琴・大和笛・笏拍子で、のちに篳篥が加わりました。${cite("kotobank")}</p>

<h2 id="yudate">湯立の始まり</h2>
<p>のちに各地の神楽の中心になる「湯立」は、神前の釜で湯を沸かし、神がかりした巫女が、笹や幣を湯に浸して振りかける儀式です。${cite("wiki-yudate")}古くは、祓いよりも、禊の意味が強く、神の意思を問う占いとして重んじられ、「問湯」と呼ばれました。${cite("wiki-yudate")}平安時代の『貞観儀式』から、宮中の行事として、湯立が行われていたことが分かります。${cite("wiki-yudate")}</p>

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
      desc: "鎌倉から室町時代にかけて、神楽は、宮中から各地の神社へと広がりました。臨時の神楽、湯立神楽と霜月祭の起源、能との関わり、出雲流神楽の成立、高千穂の古い記録を、辞典と公的な情報をもとに解説します。",
      body: () => `
<p>平安時代に、宮中で形が整った神楽は、中世になると、祈祷の場に使われる一方で、各地の神社や集落へと広がっていきます。担い手は、神職だけでなく、山伏(修験者)や巫女でもありました。${cite("kotobank")}</p>

<h2 id="rinji">臨時の神楽</h2>
<p>宮中の御神楽は、毎年12月の恒例の行事でしたが、特別な祈りのときには、臨時の神楽も行われました。弘安4年(1281年)には、異国の征討を祈る臨時の神楽がありました。室町時代には、天皇の病気が治るよう祈る臨時の神楽が行われ、三夜にわたることもありました。${cite("kotobank")}</p>
<p>戦国時代の前までに途絶えた祭祀の音楽もありますが、神楽だけは、連綿と受け継がれたとされています。${cite("kotobank")}</p>

<h2 id="yudate-spread">湯立神楽と霜月祭</h2>
<p>中世の「湯起請」は、神の意思を問う占い「問湯」の流れを汲むもので、「湯立」とも呼ばれました。${cite("wiki-yudate")}一方、巫女舞・湯立神楽・霜月神楽は、湯立の儀式が、民俗芸能として育ったものとされています。${cite("wiki-yudate")}</p>
<p>湯立神楽の一つ、長野県の「遠山の霜月祭」の起源には、鎌倉時代に、遠山谷が鶴岡八幡宮の社領だったころに導入された、荘園の儀礼とする説が有力です。${cite("iida")}愛知県の奥三河の「花祭」も、700年以上続く伝統芸能とされます。${cite("aichinow")}いずれも、冬の夜に、釜の湯を囲んで行われる神楽です。</p>
<p>湯立神楽を広めたのは、伊勢神宮の外宮の御師だとされます。${cite("kotobank")}伊勢流の湯立神楽は、のちに伊勢では途絶え、各地の霜月神楽などに、その姿が残りました。${cite("kotobank")}</p>

<h2 id="noh">能との関わり</h2>
<p>中世は、能が大成した時代でもあります。神楽は、能の舞事の一つとしても使われ、応永30年(1423年)の『三道』に、能の神楽の記述があります。${cite("kotobank")}一方で、神楽の側も、能や田楽、猿楽の要素を取り入れました。里神楽は、本来、神官や巫女の神がかりによる鎮魂と託宣でしたが、のちに田楽や猿楽を取り入れて、出雲流などの形が生まれたとされます。${cite("kotobank")}</p>

<h2 id="izumo">出雲流神楽のはじまり</h2>
<p>島根県の佐太神社の「七座神事」と「神能」は、出雲流神楽の最も古い典型とされ、成立は、中世の終わりから近世の初めと考えられています。${cite("kotobank")}佐太神社では、永正9年(1512年)に、島根郡と秋鹿郡の神職が「御座之祭」を行ったという記録が残ります。${cite("matsue")}</p>

<h2 id="takachiho">高千穂の古い記録</h2>
<p>宮崎県の高千穂では、1189年の古文書に「七日七夜のごじんらく」という記述があり、神楽にあたる言葉の初出とされます。${cite("wiki-takachiho")}1460年の文書には「神楽」の語が見られます。${cite("wiki-takachiho")}研究者は、高千穂の神楽の成立を、平安時代の終わりから源平の時代(12世紀後半)と推定しています。${cite("wiki-takachiho")}</p>

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
      desc: "江戸時代、神楽は、出雲流の神能、伊勢の太太神楽、江戸の里神楽、備中神楽の誕生など、さまざまに発展しました。各地の神楽の成り立ちと、記録に残る年代を、辞典と公的な情報をもとに解説します。",
      body: () => `
<p>江戸時代は、神楽が、神社の儀式から、より身近な芸能へと広がった時代です。各地で独自の形が整い、現在の神楽の多くの原型ができました。</p>

<h2 id="sada">佐陀神能と出雲流</h2>
<p>慶長13年(1608年)、佐太神社の幣主祝・宮川兵部少輔秀行が、能楽の形式を京から持ち帰ったことから、「神能」が始まったとされます。${cite("wiki-sada")}以後、明治維新まで、秋鹿・島根・楯縫の各郡と、意宇郡の西半分の社家が、佐陀大社に集まって、この神事を奉仕しました。${cite("wiki-sada")}</p>
<p>七座神事は、面をつけずに採物を持って舞う舞、式三番は、能の「翁」にあたる祝言の舞、神能は、面をつけて神話を演じる劇です。${cite("wiki-sada", "matsue")}能のような神話劇と、素朴な採物の舞を合わせもつ出雲流は、各地の神楽に影響を与えました。${cite("kotobank")}</p>

<h2 id="ise">伊勢の太太神楽と、里神楽</h2>
<p>「太太神楽」は、もとは、伊勢神宮に奉納する神楽の、お礼(報賽)の大小による、等級の名前でした。のちに、奉納神楽の美称になり、伊勢の奉納神楽に始まって、各地へ広まりました。${cite("kotobank")}広まった先では、出雲流の内容が、多く取り入れられました。${cite("kotobank")}</p>
<p>この時代に、民間で行われる神楽を指す言葉も、使われるようになります。辞典は、諸社や民間の神楽の意味での用例として、寛永15年(1638年)の『毛吹草』を挙げています。${cite("kotobank")}江戸では、里神楽が発達し、神話を、せりふのない劇(黙劇)にした舞が演じられました。${cite("kotobank")}</p>
<p>江戸時代の終わりごろには、寄席で、神楽よりも、演芸色の強い、太神楽の曲芸が、多く演じられるようになりました。${cite("wiki-kagura")}</p>

<h2 id="bitchu">備中神楽の誕生</h2>
<p>岡山県の備中地方では、古くから、荒神に奉納する「荒神神楽」が行われていました。猿田彦の舞や剣舞が中心で、神職だけが担っていました。${cite("wiki-bitchu")}文化・文政年間(1800年代の前半)に、高梁市出身の神官で国学者の西林国橋が、神話を題材にした神代神楽を加えて、現在の形を完成させたとされます。${cite("wiki-bitchu")}能・狂言・歌舞伎の要素を取り入れて、演劇性が高まったため、神職以外の神楽太夫も、奉納するようになりました。${cite("wiki-bitchu")}</p>

<h2 id="local">各地に残る、江戸時代の記録</h2>
<p>宮崎県の高千穂では、1754年の古文書に、「夜神楽」の語が見られます。${cite("wiki-takachiho")}大分県由布市の庄内神楽には、1778年(安永7年)に、社家衆が神楽を奉納した記録が残ります。${cite("wiki-shonai")}長野県の遠山の霜月祭では、江戸時代に、面が行列で歩く「面の行道」が加わったと考えられています。${cite("iida")}</p>
<p>この時代に整った神楽の多くは、神職、山伏、巫女などによって、受け継がれました。${cite("kotobank")}それが大きく変わるのが、次の明治時代です。</p>

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
      desc: "明治時代に、神楽の担い手は、神職から氏子へと移りました。石見神楽の八調子、広島の新舞、文化財保護法による指定、ユネスコ無形文化遺産への動きまで、近代から現代の神楽の歴史を、辞典と公的な情報をもとに解説します。",
      body: () => `
<p>明治時代に、神楽は、大きな転換点を迎えました。それまで神職が担っていた舞が、氏子(地域の人びと)の手に移り、現在の「神楽団」「社中」のかたちが生まれます。</p>

<h2 id="meiji">明治の改革と、氏子への継承</h2>
<p>明治時代の初めに、国学者による神楽の様式の改正と、神職が神楽を舞うことを禁じる命令などをきっかけに、氏子が舞い手を務めるようになりました(神俗交代)。${cite("wiki-iwami")}佐太神社でも、神社制度の改革で、神職の演舞が禁止され、旧神職によって、神能が受け継がれました。${cite("matsue")}明治維新以後は、神職のほかに、民間の人びとも、神楽を演じるようになります。${cite("kotobank")}</p>
<p>この動きのなかで、島根県西部の石見神楽は、それまでの六調子から、速くて躍動的な「八調子」に変わっていきました。${cite("wiki-iwami")}浜田市の資料は、明治以降の浜田で、「改正神楽(八調子神楽)」や「校定石見神楽台本」などの石見神楽の文化が花開き、面・蛇胴・衣装のものづくりも生まれた、と述べています。${cite("hamada")}</p>
<p>この時期、伊勢神宮の湯立神楽は、明治維新のころに、伊勢では絶えました。${cite("kotobank")}明治7年(1874年)には、江戸で発達した神楽を、「郷(里)神楽」と呼ぶようになります。${cite("kotobank")}</p>

<h2 id="mikagura-modern">宮中の御神楽は</h2>
<p>宮中の御神楽は、明治以後、宮内庁楽部の楽人だけで奉仕するようになりました。${cite("kotobank")}明治41年(1908年)の皇室祭祀令で、「小祭」の一つと定められ、昭和22年(1947年)の敗戦後に、祭祀令が廃止されました。${cite("wiki-mikagura")}現在も、毎年12月中旬に、簡略化した御神楽が、賢所で行われています。${cite("wiki-mikagura")}</p>

<h2 id="sada-modern">守り手の組織づくり</h2>
<p>佐陀神能では、大正8年(1919年)に、佐太神社古伝神事保存協会が結成されました。その神能部が、のちに佐太神能保存会になり、現在に至ります。${cite("matsue")}</p>

<h2 id="postwar">戦後の新舞</h2>
<p>広島県の芸北神楽には、戦前から伝わる「旧舞」と、戦後に創作された「新舞」があります。新舞は、戦後、連合国軍総司令部(GHQ)により神楽が規制されるなかで、神道色を薄め、娯楽性を高めて創られたものとされています。${cite("hiroshima")}</p>

<h2 id="heritage">文化財としての保護</h2>
<p>昭和50年(1975年)の文化財保護法の改正で、「重要無形民俗文化財」の指定制度が始まり、翌年の昭和51年(1976年)5月4日に、第1回として30件が指定されました。${cite("wiki-juyo")}佐陀神能は、この年に、国の重要無形民俗文化財に指定されています。${cite("wiki-sada")}</p>
<p>その後、1978年に高千穂の夜神楽${cite("wiki-takachiho")}、1979年に備中神楽${cite("wiki-bitchu")}と、石見神楽のルーツとされる大元神楽${cite("wiki-iwami")}、遠山の霜月祭${cite("iida")}、1980年に土佐の神楽${cite("tosa")}、1981年に伊勢大神楽${cite("wiki-ise")}が、次々と指定されていきます。国指定の神楽は、2025年時点で40件とされます。${cite("kotobank")}</p>

<h2 id="unesco">ユネスコと、世界へ</h2>
<p>佐陀神能は、平成23年(2011年)11月27日に、ユネスコの無形文化遺産に登録されました。${cite("wiki-sada")}2019年には、石見神楽と15の構成文化財が、日本遺産に認定されています。${cite("wiki-iwami")}</p>

<h2 id="today">現代の神楽</h2>
<p>全国には、4,000を超える神楽があるといわれますが、少子高齢化や過疎化で、存続や継承が、とても難しくなっています。${cite("kyogikai")}2022年10月11日には、神楽の保存と振興のため、全国神楽継承・振興協議会の設立総会が開かれました。${cite("wiki-kagura")}2025年11月28日には、文化庁が、神楽を、ユネスコ無形文化遺産の2028年の提案候補に選びました。${cite("wiki-kagura")}</p>
<p>神楽は、いまも、各地で舞い継がれています。<a href="/calendar.html">日付・場所で探す</a>、<a href="/kagura/">種類で探す</a>から、お近くの神楽を、探してみてください。</p>

<div class="hnav"><a class="prev" href="/history/kinsei.html"><small>前へ</small>‹ 近世の神楽</a><a class="next" href="/history/"><small>最初へ</small>年表にもどる ›</a></div>
${sourcesHtml()}`,
      used,
    };
  }

  return pages;
}
