// 週次の自動更新が終わったら、結果を、運営者のLINEへ送る: node scripts/notify-line.mjs
//
// LINE Messaging API の push message を使う(LINE Notify は 2025年3月に終了)。
// 設定(GitHub の Secrets に入れる。リポジトリには、書かない):
//   LINE_CHANNEL_ACCESS_TOKEN … チャネルアクセストークン(長期)
//   LINE_TO                   … 送り先(あなたのユーザーID。U から始まる33文字)
// どちらかが空なら、何も送らずに終わる(通知を使わない運用も、できる)。
//
// ワークフローから渡す状態: JOB_STATUS(success/failure/cancelled)/ DRY_RUN / CHANGED / DEPLOY_RESULT / RUN_URL
// 送るのは、公開サイトに載せる事実(名称・日付・場所)と件数だけ。訪問者の情報は、送らない。
// テスト用の切り替え: SUMMARY_FILE / NOTIFY_NOW / LINE_API_URL(テスト用。localhost だけ受け付ける)
import { readFileSync, existsSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { pathToFileURL } from "node:url";

export const LINE_PUSH_URL = "https://api.line.me/v2/bot/message/push";
export const MAX_TEXT = 5000;          // LINE のテキストメッセージの上限
const MAX_ITEMS = 8;                   // 1つの見出しに並べる件数の上限(残りは「ほか N 件」)
const WEEK = "日月火水木金土";

const jstToday = (now) => new Date(now.getTime() + 9 * 3600e3).toISOString().slice(0, 10);
/** "2026-11-23T19:00" → "11/23(月)" */
export function shortDate(start) {
  const d = String(start ?? "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return "日付不明";
  const w = WEEK[new Date(`${d}T00:00:00Z`).getUTCDay()];
  return `${Number(d.slice(5, 7))}/${Number(d.slice(8, 10))}(${w})`;
}

/** 送る文面を作る(純粋な関数。テストしやすくするため、通信と分けている) */
export function buildMessage({ summary, jobStatus = "success", dryRun = false, changed = false, deployResult = "", siteUrl = "", runUrl = "", siteName = "神楽めぐり", date = "" }) {
  const s = summary ?? null;
  const L = [`【${siteName}】週次の自動更新(${s?.date ?? date})`];

  // --- 結果のひとこと ---
  if (jobStatus === "cancelled") L.push("⏹ 途中で止まりました(時間切れ・手動の停止)。" + (changed ? "データの反映は済んでいます。詳細を確認してください" : "何も公開されていません"));
  else if (jobStatus !== "success") L.push(changed ? "❌ 途中でエラーが出ました。データの反映は済んでいるため、詳細を確認してください" : "❌ 自動更新が失敗しました。何も公開されていません(テストに通らないデータは、公開されない仕組みです)");
  else if (dryRun) L.push("🧪 試運転です(反映も公開もしていません)");
  else if (!changed) L.push("➖ 変更はありませんでした(公開サイトは、そのままです)");
  else if (deployResult === "success") L.push("✅ 公開サイトを更新しました");
  else if (deployResult === "failure") L.push("⚠ データは反映しましたが、公開サイトの更新に失敗しました。詳細を確認してください");
  else L.push("🔄 公開サイトの更新を開始しました(完了は確認できていません)");

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
      }
      if (n > Math.min(arr.length, MAX_ITEMS)) L.push(`・ほか ${n - Math.min(arr.length, MAX_ITEMS)} 件`);
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
  if (siteUrl) L.push("", `サイト: ${siteUrl}`);
  if (runUrl) L.push(`詳細: ${runUrl}`);

  let text = L.join("\n");
  if (text.length > MAX_TEXT) text = text.slice(0, MAX_TEXT - 40) + "\n…(長いため省略。詳細はリンク先)";
  return text;
}

/** LINE へ送る。成功で true。失敗時は、理由を投げる(トークンは、決して出力しない) */
export async function pushLine({ token, to, text, url = LINE_PUSH_URL, retries = 1 }) {
  const retryKey = randomUUID(); // 再送しても、二重に届かないようにする
  let last = "";
  for (let i = 0; i <= retries; i++) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${token}`, "x-line-retry-key": retryKey },
        body: JSON.stringify({ to, messages: [{ type: "text", text }] }),
        signal: AbortSignal.timeout(15000),
      });
      if (res.ok) return true;
      if (res.status === 409) return true; // 同じ再送キーで、すでに受け付け済み
      const body = (await res.text()).slice(0, 300);
      last = `HTTP ${res.status} ${body}`;
      if (res.status < 500 && res.status !== 429) break; // 設定の誤り(トークン・送り先)は、再送しても直らない
    } catch (err) { last = err.message; }
  }
  throw new Error(`LINE への送信に失敗しました: ${last}`);
}

async function main() {
  const token = (process.env.LINE_CHANNEL_ACCESS_TOKEN ?? "").trim();
  const to = (process.env.LINE_TO ?? "").trim();
  if (!token || !to) { console.log("LINE の設定(LINE_CHANNEL_ACCESS_TOKEN / LINE_TO)がないため、送信しません"); return; }
  if (!/^U[0-9a-f]{32}$/.test(to)) throw new Error("LINE_TO の形式が違います(U から始まる33文字のユーザーIDを入れてください)");
  let url = LINE_PUSH_URL;
  if (process.env.LINE_API_URL) {
    // テスト用。外部の宛先へ、トークンを送らないよう、手元のサーバーだけ許す
    if (!/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?\//.test(process.env.LINE_API_URL)) throw new Error("LINE_API_URL は、テスト用(localhost)だけ指定できます");
    url = process.env.LINE_API_URL;
  }
  const cfg = existsSync("config.json") ? JSON.parse(readFileSync("config.json", "utf8").replace(/^﻿/, "")) : {};
  const now = process.env.NOTIFY_NOW ? new Date(process.env.NOTIFY_NOW) : new Date();
  const file = process.env.SUMMARY_FILE ?? "data/collect-summary.json";
  let summary = existsSync(file) ? JSON.parse(readFileSync(file, "utf8").replace(/^﻿/, "")) : null;
  // 収集の前に止まったときは、前回(リポジトリに残っている)の結果を、今回のものとして送らない
  if (summary && summary.date !== jstToday(now)) summary = null;
  const text = buildMessage({
    summary, jobStatus: process.env.JOB_STATUS || "success", dryRun: process.env.DRY_RUN === "true", changed: process.env.CHANGED === "true",
    deployResult: process.env.DEPLOY_RESULT ?? "", siteUrl: cfg.baseUrl ? `${cfg.baseUrl}/` : "", runUrl: process.env.RUN_URL ?? "", siteName: cfg.siteName, date: jstToday(now),
  });
  await pushLine({ token, to, text, url });
  console.log("LINE に送信しました:\n" + text);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main().catch((err) => { console.error(err.message); process.exit(1); });
}
