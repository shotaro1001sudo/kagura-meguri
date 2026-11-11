// 特集: 遠山の霜月祭と花祭 夜通しの神楽の見方・泊まり方(ADV-20261110-5)
// - 12月の遠山の霜月祭(長野県飯田市)と東栄町の花祭(愛知県)の日程を、events.json の「これからの開催」から並べる。
// - 見方・泊まり方は、公式の案内(飯田市・遠山の霜月祭の公式サイト・東栄町観光まちづくり協会・Aichi Now)に書いてあることだけを書く。
//   時刻や宿の名前は、ここに書かない(日程は開催データ、宿は公式の一覧へのリンクで見せる)。
// - 宿の広告(じゃらん・楽天トラベル)は、地域ごとの枠に「PR」と付けて置く。協賛枠は、承認された協賛があるときだけ出る(見本の枠は出さない)。

export const FEATURE_PATH = "/feature/shimotsuki-hanamatsuri.html";
export const FEATURE_ID = "shimotsuki-hanamatsuri";
export const FEATURE_TITLE = "遠山の霜月祭と花祭 夜通しの神楽の見方・泊まり方";
export const FEATURE_KAGURA = { shimo: "遠山の霜月祭", hana: "花祭" };
// 文章を確かめた日(公式の案内を読み直したら、ここを更新する)
export const FEATURE_CHECKED = "2026-11-11";

export const FEATURE_SOURCES = {
  shimoTop: { name: "遠山の霜月祭 公式サイト", url: "https://shimotsukimatsuri.com/" },
  shimoManners: { name: "遠山の霜月祭 公式サイト(見学のマナー)", url: "https://shimotsukimatsuri.com/manners/" },
  iida: { name: "飯田市(令和8年度 遠山の霜月祭の日程)", url: "https://www.city.iida.lg.jp/site/bunkazai/20261101.html" },
  tohyamaStay: { name: "遠山郷観光協会(食べる＆泊まる)", url: "https://tohyamago.com/archives/category/stay_eat" },
  toei: { name: "東栄町観光まちづくり協会(花祭)", url: "https://www.toeinavi.jp/spots/hanamatsuri/" },
  toeiTown: { name: "東栄町(花祭の地区)", url: "http://www.town.toei.aichi.jp/1584.htm" },
};

// 宿の検索に使う地名(市町村名だと遠い宿が多く出るため、宿の検索で近くの宿が出ることを確かめた呼び名にする。2026-11-11 確認)
export const FEATURE_STAY_AREAS = [
  { key: "tohyama", kagura: FEATURE_KAGURA.shimo, area: "遠山郷", label: "遠山郷(飯田市)の宿", sourceKey: "tohyamaStay" },
  { key: "okumikawa", kagura: FEATURE_KAGURA.hana, area: "奥三河", label: "東栄町・奥三河の宿", sourceKey: "toei" },
];

/** 特集に載せる開催: 2つの祭りの、これからの開催(日付順) */
export const featureEvents = (upcoming) => {
  const pick = (k) => upcoming.filter((e) => e.kagura === k).sort((a, b) => a.start.localeCompare(b.start) || a.id.localeCompare(b.id));
  return { shimo: pick(FEATURE_KAGURA.shimo), hana: pick(FEATURE_KAGURA.hana) };
};

const ym = (e) => e.start.slice(0, 7);
const monthName = (k) => `${+k.slice(0, 4)}年${+k.slice(5, 7)}月`;

/**
 * 特集ページの本文(パンくず・見出しの下)
 * @param {object} o
 * @param {{shimo:object[],hana:object[]}} o.list featureEvents の結果
 * @param {(e:object,h?:string)=>string} o.card 開催のカード
 * @param {(k:string)=>string} o.kaguraLink 種類のページへのリンク(ページがなければ文字だけ)
 * @param {(a:object)=>string} o.stayHtml 地域ごとの宿の広告(ボタン。広告がなければ空)
 * @param {string} o.prNote 広告の表示(PR)。宿の広告が1つもなければ空
 * @param {string} o.sponsor 協賛枠(なければ空)
 */
export function overnightFeatureHtml({ esc, list, card, kaguraLink, stayHtml, prNote = "", sponsor = "" }) {
  const S = FEATURE_SOURCES;
  const src = (k) => `<a href="${esc(S[k].url)}" rel="noopener" target="_blank">${esc(S[k].name)}</a>`;
  const empty = (k) => `<p class="empty">いま掲載している${esc(k)}の開催予定はありません。日程は${k === FEATURE_KAGURA.shimo ? src("shimoTop") : src("toei")}でご確認ください。</p>`;
  const byMonth = (xs) => [...new Set(xs.map(ym))].map((m) => [m, xs.filter((e) => ym(e) === m)]);

  const shimoHtml = list.shimo.length
    ? `${list.shimo.map((e) => card(e, "h3")).join("")}`
    : empty(FEATURE_KAGURA.shimo);
  const hanaMonths = byMonth(list.hana);
  const hanaHtml = list.hana.length
    ? hanaMonths.map(([m, xs]) => `<h3 class="feature-month">${monthName(m)}</h3>${xs.map((e) => card(e, "h4")).join("")}`).join("")
    : empty(FEATURE_KAGURA.hana);
  const shimoMonths = [...new Set(list.shimo.map(ym))];
  const shimoWhen = shimoMonths.length === 1 ? monthName(shimoMonths[0]) : "";

  const stays = FEATURE_STAY_AREAS.map((a) => ({ a, html: stayHtml(a) })).filter((x) => x.html);
  const stayAside = stays.length ? `<aside class="stay feature-stay" aria-labelledby="feature-stay-h"><h2 id="feature-stay-h">遠山郷・東栄町の宿を探す</h2>
<p class="stay-lead">どちらの祭りも、終わりが深夜や翌朝になります。泊まる日を祭りの日に合わせて、早めに探しておくと安心です。</p>
${stays.map(({ a, html }) => `<section class="feature-stay-area" aria-label="${esc(a.label)}"><h3>${esc(a.label)}</h3>${html}<p class="meta">地元の宿の一覧: ${src(a.sourceKey)}</p></section>`).join("")}
<details class="stay-note"><summary>ご注意</summary><p class="meta annotation">宿泊日・人数は、リンク先で指定してください。会場までの距離・道のり、最終チェックインの時刻、空室・料金は、宿の案内で確認してください。</p></details>
${prNote}</aside>` : "";

  return `<p class="lead">長野県飯田市の遠山郷で行われる「遠山の霜月祭」と、愛知県東栄町の「花祭」は、どちらも釜の湯を沸かして神々を迎える湯立ての神楽です。国の重要無形民俗文化財に指定されていて、集落や神社ごとに日をずらし、夜を通して行われます。</p>
<p>終わりが深夜や翌朝になるため、寒さへの備えと、泊まる場所・帰りの足を先に決めておくと安心です。このページでは、これからの日程と、公式の案内にもとづく見方・泊まり方をまとめます。</p>
<nav class="kagura-jumps" aria-label="このページの案内"><ul><li><a href="#f-shimotsuki">霜月祭の日程</a></li><li><a href="#f-hanamatsuri">花祭の日程</a></li><li><a href="#f-watch">見方とマナー</a></li><li><a href="#f-stay">泊まり方・帰り方</a></li>${stayAside ? '<li><a href="#feature-stay-h">宿を探す</a></li>' : ""}</ul></nav>

<h2 id="f-shimotsuki">遠山の霜月祭の日程${shimoWhen ? `(${shimoWhen})` : ""}</h2>
<p>長野県飯田市の遠山郷(上村・南信濃)の神社で、日をずらして行われます。時刻は目安で、変わることがあります(${src("iida")})。くわしくは${kaguraLink(FEATURE_KAGURA.shimo)}のページもご覧ください。</p>
${shimoHtml}

<h2 id="f-hanamatsuri">東栄町の花祭の日程</h2>
<p>愛知県東栄町の集落ごとに、11月から1月にかけて行われます。日程・時刻は${src("toei")}・${src("toeiTown")}で確かめてから出かけましょう。くわしくは${kaguraLink(FEATURE_KAGURA.hana)}のページもご覧ください。</p>
${hanaHtml}

<h2 id="f-watch">夜通しの神楽の見方とマナー</h2>
<h3>2つの祭りに共通すること</h3>
<ul>
<li>夜は山あいで冷え込みます。霜月祭の公式サイトは、祭りが深夜まで続くので防寒の準備をと呼びかけています。花祭も、寒さ・眠さ・焚き火の煙への備えをと案内されています。</li>
<li>写真を撮るときも、フラッシュ(ストロボ)は使いません。</li>
<li>祭りは地元の方の神事です。舞の場所に入らず、地元の方や係の方の指示に従いましょう。</li>
</ul>
<h3>遠山の霜月祭</h3>
<ul>
<li>一般の方も見学できます。大勢ではなく少人数で訪れ、お賽銭を納めるよう案内されています(${src("shimoManners")})。</li>
<li>掲載の時刻には、面が出る前の神事の時間も含まれます。見物の方が多く訪れるのは面が出るころからで、公式の案内では17時以降(朝まで続く神社は19時以降)が目安とされています。</li>
<li>見物の人数を制限する場合があります。地元の方や他の見物客の妨げにならないようにしましょう(${src("iida")})。</li>
</ul>
<h3>東栄町の花祭</h3>
<ul>
<li>見学は無料です(Aichi Now)。会場の会所に「お見舞い」(奉納金)を持っていくと、地区ごとのお返しがもらえます。目安は1人3,000円ほどと案内されています(${src("toei")})。</li>
<li>舞庭は神聖な場所です。面をつけた舞い手は、ストロボの光を嫌います。</li>
</ul>

<h2 id="f-stay">泊まり方・帰り方</h2>
<h3>休む場所</h3>
<ul>
<li>霜月祭では、一部の神社に有料の休憩所が用意されます。どの神社かは、決まりしだい${src("shimoTop")}で案内されます。</li>
<li>夜通し観るつもりなら、近くの宿を早めに取っておきましょう。</li>
</ul>
<h3>宿</h3>
<ul>
<li>遠山郷の宿は、${src("tohyamaStay")}にまとまっています。</li>
<li>東栄町の宿は、${src("toei")}のページに、花祭の日に泊まれる宿の一覧があります。門限のない宿や、送迎のある宿も載っています。</li>
</ul>
<h3>行き帰り</h3>
<ul>
<li>東栄町の会場へは道が細く、冬は道が凍ります。車はスタッドレスタイヤで。運転する人はお酒を飲まないようにしましょう。公共交通での行き来は難しく、タクシーの利用が勧められています(${src("toei")})。駐車場のない会場もあります。</li>
<li>遠山郷も山あいの集落です。終わりが深夜や翌朝になるため、帰りの運転を避けられるよう、泊まる計画にすると安心です。</li>
</ul>
${stayAside}
${sponsor}
<p class="meta">出典: ${Object.keys(S).map(src).join("・")}・Aichi Now(愛知県公式観光サイト)。文章の確認日: ${FEATURE_CHECKED.replace(/^(\d{4})-0?(\d+)-0?(\d+)$/, "$1年$2月$3日")}。日程・時刻は変わることがあります。出かける前に、必ず公式の案内をご確認ください。</p>
<p><a class="btn" href="/guide.html#prepare">夜の観覧の服装・持ち物を見る</a> <a class="btn ghost" href="/calendar.html">ほかの神楽を探す</a></p>`;
}
