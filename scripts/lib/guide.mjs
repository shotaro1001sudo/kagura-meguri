// 「はじめての神楽ガイド」(/guide.html)の本文。
// 事実(時期・作法・撮影・持ち物など)は、下の SOURCES の公式・公的な情報で確認したものだけを書く。
// 出典は、文末の小さな番号([1] など)で示し、ページの最後にまとめる。番号は、本文に初めて出てくる順。
// 出典の文章は、そのまま写さず、要約して書く。内容を変えたら CHECKED(確認日)を更新する。

export const CHECKED = "2026-10-10";

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
  const chapter = (i) => { const [id, title] = CHAPTERS[i]; return `<h2 id="${id}" class="gsec"><span class="no">${String(i + 1).padStart(2, "0")}</span>${title}</h2>`; };
  const card = (title, inner, sub = "") => `<section class="gcard"><h3>${title}${sub ? `<small>${sub}</small>` : ""}</h3>${inner}</section>`;
  const cards = (...xs) => `<div class="gcards">${xs.join("")}</div>`;

  const body = `
<p>神楽(かぐら)は、神社の祭りなどで神様に奉納される歌と舞です。地域ごとに、囃子(はやし)の速さや衣装、演目が大きく違います。</p>
<p>このページでは、はじめて神楽を観る方に向けて、観られる場所と見どころ、マナー、服装を、各地の公式情報をもとにまとめました。</p>
<nav class="toc" aria-label="このページの目次"><ol>${CHAPTERS.map(([id, t]) => `<li><a href="#${id}">${t}</a></li>`).join("")}</ol></nav>

${chapter(0)}
${cards(
  card("神社の祭り・夜神楽", `<p>神楽の本来の姿は、氏神様への奉納です。</p>
<ul>
<li>石見地方(島根県西部)では、各地の神社の祭礼で奉納されます。秋が最も多いとされています。${cite("iwamiqa")}</li>
<li>広島県でも、昔から秋の収穫祭に奉納されてきました。${cite("hiroshima")}</li>
<li>宮崎県の高千穂では、11月中旬から2月上旬に、民家や公民館で夜通し舞う「夜神楽」があります。${cite("takachiho")}</li>
</ul>`, "奉納の神楽"),
  card("ホールの公演・神楽まつり", `<p>司会があらすじを説明したり、あらすじの紙が配られたりすることが多く、物語を追いやすいのが特徴です。</p>
<ul>
<li>広島県安芸高田市の「神楽門前湯治村」には、神楽専用の「神楽ドーム」と、芝居小屋のような「かむくら座」があります。${cite("akitakata")}</li>
<li>神楽の団体が出演する神楽まつりや大会も、各地で開かれています。${cite("hiroshima")}</li>
</ul>`, "物語を追いやすい"))}
<p><a href="/weekend.html">今週末の神楽</a>・<a href="/this-month.html">今月の神楽</a>・<a href="/map.html">地図</a>から、近くの開催を探せます。</p>

${chapter(1)}
<p>同じ日本の伝統芸能でも、神楽・能・歌舞伎は、成り立ちも見せ方も違います。</p>
<div class="tblwrap"><table class="tbl cmp">
<thead><tr><th scope="col"></th><th scope="col">神楽</th><th scope="col">能</th><th scope="col">歌舞伎</th></tr></thead>
<tbody>
<tr><th scope="row">始まり</th><td data-k="神楽">神様に奉納する歌と舞。神事として受け継がれてきた${cite("iwamiqa", "hiroshima")}</td><td data-k="能">14世紀ごろに大成された歌舞劇${cite("noh")}</td><td data-k="歌舞伎">1603年、出雲阿国の「かぶき踊り」が始まりとされる${cite("kabuki")}</td></tr>
<tr><th scope="row">表現</th><td data-k="神楽">勧善懲悪の分かりやすい筋。衣装と面で、役柄がすぐ分かる${cite("hiroshima")}</td><td data-k="能">様式化された簡素な表現で、人の感情を繊細に表す${cite("noh")}</td><td data-k="歌舞伎">隈取(くまどり)の色で役柄を表し、要所で「見得」を切る${cite("kabuki")}</td></tr>
<tr><th scope="row">見せ場</th><td data-k="神楽">一瞬で衣装が変わる「早変わり」、火や煙を吹く大蛇${cite("hiroshima", "shimane")}</td><td data-k="能">謡と囃子を伴奏に、舞うような所作で物語が進む${cite("noh")}</td><td data-k="歌舞伎">回り舞台、セリ、客席を通る花道${cite("kabuki")}</td></tr>
</tbody></table></div>
${cards(
  card("観る人との距離が近い", `<p>高千穂の夜神楽では、観光で訪れた人も「参列者」として迎えられます。${cite("jta")}</p>
<p>大分県の御嶽神楽には、舞い手が観客と榊の枝を引っ張り合う場面があります。${cite("ondake")}</p>`),
  card("物語が分かりやすい", `<p>多くの演目は、日本の神話や昔話がもとです。神話になじみがない人や、子どもにも親しみやすいと紹介されています。${cite("hiroshima")}</p>`),
  card("土地ごとに違う", `<p>囃子の速さや衣装、演目は、地域で大きく違います。</p>
<p>高千穂の夜神楽では、舞の順番や題目が集落ごとに違い、見比べるのも楽しみ方の一つとされています。${cite("takachiho")}</p>`),
  card("歌舞伎や能との共通点も", `<p>石見神楽の「早変わり」は、歌舞伎の「ぶっ返り」と同じような仕掛けだと紹介されています。</p>
<p>歌舞伎や能と同じように、新しく創作された演目もあります。${cite("iwamiqa")}</p>`))}

${chapter(2)}
${cards(
  card(kaguraLink("石見神楽"), `<p>笛と太鼓の囃子にのせて、金糸・銀糸の豪華な衣装で舞います。</p>
<ul>
<li>いまはテンポの速い「八調子」が主流です。ゆっくり重厚に舞う「六調子」もあります。</li>
<li>代表的な演目「大蛇(おろち)」では、提灯の仕組みから生まれた蛇の胴を使い、大蛇が火や煙を吹きます。</li>
<li>面には、地元の石州和紙が使われています。${cite("shimane", "iwamiqa")}</li>
</ul>`, "島根県"),
  card(kaguraLink("広島神楽"), `<ul>
<li>神や姫の役は、面を付けずに化粧をして舞います。舞い手の表情も見どころです。</li>
<li>一瞬で衣装や面が変わる「早変わり」は、見逃せない場面です。${cite("hiroshima")}</li>
<li>${kaguraLink("安芸高田神楽")}には、古事記・日本書紀を題材にゆっくり舞う「旧舞」と、戦後に生まれた派手な「新舞」があります。${cite("akitakata")}</li>
</ul>`, "広島県"),
  card(kaguraLink("備中神楽"), `<p>国の重要無形民俗文化財です(1979年指定)。</p>
<ul>
<li>「神殿(こうどの)」と呼ぶ舞台を設けて演じます。</li>
<li>「天岩戸開き」「国譲り」「大蛇退治」などの神話劇は、幕末に西林国橋が新しい様式に整えたとされています。${cite("bitchu")}</li>
</ul>`, "岡山県"),
  card(kaguraLink("高千穂神楽"), `<p>国の重要無形民俗文化財です(1978年指定)。</p>
<ul>
<li>全三十三番の神楽を、一晩かけて奉納します。</li>
<li>最も重要な「式三番」(神降・鎮守・杉登)は、必ず舞われます。</li>
<li>夜明けごろの「岩戸五番」が終盤の山場です。天鈿女命(あめのうずめのみこと)の舞に、神々が笑う場面が見どころです。${cite("takachiho")}</li>
</ul>`, "宮崎県"),
  card(kaguraLink("御嶽神楽"), `<p>国の重要無形民俗文化財です(2007年指定)。大分県南部に伝わり、御嶽神社の秋の祭礼で演じられます。</p>
<ul>
<li>神話を題材にした33の演目を伝えています。激しい動きの、勇壮な舞が特徴です。</li>
<li>最初に「五方礼始(ごほうれいし)」で場を清め、最後は必ず「大神(たいじん)」で天下太平を祝います。${cite("ondake")}</li>
</ul>`, "大分県"))}

${chapter(3)}
<p>神楽は芸能であると同時に、神様への奉納です。地域が受け継いできた場にお邪魔する、という気持ちで観ましょう。</p>
${cards(
  card("撮影は、許可を得てから", `<ul>
<li>フラッシュは避けます。</li>
<li>三脚やビデオの機材が、ほかの人の邪魔にならないようにします。</li>
<li>写真もビデオも、神楽の団体(社中)や神社の役員の許可を得るよう、案内されています。${cite("iwamiqa")}</li>
</ul>`),
  card("舞の場所に入るときは、声をかける", `<p>舞が行われる場所に入る前に、主催者(お宮の総代などの役員)に声をかけるよう、案内されています。${cite("iwamiqa")}</p>`),
  card("ゴミは持ち帰る", `<p>飲食ができる会場でも、周りの迷惑にならないようにし、ゴミは持ち帰ります。${cite("iwamiqa")}</p>`),
  card("お礼の気持ち(御花・御神前)", `<ul>
<li>石見地方の奉納神楽では、氏子が神楽の団体へ「御花(ご祝儀)」を渡す習慣があります。あくまで任意です。${cite("iwamiqa")}</li>
<li>高千穂の夜神楽では、神事に参列する礼儀として、受付で「御神前」を納めます。${cite("takachiho")}</li>
</ul>`),
  card("雰囲気は、会場で違う", `<p>ホールの公演や祭りでは、屋台のお酒を楽しみながら、気軽に観る人も多いと紹介されています。${cite("akitakata")}</p>
<p>夜神楽のような神事の場では、集落ごとに観る人の心得があります。${cite("jta")} 迷ったら、主催者や地元の方に尋ねましょう。</p>`))}

${chapter(4)}
${cards(
  card("夜と寒さに備える", `<ul>
<li>神社の神楽は、夜に行われることが多くあります。</li>
<li>冬は毛布やカイロ、夏は虫よけとタオルがあると便利です。${cite("iwamiqa")}</li>
<li>高千穂の夜神楽では、防寒具と、飲み物・軽食の持参が勧められています。${cite("takachiho")}</li>
</ul>`),
  card("あると便利なもの", `<ul><li>飲み物・食べ物</li><li>折りたたみのいす</li><li>ひざ掛け${cite("iwamiqa")}</li></ul>`),
  card("交通", `<ul>
<li>神社の神楽は夜が多いため、タクシーや車での来場が勧められています。</li>
<li>市街地の神社には、駐車場がほとんどないことがあります。${cite("iwamiqa")}</li>
</ul>`))}

${chapter(5)}
${cards(
  card("公式情報で、最新の日程を", `<p>日時や会場、料金は変わることがあります。お出かけの前に、各ページの「公式情報を見る」から、主催者の案内を確かめてください。</p>`),
  card("演目は、当日まで決まらないことも", `<p>祭りの神楽では、演目や順番が、当日まで決まっていない場合があります。${cite("iwamiqa")}</p>`),
  card("高千穂の夜神楽", `<ul>
<li>日程表は、例年10月ごろに、高千穂町観光協会のサイトに載ります。</li>
<li>会場や日程は、2週間ほど前に問い合わせると確実です。${cite("takachiho")}</li>
</ul>`),
  card("予約が必要な公演も", `<p>公演によっては、事前の予約が必要だったり、当日受付の枠が決まっていたりします。各公演のページで確かめてください。</p>`))}

<h2>神楽を探す</h2>
<p><a class="btn" href="/weekend.html">今週末の神楽</a> <a class="btn ghost" href="/this-month.html">今月の神楽</a> <a class="btn ghost" href="/kagura/">神楽の種類から探す</a></p>`;

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
<p class="meta">確認日: ${CHECKED.replace(/^(\d{4})-0?(\d+)-0?(\d+)$/, "$1年$2月$3日")}。上の公式・公的な情報をもとに、要約しています。地域や公演によって、作法や決まりは違います。現地の案内を優先してください。誤りに気づいたら、<a href="/contact.html">お問い合わせ</a>からお知らせください。</p>`;
}
