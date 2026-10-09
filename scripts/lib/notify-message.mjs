// 週次の自動更新の結果を、運営者へ知らせる文面(件名と本文)を作る。
// 通信と分けた純粋な関数にして、細かくテストできるようにしている。
// 載せるのは、公開サイトに載せる事実(名称・日付・場所・公式URL)と件数だけ。訪問者の情報は、扱わない。

const WEEK = "日月火水木金土";
export const MAX_ITEMS = 30; // 1つの見出しに並べる件数の上限(残りは「ほか N 件」)

/** "2026-11-23T19:00" → "11/23(月)" */
export function shortDate(start) {
  const d = String(start ?? "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return "日付不明";
  const w = WEEK[new Date(`${d}T00:00:00Z`).getUTCDay()];
  return `${Number(d.slice(5, 7))}/${Number(d.slice(8, 10))}(${w})`;
}

/** 結果のひとこと(件名と本文の先頭に使う) */
export function headline({ jobStatus = "success", dryRun = false, changed = false, deployResult = "" }) {
  if (jobStatus === "cancelled") return { mark: "⏹", short: "途中で停止", long: "途中で止まりました(時間切れ・手動の停止)。" + (changed ? "データの反映は済んでいます。詳細を確認してください" : "何も公開されていません") };
  if (jobStatus !== "success") return changed
    ? { mark: "❌", short: "エラー(要確認)", long: "途中でエラーが出ました。データの反映は済んでいるため、詳細を確認してください" }
    : { mark: "❌", short: "失敗", long: "自動更新が失敗しました。何も公開されていません(テストに通らないデータは、公開されない仕組みです)" };
  if (dryRun) return { mark: "🧪", short: "試運転", long: "試運転です(反映も公開もしていません)" };
  if (!changed) return { mark: "➖", short: "変更なし", long: "変更はありませんでした(公開サイトは、そのままです)" };
  if (deployResult === "success") return { mark: "✅", short: "サイトを更新", long: "公開サイトを更新しました" };
  if (deployResult === "failure") return { mark: "⚠", short: "公開に失敗", long: "データは反映しましたが、公開サイトの更新に失敗しました。詳細を確認してください" };
  return { mark: "🔄", short: "公開を開始", long: "公開サイトの更新を開始しました(完了は確認できていません)" };
}

/** 件名と本文を作る */
export function buildMessage({ summary, jobStatus = "success", dryRun = false, changed = false, deployResult = "", siteUrl = "", runUrl = "", siteName = "神楽めぐり", date = "" }) {
  const s = summary ?? null;
  const day = s?.date ?? date;
  const h = headline({ jobStatus, dryRun, changed, deployResult });
  const counts = s ? `新規${s.published}・保留${s.held}・取り下げ${s.withdrawn}` : "結果なし";
  const subject = `【${siteName}】週次の自動更新 ${shortDate(day).replace(/\(.\)$/, "")}: ${h.mark} ${h.short}(${counts})`;

  const L = [`${siteName} 週次の自動更新(${day})`, "", `${h.mark} ${h.long}`];
  if (!s) {
    L.push("", "収集の結果は、ありません(収集の前に止まりました)");
  } else {
    const it = s.items ?? {};
    const list = (title, arr = [], n = 0, withReason = false) => {
      if (!n) return;
      L.push("", `■ ${title} ${n}件`);
      for (const e of arr.slice(0, MAX_ITEMS)) {
        L.push(`・${shortDate(e.start)} ${e.name}(${e.prefecture ?? ""}${e.city ?? ""})${e.note ? ` ※${e.note}` : ""}`);
        if (withReason && e.reason) L.push(`　理由: ${e.reason}`);
        if (e.url) L.push(`　${e.url}`);
      }
      const shown = Math.min(arr.length, MAX_ITEMS);
      if (n > shown) L.push(`・ほか ${n - shown} 件`);
    };
    list(dryRun ? "新規掲載(試運転なので、まだ掲載していません)" : "新規掲載", it.published, s.published);
    list("取り下げ", it.withdrawn, s.withdrawn, true);
    list("保留・要確認(掲載していません)", it.held, s.held, true);
    if (!s.published && !s.withdrawn && !s.held) L.push("", "新規掲載・取り下げ・保留は、ありませんでした");
    if (s.errors) L.push("", `⚠ 取得できなかった収集元が ${s.errors} つあります`);
    if (s.inactive) L.push("", `ℹ 規約の確認待ちで、止まっている収集元が ${s.inactive} つあります(data/sources.json の termsChecked)`);
    if (s.held && !dryRun) L.push("", "保留の確認方法は、GitHub の Issue を見てください");
    if (s.autoPublish === false) L.push("", "自動掲載: オフ(すべて保留にしています)");
  }
  L.push("");
  if (siteUrl) L.push(`サイト: ${siteUrl}`);
  if (runUrl) L.push(`実行の詳細: ${runUrl}`);
  L.push("", "--", "このメールは、GitHub Actions の週次の自動更新から、自動で送っています。");
  return { subject, text: L.join("\n") };
}
