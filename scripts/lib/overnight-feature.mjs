// 特集: 夜通しの神楽の見方・泊まり方(ADV-20261110-5)
// 遠山の霜月祭(長野県飯田市)と東栄町の花祭(愛知県)は、別の土地の、別の種類の祭り。1つのページにまとめず、祭りごとに1ページにする。
// - 日程は、その祭りの「これからの開催」を events.json から並べる(月をまたぐときは月ごとの見出し)。
// - 見方・泊まり方は、その祭りの公式の案内に書いてあることだけを、出典のリンクつきで書く。ほかの祭りの案内を流用しない。
//   時刻や宿の名前は、ここに書かない(日程は開催データ、宿は公式の一覧へのリンクで見せる)。
// - 宿の広告(じゃらん・楽天トラベル)は「PR」と付けて置く。協賛枠は、承認された協賛({ "page": "feature", "id": 特集の ID })があるときだけ出る。

// 文章を確かめた日(公式の案内を読み直したら、ここを更新する)
export const FEATURE_CHECKED = "2026-11-11";

const SHIMO_SRC = {
  top: { name: "遠山の霜月祭 公式サイト", url: "https://shimotsukimatsuri.com/" },
  manners: { name: "遠山の霜月祭 公式サイト(見学のマナー)", url: "https://shimotsukimatsuri.com/manners/" },
  iida: { name: "飯田市(令和8年度 遠山の霜月祭の日程)", url: "https://www.city.iida.lg.jp/site/bunkazai/20261101.html" },
  stay: { name: "遠山郷観光協会(食べる＆泊まる)", url: "https://tohyamago.com/archives/category/stay_eat" },
};
const HANA_SRC = {
  toei: { name: "東栄町観光まちづくり協会(花祭)", url: "https://www.toeinavi.jp/spots/hanamatsuri/" },
  town: { name: "東栄町(花祭の地区)", url: "http://www.town.toei.aichi.jp/1584.htm" },
};

// 宿の検索に使う地名: 市町村名だと遠い宿が多く出るため、宿の検索で近くの宿が出ることを確かめた呼び名にする(2026-11-11 確認)
export const FEATURES = [
  {
    id: "tohyama-shimotsuki", kagura: "遠山の霜月祭", path: "/feature/tohyama-shimotsuki.html",
    title: "遠山の霜月祭 夜通しの神楽の見方・泊まり方", h1: "遠山の霜月祭の見方・泊まり方", sub: "夜を徹して舞う、遠山郷の湯立神楽",
    desc: "長野県飯田市の遠山郷で12月に行われる「遠山の霜月祭」の日程と、見学のマナー・時間の目安・休憩所・宿など、夜通しの祭りの見方と泊まり方を、公式の案内をもとにまとめました。",
    linkText: "特集: 遠山の霜月祭の見方・泊まり方",
    sources: SHIMO_SRC,
    stay: { key: "tohyama", area: "遠山郷", label: "遠山郷(飯田市)の宿", list: SHIMO_SRC.stay },
    body: ({ src, kagura }) => ({
      intro: `<p class="lead">遠山の霜月祭は、長野県飯田市の遠山郷(上村・南信濃)で、毎年12月に神社ごとに日をずらして行われる湯立神楽です。釜の湯を沸かして神々を迎え、面をつけた神々が舞います。夜を徹して行われ、国の重要無形民俗文化財に指定されています。</p>
<p>祭りは深夜や翌朝まで続きます。寒さへの備えと、泊まる場所を先に決めておくと安心です。このページでは、これからの日程と、公式の案内にもとづく見方・泊まり方をまとめます。くわしい解説は${kagura}のページをご覧ください。</p>`,
      scheduleNote: `<p>遠山郷の神社ごとに、日をずらして行われます。時刻は目安で、変わることがあります(${src("iida")})。</p>`,
      watch: `<ul>
<li>一般の方も見学できます。大勢ではなく少人数で訪れ、お賽銭を納めるよう案内されています(${src("manners")})。</li>
<li>掲載の時刻には、面が出る前の神事の時間も含まれます。見物の方が多く訪れるのは面が出るころからで、公式の案内では17時以降(朝まで続く神社は19時以降)が目安とされています。</li>
<li>フラッシュを使った撮影はしません。地元の方や、ほかの見物の方の妨げにならないようにしましょう。</li>
<li>見物の人数を制限する場合があります。地元の方の指示に従いましょう(${src("iida")})。</li>
<li>祭りは深夜まで続きます。公式サイトは、防寒の準備をと呼びかけています(${src("top")})。</li>
</ul>`,
      stay: `<h3>休む場所</h3>
<ul>
<li>一部の神社に、有料の休憩所が用意されます。どの神社かは、決まりしだい${src("top")}で案内されます。</li>
<li>夜通し観るつもりなら、近くの宿を早めに取っておきましょう。</li>
</ul>
<h3>宿</h3>
<ul><li>遠山郷の宿は、${src("stay")}にまとまっています。</li></ul>
<h3>行き帰り</h3>
<ul><li>遠山郷は山あいの集落です。祭りの終わりが深夜や翌朝になるため、帰りの運転を避けられるよう、泊まる計画にすると安心です。</li></ul>`,
      stayLead: "祭りは深夜や翌朝まで続きます。観に行く日に合わせて、早めに探しておくと安心です。",
      sourcesNote: "",
    }),
  },
  {
    id: "hanamatsuri", kagura: "花祭", path: "/feature/hanamatsuri.html",
    title: "東栄町の花祭 夜通しの神楽の見方・泊まり方", h1: "東栄町の花祭の見方・泊まり方", sub: "夜を通して舞う、奥三河の鬼と湯立ての祭り",
    desc: "愛知県東栄町で11月から1月にかけて行われる「花祭」の日程と、お見舞い(奉納金)・マナー・冬の道・宿など、夜通しの祭りの見方と泊まり方を、公式の案内をもとにまとめました。",
    linkText: "特集: 東栄町の花祭の見方・泊まり方",
    sources: HANA_SRC,
    stay: { key: "okumikawa", area: "奥三河", label: "東栄町・奥三河の宿", list: HANA_SRC.toei },
    body: ({ src, kagura }) => ({
      intro: `<p class="lead">花祭は、愛知県の奥三河で700年以上続くとされる祭りです。東栄町では11月から1月にかけて、集落ごとに夜を徹して行われ、神や鬼の舞と、釜の湯を使う湯立てが繰り広げられます。国の重要無形民俗文化財に指定されています。</p>
<p>祭りは夜通し、翌日まで続く地区もあります。寒さへの備えと、泊まる場所・帰りの足を先に決めておくと安心です。このページでは、これからの日程と、公式の案内にもとづく見方・泊まり方をまとめます。くわしい解説は${kagura}のページをご覧ください。</p>`,
      scheduleNote: `<p>東栄町の集落(地区)ごとに行われます。日程・時刻は${src("toei")}・${src("town")}で確かめてから出かけましょう。</p>`,
      watch: `<ul>
<li>見学は無料です(Aichi Now)。会場の会所に「お見舞い」(奉納金)を持っていくと、地区ごとのお返しがもらえます。目安は1人3,000円ほどと案内されています(${src("toei")})。</li>
<li>舞庭は神聖な場所です。面をつけた舞い手は、ストロボの光を嫌います。</li>
<li>夜通しの祭りです。寒さ・眠さ・焚き火の煙への備えをと案内されています。</li>
</ul>`,
      stay: `<h3>宿</h3>
<ul><li>${src("toei")}のページに、花祭の日に泊まれる宿の一覧があります。門限のない宿や、送迎のある宿も載っています。</li></ul>
<h3>行き帰り</h3>
<ul>
<li>会場へは道が細く、冬は道が凍ります。車はスタッドレスタイヤで。運転する人はお酒を飲まないようにしましょう。</li>
<li>公共交通での行き来は難しく、タクシーの利用が勧められています(${src("toei")})。駐車場のない会場もあります(Aichi Now)。</li>
</ul>`,
      stayLead: "祭りは夜通し続きます。観に行く地区の日に合わせて、早めに探しておくと安心です。",
      sourcesNote: "・Aichi Now(愛知県公式観光サイト)",
    }),
  },
];

/** その特集に載せる開催: その祭りの、これからの開催(日付順) */
export const featureEvents = (f, upcoming) =>
  upcoming.filter((e) => e.kagura === f.kagura).sort((a, b) => a.start.localeCompare(b.start) || a.id.localeCompare(b.id));

const ym = (e) => e.start.slice(0, 7);
const monthName = (k) => `${+k.slice(0, 4)}年${+k.slice(5, 7)}月`;
const jpDay = (d) => d.replace(/^(\d{4})-0?(\d+)-0?(\d+)$/, "$1年$2月$3日");

/**
 * 特集ページの本文(パンくず・見出しの下)
 * @param {object} f FEATURES の1件
 * @param {object} o
 * @param {object[]} o.list featureEvents の結果
 * @param {(e:object,h?:string)=>string} o.card 開催のカード
 * @param {(k:string)=>string} o.kaguraLink 種類のページへのリンク(ページがなければ文字だけ)
 * @param {string} o.stayHtml 宿の広告(ボタン。広告がなければ空)
 * @param {string} o.prNote 広告の表示(PR)。宿の広告がなければ空
 * @param {string} o.sponsor 協賛枠(なければ空)
 */
export function overnightFeatureHtml(f, { esc, list, card, kaguraLink, stayHtml = "", prNote = "", sponsor = "" }) {
  const S = f.sources;
  const src = (k) => `<a href="${esc(S[k].url)}" rel="noopener" target="_blank">${esc(S[k].name)}</a>`;
  const listSrc = `<a href="${esc(f.stay.list.url)}" rel="noopener" target="_blank">${esc(f.stay.list.name)}</a>`;
  const b = f.body({ src, kagura: kaguraLink(f.kagura) });
  const months = [...new Set(list.map(ym))];
  const scheduleHtml = !list.length
    ? `<p class="empty">いま掲載している${esc(f.kagura)}の開催予定はありません。日程は${src(Object.keys(S)[0])}でご確認ください。</p>`
    : months.length === 1 ? list.map((e) => card(e, "h3")).join("")
    : months.map((m) => `<h3 class="feature-month">${monthName(m)}</h3>${list.filter((e) => ym(e) === m).map((e) => card(e, "h4")).join("")}`).join("");
  const stayAside = stayHtml ? `<aside class="stay feature-stay" aria-labelledby="feature-stay-h"><h2 id="feature-stay-h">${esc(f.stay.label)}を探す</h2>
<p class="stay-lead">${esc(b.stayLead)}</p>
${stayHtml}<p class="meta">地元の宿の一覧: ${listSrc}</p>
<details class="stay-note"><summary>ご注意</summary><p class="meta annotation">宿泊日・人数は、リンク先で指定してください。会場までの距離・道のり、最終チェックインの時刻、空室・料金は、宿の案内で確認してください。</p></details>
${prNote}</aside>` : "";

  return `${b.intro}
<nav class="kagura-jumps" aria-label="このページの案内"><ul><li><a href="#f-schedule">日程</a></li><li><a href="#f-watch">見方とマナー</a></li><li><a href="#f-stay">泊まり方・帰り方</a></li>${stayAside ? '<li><a href="#feature-stay-h">宿を探す</a></li>' : ""}</ul></nav>

<h2 id="f-schedule">${esc(f.kagura)}の日程${months.length === 1 ? `(${monthName(months[0])})` : ""}</h2>
${b.scheduleNote}
${scheduleHtml}

<h2 id="f-watch">見方とマナー</h2>
${b.watch}

<h2 id="f-stay">泊まり方・帰り方</h2>
${b.stay}
${stayAside}
${sponsor}
<p class="meta">出典: ${Object.keys(S).map(src).join("・")}${b.sourcesNote}。文章の確認日: ${jpDay(FEATURE_CHECKED)}。日程・時刻は変わることがあります。出かける前に、必ず公式の案内をご確認ください。</p>
<p><a class="btn" href="/guide.html#prepare">夜の観覧の服装・持ち物を見る</a> <a class="btn ghost" href="/calendar.html">ほかの神楽を探す</a></p>`;
}
