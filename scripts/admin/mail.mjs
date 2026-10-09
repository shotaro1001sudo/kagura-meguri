// Gmail(IMAP)から、フォームの通知メール(Web3Forms 経由)を読み込み、申請・問い合わせとして取り出す
import { createHash } from "node:crypto";

// フォームの項目名(ラベル) → 開催データの項目
const SUBMIT_LABELS = { "神楽・イベントの名称": "name", "神楽の種類": "kagura", "都道府県": "prefecture", "市区町村": "city", "会場名": "venue",
  "番地までの住所": "address", "開催日": "date", "開始時刻": "time_start", "終了時刻": "time_end", "料金": "fee", "公式情報のURL": "url", "ひとこと説明": "description" };

/** 件名から種類を判定する。返信(Re:)や、週次の通知など、フォーム以外のメールは null */
export function classify(subject = "", site) {
  const s = subject.trim();
  if (s.startsWith(`【${site}】開催情報の掲載依頼`)) return "submit";
  if (s.startsWith(`【${site}】お問い合わせ`)) return "contact";
  return null;
}

/** 「■項目名: 値」の行を読む(値が複数行のときは、次の「■」まで続く) */
export function readFields(text) {
  const fields = {};
  let key = null;
  for (const line of text.replace(/\r/g, "").split("\n")) {
    const m = line.match(/^\s*■([^:：]+)[:：]\s?(.*)$/);
    if (m) { key = m[1].trim(); fields[key] = m[2]; continue; }
    if (line.includes("【events.json 用】")) { key = null; continue; }
    if (key && line.trim()) fields[key] += "\n" + line;
  }
  for (const k of Object.keys(fields)) fields[k] = fields[k].trim();
  return fields;
}

/** 「【events.json 用】」の JSON を取り出す(メールの折り返しで、文字列の中に入った改行は、空白に戻す) */
export function readJsonBlock(text) {
  const at = text.indexOf("【events.json 用】");
  if (at < 0) return null;
  const from = text.indexOf("{", at);
  if (from < 0) return null;
  let depth = 0, inStr = false, esc = false, out = "";
  for (let i = from; i < text.length; i++) {
    let c = text[i];
    if (inStr) {
      if (esc) esc = false; else if (c === "\\") esc = true; else if (c === '"') inStr = false; else if (c === "\r") continue; else if (c === "\n") c = " ";
    } else if (c === '"') inStr = true; else if (c === "{") depth++; else if (c === "}") depth--;
    out += c;
    if (!inStr && depth === 0) { try { const o = JSON.parse(out); return o && typeof o === "object" && !Array.isArray(o) ? o : null; } catch { return null; } }
  }
  return null;
}

/** 申請の内容を、開催データの下書きにする(JSON を優先し、なければ項目の行から) */
export function draftFrom(fields, json) {
  const f = Object.fromEntries(Object.entries(SUBMIT_LABELS).map(([label, k]) => [k, fields[label] ?? ""]));
  const date = f.date.match(/^\d{4}-\d{2}-\d{2}$/) ? f.date : "";
  const base = {
    name: f.name, kagura: f.kagura, prefecture: f.prefecture, city: f.city, venue: f.venue, address: f.address,
    start: date ? `${date}T${f.time_start || "00:00"}` : "", end: date && f.time_end ? `${date}T${f.time_end}` : "",
    timeUnknown: !!date && !f.time_start, fee: f.fee, url: f.url, description: f.description,
  };
  if (json) for (const k of Object.keys(base)) {
    if (k === "timeUnknown") base.timeUnknown = json.timeUnknown === true;
    else if (typeof json[k] === "string" && json[k]) base[k] = json[k];
  }
  return base;
}

const first = (fields, ...keys) => keys.map((k) => fields[k]).find((v) => v) ?? "";

/** 解析済みのメール(mailparser の結果の形)から、管理用の記録を作る */
export function toItem(mail, site) {
  const subject = mail.subject ?? "";
  const kind = classify(subject, site);
  if (!kind) return null;
  const text = mail.text ?? "";
  const fields = readFields(text);
  const replyTo = mail.replyTo?.value?.[0]?.address ?? "";
  const fromAddr = mail.from?.value?.[0]?.address ?? "";
  const messageId = mail.messageId || `${subject}|${mail.date?.toISOString?.() ?? ""}`;
  const item = {
    id: createHash("sha256").update(messageId).digest("hex").slice(0, 16),
    messageId, kind, status: "new",
    received: (mail.date instanceof Date && !isNaN(mail.date) ? mail.date : new Date()).toISOString(),
    subject,
    sender: first(fields, "お名前または団体名", "お名前") || mail.from?.value?.[0]?.name || "",
    email: replyTo || first(fields, "ご連絡先のメールアドレス", "メールアドレス"),
    // フォームの通知は Web3Forms から届く。それ以外から届いた同じ件名のメールは、なりすましの可能性があるので、画面で注意を出す
    viaForm: /@web3forms\.com$/i.test(fromAddr),
    fields, memo: "",
  };
  if (kind === "submit") item.draft = draftFrom(fields, readJsonBlock(text));
  else { item.topic = fields["ご用件"] ?? ""; item.target = fields["対象のページのURL"] ?? ""; item.message = fields["内容"] ?? text.trim(); }
  return item;
}

/**
 * Gmail から、まだ読み込んでいないフォームの通知メールを取得する。
 * 「すべてのメール」を探すので、受信トレイから移動・アーカイブしたメールも対象。直近 400 日分。
 */
export async function fetchFormMails({ user, pass, site, knownIds, host = "imap.gmail.com", port = 993, days = 400 }) {
  const { ImapFlow } = await import("imapflow");
  const { simpleParser } = await import("mailparser");
  const client = new ImapFlow({ host, port, secure: true, auth: { user, pass }, logger: false });
  await client.connect();
  const items = [];
  try {
    const boxes = await client.list();
    const all = boxes.find((b) => b.specialUse === "\\All")?.path ?? "INBOX";
    const lock = await client.getMailboxLock(all, { readOnly: true });
    try {
      const since = new Date(Date.now() - days * 864e5);
      const uids = (await client.search({ subject: `【${site}】`, since }, { uid: true })) || [];
      if (!uids.length) return items;
      // まず件名と Message-ID だけを見て、未取得のものに絞ってから、本文を取得する
      const fresh = [];
      for await (const m of client.fetch(uids, { envelope: true }, { uid: true })) {
        if (!classify(m.envelope?.subject, site)) continue;
        const mid = m.envelope?.messageId;
        if (mid && knownIds.has(mid)) continue;
        fresh.push(m.uid);
      }
      if (!fresh.length) return items;
      for await (const m of client.fetch(fresh, { source: true }, { uid: true })) {
        const item = toItem(await simpleParser(m.source), site);
        if (item && !knownIds.has(item.messageId)) items.push(item);
      }
    } finally { lock.release(); }
  } finally { await client.logout().catch(() => {}); }
  return items;
}
