// 「はじめての神楽ガイド」(/guide.html)の本文。
// 事実(時期・作法・撮影・持ち物など)は、下の SOURCES の公式・公的な情報で確認したものだけを書く。
// 出典は、文末の小さな番号([1] など)で示し、ページの最後にまとめる。番号は、本文に初めて出てくる順。
// 出典の文章は、そのまま写さず、要約して書く。内容を変えたら CHECKED(確認日)を更新する。

import { figure, flow, table, icon, stageDiagram } from "./figures.mjs";

export const CHECKED = "2026-10-20";

export const SOURCES = [
  { id: "takachiho", name: "高千穂の夜神楽", by: "高千穂町観光協会", url: "https://takachiho-kanko.info/kagura/yokagura/" },
  { id: "jta", name: "高千穂の夜神楽(概要)", by: "観光庁 地域観光資源の多言語解説文データベース", url: "https://www.mlit.go.jp/tagengo-db/common/001537994.docx" },
  { id: "iwamiqa", name: "石見神楽 Q&A", by: "浜田市観光協会(石見神楽公式サイト)", url: "https://iwamikagura.jp/about/qa/" },
  { id: "shimane", name: "石見神楽とは", by: "島根県観光連盟(しまね観光ナビ)", url: "https://www.kankou-shimane.com/pickup/46684.html" },
  { id: "hiroshima", name: "迫力満点！広島神楽の見どころチェック", by: "広島県(徹底解剖！ひろしまラボ)", url: "https://www.pref.hiroshima.lg.jp/lab/topics/20201204/01/" },
  { id: "akitakata", name: "ひろしま安芸高田神楽", by: "安芸高田市観光協会(あきたかたNAVI)", url: "https://akitakata-kankou.jp/main/kagura/" },
  { id: "bitchu", name: "備中神楽", by: "文化庁 文化遺産オンライン", url: "https://online.bunka.go.jp/heritages/detail/170185" },
  { id: "ondake", name: "御嶽神楽", by: "文化庁 文化遺産オンライン", url: "https://online.bunka.go.jp/heritages/detail/160038" },
  { id: "noh", name: "能楽", by: "文化庁 文化遺産オンライン", url: "https://online.bunka.go.jp/heritages/detail/214083" },
  { id: "kabuki", name: "歌舞伎", by: "京都市観光協会(京都観光Navi)", url: "https://ja.kyoto.travel/traditionalculture/kabuki.php" },
];

// 章(目次と、見出しの番号)
export const CHAPTERS = [
  ["where", "どこで観られる?"],
  ["charm", "神楽ならではの面白さ"],
  ["highlights", "各地の神楽の見どころ"],
  ["manners", "観るときのマナー"],
  ["prepare", "服装・持ち物・交通"],
  ["check", "日程と予約の確かめ方"],
];

/**
 * @param {object} x
 * @param {(s:string)=>string} x.esc
 * @param {(k:string)=>string} x.kaguraLink 神楽の種類ページへのリンク(ページがなければ、名前だけ)
 */
export function guideHtml({ esc, kaguraLink }) {
  // 出典の番号: 初めて出てきた順に振る。最初の出現にだけ id を付け、出典の一覧から戻れるようにする
  const order = [];
  const cite = (...ids) => ids.map((id) => {
    if (!SOURCES.some((s) => s.id === id)) throw new Error(`出典がありません: ${id}`);
    let n = order.indexOf(id) + 1;
    const first = n === 0;
    if (first) { order.push(id); n = order.length; }
    return `<sup class="cite"><a href="#src-${n}"${first ? ` id="ref-${n}"` : ""} aria-label="出典${n}">[${n}]</a></sup>`;
  }).join("");
  const toToc = '<p class="totoc"><a href="#toc">↑ 目次へ戻る</a></p>';
  const chapter = (i) => { const [id, title] = CHAPTERS[i]; return `${i ? toToc : ""}<h2 id="${id}" class="gsec"><span class="no">${String(i + 1).padStart(2, "0")}</span>${title}</h2>`; };
  const card = (title, inner, sub = "") => `<section class="gcard"><h3>${title}${sub ? `<small>${sub}</small>` : ""}</h3>${inner}</section>`;
  const cards = (...xs) => `<div class="gcards">${xs.join("")}</div>`;

  const body = `
<p>神楽(かぐら)は、神社の祭りなどで神様に奉納される歌と舞です。囃子(はやし)の速さも衣装も演目も、地域によって大きく違います。</p>
<p>このページでは、はじめて神楽を観る方に向けて、観られる場所や見どころ、マナー、服装を、各地の公式情報をもとにまとめました。</p>
<p>神楽がいつ、どのように生まれて広まったのかは、<a href="/history/">神楽の歴史</a>で紹介しています。神話の時代から現代までを、年表でたどれます。</p>
<nav class="toc" id="toc" aria-label="このページの目次"><ol>${CHAPTERS.map(([id, t]) => `<li><a href="#${id}">${t}</a></li>`).join("")}</ol></nav>

${chapter(0)}
${cards(
  card("神社の祭り・夜神楽", `<p>神楽は、もともと氏神様に奉納するものです。</p>
<ul>
<li>各地の神社の祭礼で奉納されます。秋祭りや収穫祭の時期に多い地域もあります。${cite("iwamiqa", "hiroshima")}</li>
<li>夜通し舞う「夜神楽」が行われる地域もあります。会場は神社に限らず、民家や公民館のこともあります。${cite("takachiho")}</li>
</ul>`, "神様への奉納"),
  card("ホールの公演・神楽まつり", `<p>司会者があらすじを説明したり、あらすじを書いた紙が配られたりすることが多いので、物語を追いやすいのが特徴です。</p>
<ul>
<li>神楽専用の劇場や、芝居小屋のような舞台がある地域もあります。${cite("akitakata")}</li>
<li>神楽の団体が出演する神楽まつりや大会も、各地で開かれています。${cite("hiroshima")}</li>
</ul>`, "物語を追いやすい"))}
${figure(stageDiagram(), "舞台の見方の一例です。配置は会場によって違います。囃子(はやし)は大太鼓・小太鼓・手打鉦・笛などで演奏され、舞い手の動きに合わせて速さが変わります。")}
<p><a href="/weekend.html">今週末の神楽</a>・<a href="/this-month.html">今月の神楽</a>・<a href="/map.html">地図</a>から、近くで開かれる神楽を探せます。</p>

${chapter(1)}
<p>同じ日本の伝統芸能でも、神楽と能と歌舞伎では、成り立ちも見せ方もずいぶん違います。</p>
<div class="tblwrap" role="region" aria-label="神楽・能・歌舞伎の比べ表" tabindex="0"><table class="tbl cmp">
<thead><tr><th scope="col"></th><th scope="col">神楽</th><th scope="col">能</th><th scope="col">歌舞伎</th></tr></thead>
<tbody>
<tr><th scope="row">始まり</th><td data-k="神楽">神様に奉納する歌と舞。神事として受け継がれてきた${cite("iwamiqa", "hiroshima")}</td><td data-k="能">14世紀ごろに大成された歌舞劇${cite("noh")}</td><td data-k="歌舞伎">1603年、出雲阿国の「かぶき踊り」が始まりとされる${cite("kabuki")}</td></tr>
<tr><th scope="row">表現</th><td data-k="神楽">勧善懲悪の分かりやすい筋。衣装と面を見れば、役柄がすぐ分かる${cite("hiroshima")}</td><td data-k="能">様式化された簡素な表現で、人の感情を繊細に表す${cite("noh")}</td><td data-k="歌舞伎">隈取(くまどり)の色で役柄を表し、要所で「見得」を切る${cite("kabuki")}</td></tr>
<tr><th scope="row">見せ場</th><td data-k="神楽">演目によっては、一瞬で衣装が変わる「早変わり」や、火や煙を吹く大蛇が登場する${cite("hiroshima", "shimane")}</td><td data-k="能">謡と囃子を伴奏に、舞うような所作で物語が進む${cite("noh")}</td><td data-k="歌舞伎">回り舞台、セリ、客席を通る花道${cite("kabuki")}</td></tr>
</tbody></table></div>
${cards(
  card("観る人との距離が近い", `<p>観光で訪れた人も「参列者」として迎えてくれる神楽があります。${cite("jta")}</p>
<p>舞い手が観客に絡む場面のある演目もあり、舞台と客席が近いのも神楽の魅力です。${cite("ondake")}</p>`),
  card("物語が分かりやすい", `<p>演目の多くは、日本の神話や昔話がもとになっています。神話になじみのない人や子どもでも、親しみやすいと紹介されています。${cite("hiroshima")}</p>`),
  card("土地ごとに違う", `<p>囃子の速さや衣装、演目は、地域によって大きく違います。</p>
<p>同じ地域でも、集落ごとに舞の順番や演目が違うことがあります。見比べてみるのも、楽しみ方のひとつです。${cite("takachiho")}</p>`),
  card("歌舞伎や能との共通点も", `<p>神楽の「早変わり」には、歌舞伎の「ぶっ返り」とよく似た仕掛けのものがあります。${cite("iwamiqa")}</p>
<p>歌舞伎や能と同じように、新しくつくられた演目を持つ神楽もあります。${cite("iwamiqa")}</p>`))}

${chapter(2)}
${cards(
  card(kaguraLink("石見神楽"), `<p>笛と太鼓の囃子にのって、金糸・銀糸の豪華な衣装で舞います。</p>
<ul>
<li>いまの主流は、テンポの速い「八調子」。ゆっくり重厚に舞う「六調子」もあります。</li>
<li>代表的な演目「大蛇(おろち)」では、提灯の仕組みを応用した蛇の胴を使い、大蛇が火や煙を吹きます。</li>
<li>面には地元の石州和紙が使われています。${cite("shimane", "iwamiqa")}</li>
</ul>`, "島根県"),
  card(kaguraLink("広島神楽"), `<ul>
<li>神や姫の役は、面をつけずに化粧をして舞います。舞い手の表情にも注目です。</li>
<li>衣装や面が一瞬で変わる「早変わり」は、見逃せません。${cite("hiroshima")}</li>
<li>${kaguraLink("安芸高田神楽")}には、古事記や日本書紀を題材にゆっくり舞う「旧舞」と、戦後に生まれた派手な「新舞」があります。${cite("akitakata")}</li>
</ul>`, "広島県"),
  card(kaguraLink("備中神楽"), `<p>国の重要無形民俗文化財です(1979年指定)。</p>
<ul>
<li>「神殿(こうどの)」と呼ばれる舞台をしつらえて演じます。</li>
<li>「天岩戸開き」「国譲り」「大蛇退治」などの神話劇は、幕末に西林国橋が新しい様式に整えたとされています。${cite("bitchu")}</li>
</ul>`, "岡山県"),
  card(kaguraLink("高千穂神楽"), `<p>国の重要無形民俗文化財です(1978年指定)。</p>
<ul>
<li>全三十三番の神楽を、ひと晩かけて奉納します。</li>
<li>とりわけ大切な「式三番」(神降・鎮守・杉登)は、必ず舞われます。</li>
<li>終盤の山場は、夜明けごろの「岩戸五番」。天鈿女命(あめのうずめのみこと)の舞に神々が笑う場面が見どころです。${cite("takachiho")}</li>
</ul>`, "宮崎県"),
  card(kaguraLink("御嶽神楽"), `<p>国の重要無形民俗文化財です(2007年指定)。大分県南部に伝わり、御嶽神社の秋の祭礼で舞われます。</p>
<ul>
<li>神話を題材にした33の演目を伝えています。激しい動きの、勇ましい舞が持ち味です。</li>
<li>最初に「五方礼始(ごほうれいし)」で場を清め、最後は必ず「大神(たいじん)」で天下太平を祝います。${cite("ondake")}</li>
</ul>`, "大分県"))}

${chapter(3)}
<p>神楽は芸能であると同時に、神様への奉納でもあります。地域の人たちが守ってきた場にお邪魔する、という気持ちで観ましょう。</p>
${cards(
  card(`${icon("camera")}撮影は、許可を得てから`, `<ul>
<li>フラッシュは避けます。</li>
<li>三脚やビデオの機材で、ほかの人の邪魔をしないようにします。</li>
<li>写真もビデオも、神楽の団体(社中)や神社の役員に許可をもらうよう案内されています。${cite("iwamiqa")}</li>
</ul>`),
  card(`${icon("voice")}舞の場所に入るときは、声をかける`, `<p>舞の場所に入るときは、先に主催者(お宮の総代などの役員)に声をかけるよう案内されています。${cite("iwamiqa")}</p>`),
  card(`${icon("bin")}ゴミは持ち帰る`, `<p>飲食できる会場でも周りに気を配り、ゴミは持ち帰りましょう。${cite("iwamiqa")}</p>`),
  card(`${icon("flower")}お礼の気持ち(御花・御神前)`, `<ul>
<li>神社の祭りの神楽では、神楽の団体にご祝儀(「御花」など)を渡す習慣のある地域もあります。あくまで気持ちなので、任意です。${cite("iwamiqa")}</li>
<li>神事に参列する礼儀として、受付で初穂料(「御神前」など)を納める神楽もあります。${cite("takachiho")}</li>
</ul>`),
  card(`${icon("eye")}雰囲気は、会場で違う`, `<p>ホールの公演や祭りでは、屋台のお酒を片手に気軽に観る人も多いと紹介されています。${cite("akitakata")}</p>
<p>神事として行われる神楽には、地域ごとに観る側の心得があります。${cite("jta")} 迷ったときは、主催者や地元の方に尋ねてみましょう。</p>`))}

${chapter(4)}
${cards(
  card(`${icon("snow")}夜と寒さに備える`, `<ul>
<li>神社の神楽は、夜に行われることがよくあります。</li>
<li>冬は毛布やカイロ、夏は虫よけとタオルがあると便利です。${cite("iwamiqa")}</li>
<li>夜通しの神楽なら、防寒具と飲み物・軽食があると安心です。${cite("takachiho")}</li>
</ul>`),
  card(`${icon("chair")}あると便利なもの`, `<ul><li>飲み物・食べ物</li><li>折りたたみのいす</li><li>ひざ掛け${cite("iwamiqa")}</li></ul>`),
  card(`${icon("car")}交通`, `<ul>
<li>神社の神楽は夜が多いので、タクシーや車で行くよう勧められています。</li>
<li>市街地の神社には、駐車場がほとんどないこともあります。${cite("iwamiqa")}</li>
</ul>`))}
<h3 class="fig-h">持ち物チェック表</h3>
${table(["場面", "あると便利なもの"], [
  ["冬の夜", "毛布・カイロ"],
  ["夏の夜", "虫よけ・タオル"],
  ["夜通しの神楽", "防寒具・飲み物・軽食"],
  ["どの季節でも", "飲み物・食べ物・折りたたみのいす・ひざ掛け"],
], "持ち物チェック表", "chk")}

${chapter(5)}
${figure(flow([
  { t: `${icon("calendar")}日程を探す`, d: "このサイトの一覧や地図で、近くで開かれる神楽を見つける" },
  { t: `${icon("eye")}公式情報で確かめる`, d: "日時・会場・料金は変わることがある" },
  { t: `${icon("phone")}予約・問い合わせ`, d: "予約が必要な公演や集落の神楽は、早めに確認" },
  { t: `${icon("snow")}当日の備え`, d: "夜と寒さに備え、飲み物などを用意する" },
  { t: `${icon("flower")}観賞・お礼`, d: "ご祝儀(御花)は任意" },
], "神楽を観に行くまでの流れ", "h"), "観に行くまでのおおまかな流れです。くわしくは下の各項目をご覧ください。")}
${cards(
  card("最新の日程は、公式情報で", `<p>日時や会場、料金は変わることがあります。出かける前に、各ページの「公式情報を見る」から主催者の案内を確かめてください。</p>`),
  card("演目は当日まで分からないことも", `<p>祭りの神楽では、演目や順番が当日まで決まっていないことがあります。${cite("iwamiqa")}</p>`),
  card("集落の神楽は、早めに問い合わせを", `<p>集落ごとに行われる神楽は、会場や日程が年によって変わることがあります。2週間ほど前に観光協会などへ問い合わせておくと確実です。${cite("takachiho")}</p>`),
  card("予約が必要な公演も", `<p>公演によっては事前予約が必要だったり、当日受付の人数が決まっていたりします。各公演のページで確かめてください。</p>`))}

${toToc}
<h2>神楽を探す</h2>
<p><a class="btn" href="/weekend.html">今週末の神楽</a> <a class="btn ghost" href="/calendar.html">日付・場所で探す</a> <a class="btn ghost" href="/map.html">地図で探す</a> <a class="btn ghost" href="/kagura/">種類で探す</a> <a class="btn ghost" href="/history/">神楽の歴史</a></p>`;

  // 出典の一覧(番号順)。本文で使っていない出典は、ここで気づけるようにする
  const unused = SOURCES.filter((s) => !order.includes(s.id));
  if (unused.length) throw new Error(`本文で使っていない出典: ${unused.map((s) => s.id).join(", ")}`);
  const list = order.map((id, i) => {
    const s = SOURCES.find((x) => x.id === id);
    return `<li id="src-${i + 1}"><a href="${s.url}" rel="noopener" target="_blank">${esc(s.name)}</a>(${esc(s.by)}) <a class="back" href="#ref-${i + 1}" aria-label="本文の出典${i + 1}へ戻る">↩</a></li>`;
  }).join("");
  return `${body}

<h2 id="sources">出典</h2>
<ol class="sources">${list}</ol>
<p class="meta">確認日: ${CHECKED.replace(/^(\d{4})-0?(\d+)-0?(\d+)$/, "$1年$2月$3日")}。上の公式・公的な情報をもとに要約しています。作法や決まりは地域や公演によって違うので、現地の案内を優先してください。誤りに気づいたら、<a href="/contact.html">お問い合わせ</a>からお知らせください。</p>`;
}
