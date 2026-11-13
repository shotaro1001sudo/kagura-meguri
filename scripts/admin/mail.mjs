// Gmail(IMAP)から、フォームの通知メール(Web3Forms 経由)を読み込み、申請・問い合わせとして取り出す。
// 編集部のアドレスに直接届いたメール(フォームを通さない問い合わせ・見積もりの依頼など)も、「問い合わせ」として取り出す(2026-11-14 から)
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
// ---------- 編集部のアドレスに直接届いたメール ----------
// 受信箱の「問い合わせ」に出す。次のものは出さない:
//   フォームの通知(別に読み込む)・自分が送ったメール・営業の台帳の相手からのメール(「営業」に返信として出る)・
//   一斉配信やサービスのお知らせ(List-Unsubscribe / List-Id / Precedence: bulk など、送信専用のアドレス)・
//   サイトの運営で使っているサービスの会社からのメール(SERVICE_DOMAINS。認証コード・登録の確認・お知らせなど)・
//   運営者が画面で「この差出人は出さない」にした差出人(.admin/mail-ignore.json)
// 自動返信(受付の確認など)は「完了」で入れる(未対応の数に入れない)。届かなかった通知(mailer-daemon)は、未対応で出す
export const DIRECT_DAYS = 60; // さかのぼって読む日数(はじめて読むときに、古いメールで埋まらないように)
export const DIRECT_TOPICS = { mail: "編集部あてのメール", auto: "自動返信(編集部あてのメール)", bounce: "届かなかったメールの通知" };
const SEND_ONLY = /^(notifications?|notify|newsletter|news|mailer|bounces?|updates?|alerts?|marketing|promo)([._+-]|$)|(^|[._+-])(no[-_.]?reply|do[-_.]?not[-_.]?reply)([._+-]|$)/i; // gmail-noreply@ のように、途中にあるものも
// サイトの運営で使っているサービス(アフィリエイト・解析・フォーム・メール・SNS・ドメインなど)。ここからのメールは、問い合わせではない
export const SERVICE_DOMAINS = ["valuecommerce.ne.jp", "value-point.jp", "goatcounter.com", "google.com", "x.com", "twitter.com", "note.com", "web3forms.com", "improvmx.com", "buffer.com", "bufferapp.com",
  "github.com", "rakuten.co.jp", "rakuten.com", "a8.net", "amazon.co.jp", "amazon.com", "cloudflare.com", "onamae.com", "gmo.jp", "jalan.net", "recruit.co.jp", "facebookmail.com", "instagram.com", "line.me", "microsoft.com", "apple.com"];
const domainIn = (d, list) => list.some((e) => d === e || d.endsWith("." + e));
/** 「出さない差出人」に当たるか。list の項目は、アドレス(a@b.jp)かドメイン(b.jp。下のドメインも含む) */
export const ignoredSender = (from, list = []) => { const a = String(from ?? "").toLowerCase(), d = a.split("@")[1] ?? ""; return list.map((e) => String(e).toLowerCase()).some((e) => (e.includes("@") ? a === e : !!d && (d === e || d.endsWith("." + e)))); };
/** 「出さない」にするときの単位: 独自ドメインならドメインごと、無料のメール(gmail.com など)ならそのアドレスだけ */
export const ignoreKey = (from) => { const a = String(from ?? "").toLowerCase(); return leadDomain(a) || a; };
const BOUNCER = /^(mailer-daemon|postmaster)$/i;
const plainHeaders = (mail) => Object.fromEntries([...(mail.headers ?? new Map())].map(([k, v]) => [String(k).toLowerCase(), typeof v === "string" ? v : v?.value ?? v?.text ?? JSON.stringify(v)]));

/**
 * 解析済みのメールから、直接届いたメールの記録を作る。出さないメールは null。
 * o: { site, self: [自分のアドレス…], leads: [台帳の相手(送信済み以降)…], ignore: [運営者が「出さない」にした差出人…] }
 */
export function toDirectItem(mail, { site, self = [], leads = [], ignore = [] } = {}) {
  const subject = mail.subject ?? "";
  if (classify(subject, site)) return null; // フォームの通知
  const fromAddr = (mail.from?.value?.[0]?.address ?? "").toLowerCase();
  if (!fromAddr || /@web3forms\.com$/i.test(fromAddr)) return null;
  if (self.map((a) => String(a).toLowerCase()).includes(fromAddr)) return null; // 自分が送ったメール(週次の通知など)
  const local = fromAddr.split("@")[0];
  const headers = plainHeaders(mail);
  const bounce = BOUNCER.test(local);
  if (!bounce) {
    if (SEND_ONLY.test(local) || domainIn(fromAddr.split("@")[1] ?? "", SERVICE_DOMAINS) || ignoredSender(fromAddr, ignore)) return null;
    if (headers["list-unsubscribe"] || headers["list-id"] || /bulk|list|junk/i.test(String(headers.precedence ?? ""))) return null;
    if (/auto-generated/i.test(String(headers["auto-submitted"] ?? ""))) return null;
    if (leads.some((x) => fromLead(fromAddr, x))) return null; // 営業の相手からのメールは、「営業」に出る
  }
  const text = String(mail.text ?? "").trim();
  const auto = !bounce && isAutoReply(headers, subject, text);
  const received = (mail.date instanceof Date && !isNaN(mail.date) ? mail.date : new Date()).toISOString();
  const messageId = mail.messageId || `${subject}|${received}`;
  const replyTo = (mail.replyTo?.value?.[0]?.address ?? "").toLowerCase();
  return {
    id: createHash("sha256").update(messageId).digest("hex").slice(0, 16),
    messageId, kind: "contact", direct: true, status: auto ? "done" : "new", ...(auto ? { closedAt: received.slice(0, 10) } : {}),
    received, subject: subject.slice(0, 200),
    sender: mail.from?.value?.[0]?.name || "", email: bounce ? "" : replyTo || fromAddr, from: fromAddr,
    viaForm: false, fields: {}, memo: "",
    topic: DIRECT_TOPICS[bounce ? "bounce" : auto ? "auto" : "mail"], target: "", message: text,
  };
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
 * address(編集部のアドレス)を渡すと、そのアドレスに直接届いたメール(直近 DIRECT_DAYS 日)も、同じ接続で取得する。
 * 直接のメールの読み込みに失敗しても、フォームの分は返す(返す配列の directError に理由を入れる)
 */
export async function fetchFormMails({ user, pass, site, knownIds, address = "", leads = [], ignore = [], host = "imap.gmail.com", port = 993, days = 400, directDays = DIRECT_DAYS }) {
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
      // まず件名と Message-ID だけを見て、未取得のものに絞ってから、本文を取得する
      const fresh = [];
      if (uids.length) for await (const m of client.fetch(uids, { envelope: true }, { uid: true })) {
        if (!classify(m.envelope?.subject, site)) continue;
        const mid = m.envelope?.messageId;
        if (mid && knownIds.has(mid)) continue;
        fresh.push(m.uid);
      }
      if (fresh.length) for await (const m of client.fetch(fresh, { source: true }, { uid: true })) {
        const item = toItem(await simpleParser(m.source), site);
        if (item && !knownIds.has(item.messageId)) items.push(item);
      }
      // 編集部のアドレスに直接届いたメール(宛先か Cc が編集部のアドレス)
      if (address) {
        try {
          const dSince = new Date(Date.now() - directDays * 864e5);
          const dUids = (await client.search({ or: [{ to: address }, { cc: address }], since: dSince }, { uid: true })) || [];
          const self = [user, address], dFresh = [];
          if (dUids.length) for await (const m of client.fetch(dUids, { envelope: true }, { uid: true })) {
            const env = m.envelope ?? {}, from = (env.from?.[0]?.address ?? "").toLowerCase();
            if (classify(env.subject, site) || self.map((a) => a.toLowerCase()).includes(from) || (env.messageId && knownIds.has(env.messageId))) continue;
            dFresh.push(m.uid);
          }
          if (dFresh.length) for await (const m of client.fetch(dFresh, { source: true }, { uid: true })) {
            const item = toDirectItem(await simpleParser(m.source), { site, self, leads, ignore });
            if (item && !knownIds.has(item.messageId) && !items.some((x) => x.messageId === item.messageId)) items.push(item);
          }
        } catch (err) { items.directError = err.code || err.message || String(err); }
      }
    } finally { lock.release(); }
  } finally { await client.logout().catch(() => {}); }
  return items;
}
