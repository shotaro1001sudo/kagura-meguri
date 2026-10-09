// 週次の自動更新が終わったら、結果を、運営者へメールで送る: node scripts/notify-mail.mjs
//
// 設定(GitHub の Secrets に入れる。リポジトリのファイルには、書かない):
//   MAIL_USERNAME … 送信に使うメールアカウント(例: Gmail のアドレス)
//   MAIL_PASSWORD … そのアカウントのアプリパスワード(通常のパスワードではない)
//   MAIL_TO       … 送り先(カンマ区切りで、複数も可)
//   MAIL_SMTP_HOST / MAIL_SMTP_PORT … 省略時は Gmail(smtp.gmail.com:465)
// MAIL_USERNAME・MAIL_PASSWORD・MAIL_TO のどれかが空なら、何も送らずに終わる。
//
// ワークフローから渡す状態: JOB_STATUS(success/failure/cancelled)/ DRY_RUN / CHANGED / DEPLOY_RESULT / RUN_URL
// テスト用の切り替え: SUMMARY_FILE / NOTIFY_NOW(MAIL_SMTP_HOST が localhost のときだけ、暗号化なしで送る)
import { readFileSync, existsSync } from "node:fs";
import { pathToFileURL } from "node:url";
import nodemailer from "nodemailer";
import { buildMessage } from "./lib/notify-message.mjs";

const EMAIL = /^[^\s@<>",]+@[^\s@<>",]+\.[^\s@<>",]+$/;
const jstToday = (now) => new Date(now.getTime() + 9 * 3600e3).toISOString().slice(0, 10);
const readJson = (p) => JSON.parse(readFileSync(p, "utf8").replace(/^﻿/, ""));

/** 送信の設定を作る。誤りがあれば投げる(パスワードは、決して出力しない) */
export function transportOptions({ host = "smtp.gmail.com", port = 465, user, pass }) {
  const local = /^(127\.0\.0\.1|localhost)$/.test(host);
  const p = Number(port);
  if (!Number.isInteger(p) || p <= 0 || p > 65535) throw new Error("MAIL_SMTP_PORT が不正です");
  return {
    host, port: p, auth: { user, pass },
    secure: !local && p === 465,          // 465: 最初から暗号化
    requireTLS: !local && p !== 465,      // 587 など: STARTTLS を必須にする(暗号化なしでは送らない)
    ignoreTLS: local,                     // テスト用の手元のサーバーだけ、暗号化なし
    connectionTimeout: 15000, greetingTimeout: 15000, socketTimeout: 30000,
  };
}

export async function sendMail({ options, from, to, subject, text, retries = 1 }) {
  const t = nodemailer.createTransport(options);
  let last;
  for (let i = 0; i <= retries; i++) {
    try { return await t.sendMail({ from, to, subject, text }); }
    catch (err) {
      last = err;
      // 再送するのは、一時的なエラー(4xx の応答・通信の失敗)だけ。認証・宛先の誤り(5xx)は、再送しても直らない
      const temporary = (err.responseCode >= 400 && err.responseCode < 500) || (!err.responseCode && err.code !== "EAUTH" && err.code !== "EENVELOPE");
      if (!temporary) break;
    }
  }
  throw new Error(`メールの送信に失敗しました: ${last.code ?? ""} ${String(last.response ?? last.message).slice(0, 300)}`);
}

async function main() {
  const user = (process.env.MAIL_USERNAME ?? "").trim();
  const pass = (process.env.MAIL_PASSWORD ?? "").replace(/\s+/g, ""); // Google のアプリパスワードは、空白区切りで表示される
  const to = (process.env.MAIL_TO ?? "").split(",").map((x) => x.trim()).filter(Boolean);
  if (!user || !pass || !to.length) { console.log("メールの設定(MAIL_USERNAME / MAIL_PASSWORD / MAIL_TO)がないため、送信しません"); return; }
  if (!EMAIL.test(user) || !to.every((x) => EMAIL.test(x))) throw new Error("MAIL_USERNAME・MAIL_TO は、メールアドレスの形式で入れてください");

  const cfg = existsSync("config.json") ? readJson("config.json") : {};
  const now = process.env.NOTIFY_NOW ? new Date(process.env.NOTIFY_NOW) : new Date();
  const file = process.env.SUMMARY_FILE ?? "data/collect-summary.json";
  let summary = existsSync(file) ? readJson(file) : null;
  // 収集の前に止まったときは、前回(リポジトリに残っている)の結果を、今回のものとして送らない
  if (summary && summary.date !== jstToday(now)) summary = null;
  const siteName = cfg.siteName ?? "神楽めぐり";
  const { subject, text } = buildMessage({
    summary, jobStatus: process.env.JOB_STATUS || "success", dryRun: process.env.DRY_RUN === "true", changed: process.env.CHANGED === "true",
    deployResult: process.env.DEPLOY_RESULT ?? "", siteUrl: cfg.baseUrl ? `${cfg.baseUrl}/` : "", runUrl: process.env.RUN_URL ?? "", siteName, date: jstToday(now),
  });
  const options = transportOptions({ host: process.env.MAIL_SMTP_HOST || undefined, port: process.env.MAIL_SMTP_PORT || 465, user, pass });
  await sendMail({ options, from: { name: `${siteName} 自動更新`, address: user }, to, subject, text });
  console.log(`メールを送信しました(${to.length}件の宛先)\n件名: ${subject}\n\n${text}`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main().catch((err) => { console.error(err.message); process.exit(1); });
}
