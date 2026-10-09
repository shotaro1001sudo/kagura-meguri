// 管理者用ページのデータ: 開催(data/events.json)と、Gmail から読み込んだ申請・問い合わせ(.admin/inbox.json)
// .admin/ と admin.local.json は、投稿者の名前・メールアドレスやパスワードを含むため、Git には入れない(.gitignore)。
import { readFileSync, writeFileSync, existsSync, mkdirSync, renameSync } from "node:fs";
import { join } from "node:path";
import { PREFECTURES } from "../lib/util.mjs";

const readJson = (p, d) => (existsSync(p) ? JSON.parse(readFileSync(p, "utf8").replace(/^﻿/, "")) : d);
// 書き込み途中で止まっても、元のファイルが壊れないように、別名で書いてから置き換える
const writeJson = (p, v) => { writeFileSync(p + ".tmp", JSON.stringify(v, null, 2)); renameSync(p + ".tmp", p); };

export const paths = (root) => ({
  events: join(root, "data/events.json"),
  dir: join(root, ".admin"),
  inbox: join(root, ".admin/inbox.json"),
  local: join(root, "admin.local.json"),
  config: join(root, "config.json"),
});

export const loadEvents = (root) => readJson(paths(root).events, []);
export const saveEvents = (root, events) => writeJson(paths(root).events, events);
export const loadConfig = (root) => readJson(paths(root).config, {});
export const loadLocal = (root) => readJson(paths(root).local, {});
export function loadInbox(root) { const b = readJson(paths(root).inbox, {}); return { items: b.items ?? [], lastFetch: b.lastFetch ?? null }; }
export function saveInbox(root, box) { const p = paths(root); if (!existsSync(p.dir)) mkdirSync(p.dir, { recursive: true }); writeJson(p.inbox, box); }

// 申請・問い合わせの状態。「完了・掲載済み・却下」は、対応が終わった状態(closedAt を付ける)
export const INBOX_STATUS = { new: "未対応", doing: "対応中", done: "完了", published: "掲載済み", rejected: "却下" };
const CLOSED = new Set(["done", "published", "rejected"]);
export function setInboxStatus(item, status, today) {
  if (!INBOX_STATUS[status]) throw new Error(`不明な状態: ${status}`);
  item.status = status;
  if (CLOSED.has(status)) item.closedAt ??= today; else delete item.closedAt;
}

// プライバシーポリシーの保存期間(対応完了から12か月を目安)を過ぎた記録を消す
export function pruneInbox(box, today) {
  const limit = new Date(`${today}T00:00:00Z`); limit.setUTCFullYear(limit.getUTCFullYear() - 1);
  const cut = limit.toISOString().slice(0, 10);
  const before = box.items.length;
  box.items = box.items.filter((x) => !(x.closedAt && x.closedAt < cut));
  return before - box.items.length;
}

const DT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;
export const ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const LIMITS = { name: 80, kagura: 40, city: 40, venue: 80, address: 100, fee: 80, url: 300, description: 300, source: 80 };

/** 開催データの確認。問題のある項目名と理由を返す(空なら OK) */
export function validateEvent(e, events, originalId = null) {
  const errs = {};
  if (!ID.test(e.id ?? "")) errs.id = "英小文字・数字と、ハイフン(-)だけで入力してください";
  else if (e.id !== originalId && events.some((x) => x.id === e.id)) errs.id = "同じIDの開催が、すでにあります";
  for (const k of ["name", "kagura", "city", "venue", "source"]) if (!String(e[k] ?? "").trim()) errs[k] = "入力してください";
  if (!PREFECTURES.includes(e.prefecture)) errs.prefecture = "都道府県を選んでください";
  if (!DT.test(e.start ?? "")) errs.start = "開催日を入力してください";
  if (e.end && !DT.test(e.end)) errs.end = "終了の日時の形式が正しくありません";
  else if (e.end && e.end < e.start) errs.end = "終了は、開始より後にしてください";
  if (e.url && !/^https:\/\/[^\s]+$/.test(e.url)) errs.url = "https:// で始まるURLを入力してください";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(e.checked ?? "")) errs.checked = "確認日を入力してください";
  for (const [k, n] of Object.entries(LIMITS)) if (String(e[k] ?? "").length > n) errs[k] = `${n}字以内にしてください`;
  return errs;
}

// 画面から受け取った項目だけを取り込む(それ以外の項目は、元のデータのまま残す)
const FIELDS = ["id", "name", "kagura", "prefecture", "city", "venue", "address", "start", "end", "timeUnknown", "fee", "url", "description", "source", "checked"];
const PLACE = ["prefecture", "city", "venue", "address"];
export function cleanEvent(input) {
  const e = {};
  for (const k of FIELDS) {
    const v = input[k];
    if (k === "timeUnknown") { if (v === true) e.timeUnknown = true; continue; }
    const s = typeof v === "string" ? v.trim() : "";
    if (s || k === "fee") e[k] = s;
  }
  if (e.timeUnknown && e.start) e.start = `${e.start.slice(0, 10)}T00:00`;
  return e;
}

/**
 * 開催を追加・更新する。originalId が null なら追加。
 * 場所が変わったら、緯度経度を消す(保存後の位置の取得で、付け直す)。
 */
export function upsertEvent(events, input, originalId, status) {
  const e = cleanEvent(input);
  const errs = validateEvent(e, events, originalId);
  if (Object.keys(errs).length) return { errs };
  const i = originalId ? events.findIndex((x) => x.id === originalId) : -1;
  if (originalId && i < 0) return { errs: { id: "元の開催が見つかりません(ほかで消された可能性があります)" } };
  const prev = i >= 0 ? events[i] : {};
  const next = { ...prev };
  for (const k of FIELDS) { if (k in e) next[k] = e[k]; else delete next[k]; }
  next.status = status ?? prev.status ?? "published";
  if (PLACE.some((k) => (prev[k] ?? "") !== (next[k] ?? ""))) { delete next.lat; delete next.lng; delete next.geoPrecision; }
  // 項目の並びを、既存のデータにそろえる(差分を読みやすくする)
  const order = [...FIELDS.filter((k) => k !== "timeUnknown").slice(0, 9), "timeUnknown", "fee", "url", "description", "source", "checked", "status"];
  const sorted = Object.fromEntries([...order.filter((k) => k in next).map((k) => [k, next[k]]), ...Object.entries(next).filter(([k]) => !order.includes(k))]);
  if (i >= 0) events[i] = sorted; else events.push(sorted);
  return { event: sorted };
}

/** 申請の内容から、ID の候補を作る(日付+連番。画面で書き換えられる) */
export function suggestId(draft, events) {
  const base = `ev-${(draft.start || "").slice(0, 10).replace(/-/g, "") || "new"}`;
  let id = base, n = 2;
  while (events.some((x) => x.id === id)) id = `${base}-${n++}`;
  return id;
}
