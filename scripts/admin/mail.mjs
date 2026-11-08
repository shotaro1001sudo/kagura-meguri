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

// 返信の差出人を、相手のアドレスそのものか、同じドメイン(独自ドメインのときだけ)で見分ける。無料のメールのドメインは、別人の可能性が高いので使わない
const FREE_MAIL = /^(gmail\.com|googlemail\.com|yahoo\.co\.jp|ymail\.ne\.jp|outlook\.(com|jp)|hotmail\.(com|co\.jp)|live\.(jp|com)|icloud\.com|me\.com|docomo\.ne\.jp|ezweb\.ne\.jp|au\.com|softbank\.ne\.jp|i\.softbank\.jp|nifty\.com|biglobe\.ne\.jp|ocn\.ne\.jp|so-net\.ne\.jp|excite\.co\.jp|aol\.com)$/i;
export const leadDomain = (email) => { const d = String(email ?? "").toLowerCase().split("@")[1] ?? ""; return d && !FREE_MAIL.test(d) ? d : ""; };
// フォームで送った相手は、メールアドレスが分からないので、公式サイトのドメインから届いたメールを返信とみなす。
// 誰でも使えるサービス(ブログ・SNS・ホームページ作成サービス)のドメインは使わない
const SHARED_HOST = /(^|.)(facebook.com|instagram.com|x.com|twitter.com|ameblo.jp|ameba.jp|fc2.com|jimdofree.com|jimdo.com|wixsite.com|wix.com|wordpress.com|hatenablog.(com|jp)|note.com|google.com|sites.google.com|peraichi.com|goope.jp|livedoor.(jp|com|blog)|seesaa.net|blogspot.com|youtube.com|line.me|lin.ee|tiktok.com|studio.site|webnode.jp|crayonsite.(com|net)|shopinfo.jp|digibook.net|com.jp)$/i;
export const siteDomain = (url) => {
  let host = "";
  try { host = new URL(url).hostname.toLowerCase().replace(/^www./, ""); } catch { return ""; }
  return host && host.includes(".") && !SHARED_HOST.test(host) && !FREE_MAIL.test(host) ? host : "";
};
// 差出人のドメインが、公式サイトのドメインと同じか、その親(ラベルが3つ以上。例 kanko.city.x.lg.jp → city.x.lg.jp)か
export const sameOrg = (fromDomain, host) => !!fromDomain && !!host && (fromDomain === host || (host.endsWith("." + fromDomain) && fromDomain.split(".").length >= 3) || (fromDomain.endsWith("." + host) && host.split(".").length >= 2));
/** 相手からのメールか(アドレスそのもの / 独自ドメインのメール / 公式サイトのドメイン) */
export function fromLead(from, lead) {
  const a = String(from ?? "").toLowerCase(), d = a.split("@")[1] ?? "";
  if (!d) return false;
  if (lead.email && a === lead.email.toLowerCase()) return true;
  const ed = leadDomain(lead.email);
  if (ed && (d === ed || d.endsWith("." + ed))) return true;
  return [lead.url, lead.formUrl].map(siteDomain).some((h) => sameOrg(d, h));
}
/** 自動返信(不在のお知らせ・受付の自動送信)か */
export function isAutoReply(headers = {}, subject = "", text = "") {
  const h = (k) => String(headers[k] ?? "").toLowerCase();
  if (h("auto-submitted") && h("auto-submitted") !== "no") return true;
  if (h("x-autoreply") || h("x-autorespond") || /auto_reply|auto-reply/.test(h("x-auto-response-suppress") + h("precedence"))) return true;
  if (/自動返信|自動応答|自動送信|不在|out of office|auto(matic)? ?reply|autoreply/i.test(subject)) return true;
  // フォームの受付の確認(見出しに「自動」と書かれないものが多い)。本文の始めのほうだけを見る(返信の引用で誤らないように)
  const head = String(text).slice(0, 400);
  return /(下記|以下)の?(送信|お問い?合わせ|お申し?込み|ご連絡)?内容(にて|で)受け?付|受付(いた)?しました|受け付けました|このメールは(送信専用|自動)|自動(的に)?(送信|配信)され|改めて担当(者)?(より|から)/.test(head);
}
/**
 * Gmail から、営業の相手(台帳の email)が送ってきたメールを探す。相手ごとに、最初に送った日より後の分だけ。
 * leads: [{ id, email, sentAt }]。返すのは [{ leadId, messageId, date, from, subject, snippet, auto }](本文は先頭の 300 字だけ)
 */
export async function fetchLeadReplies({ user, pass, leads, knownIds = new Set(), host = "imap.gmail.com", port = 993 }) {
  const targets = leads.filter((x) => x.sentAt && (x.email || siteDomain(x.url) || siteDomain(x.formUrl)));
  if (!targets.length) return [];
  const { ImapFlow } = await import("imapflow");
  const { simpleParser } = await import("mailparser");
  const client = new ImapFlow({ host, port, secure: true, auth: { user, pass }, logger: false });
  await client.connect();
  const out = [];
  try {
    const boxes = await client.list();
    const all = boxes.find((b) => b.specialUse === "\\All")?.path ?? "INBOX";
    const lock = await client.getMailboxLock(all, { readOnly: true });
    try {
      for (const x of targets) {
        const since = new Date(Date.parse(x.sentAt + "T00:00:00+09:00"));
        // 探す言葉: メールアドレス(独自ドメインならドメイン)と、公式サイトのドメインの末尾3つ(親のドメインからのメールも拾う)
        const terms = new Set();
        if (x.email) terms.add(leadDomain(x.email) ? "@" + leadDomain(x.email) : x.email);
        for (const hst of [siteDomain(x.url), siteDomain(x.formUrl)].filter(Boolean)) terms.add(hst.split(".").slice(-3).join("."));
        const uidSet = new Set();
        for (const t of terms) for (const u of (await client.search({ from: t, since }, { uid: true })) || []) uidSet.add(u);
        const uids = [...uidSet];
        if (!uids.length) continue;
        const fresh = [];
        for await (const m of client.fetch(uids, { envelope: true }, { uid: true })) {
          const mid = m.envelope?.messageId;
          if (mid && knownIds.has(mid)) continue;
          fresh.push(m.uid);
        }
        if (!fresh.length) continue;
        for await (const m of client.fetch(fresh, { source: true }, { uid: true })) {
          const p = await simpleParser(m.source);
          const from = p.from?.value?.[0]?.address?.toLowerCase() ?? "";
          if (!fromLead(from, x) || from === user.toLowerCase()) continue;
          const headers = Object.fromEntries([...(p.headers ?? new Map())].map(([k, v]) => [k, typeof v === "string" ? v : v?.value ?? JSON.stringify(v)]));
          out.push({ leadId: x.id, messageId: p.messageId ?? `uid-${m.uid}`, date: (p.date ?? new Date()).toISOString(), from, subject: (p.subject ?? "").slice(0, 200),
            snippet: String(p.text ?? "").replace(/\s+/g, " ").trim().slice(0, 300), auto: isAutoReply(headers, p.subject ?? "", p.text ?? "") });
        }
      }
    } finally { lock.release(); }
  } finally { await client.logout().catch(() => {}); }
  return out;
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
