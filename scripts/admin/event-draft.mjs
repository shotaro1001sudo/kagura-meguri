// 開催の説明(data/events.json の description = 開催ページの冒頭の概要)の下書き。
// 申請から掲載した開催などで説明がないものは、予定タスク(kagurameguri-kagura-drafts)が公式の情報から、ほかの開催と同じ書き方で下書きを書く。
// 料金・終了時刻・予約の要否が「未確認」のままで、公式の情報に書いてあれば、それも下書きに入れる(すでに入っている値は変えない)。
// 運営者が管理者用ページの「やること」で読んで「公開する」を押したときだけ、events.json に入れてサイトに出す。
// 下書きは .admin/event-drafts.json(このPCだけ。確かめる前の文を、公開のリポジトリに出さない)。
// (2026-11-18 運営者の依頼「掲載依頼で掲載した神楽も、ほかの神楽と同じようなフォーマットで概要とかを記載できるように」)
//
// 予定タスクの使い方:
//   node scripts/admin/event-draft.mjs due          … 1行目が「skip: …」なら何もしない。「due: …」なら、続く開催の下書きを書く
//   node scripts/admin/event-draft.mjs show         … 下書きが要る開催(公式の URL・出典・未確認の項目)、作り直しの理由
//   node scripts/admin/event-draft.mjs examples     … 書き方の手本(同じ神楽の種類・同じ県の、ほかの開催の説明)
//   node scripts/admin/event-draft.mjs put <file>   … { "開催のID": { "description": "…", "fee"?, "end"?, "reservationStatus"?, "refs": [...], "note": "…" } } を確かめて、下書きに入れる
import { readFileSync, writeFileSync, existsSync, mkdirSync, renameSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadEvents, saveEvents, paths } from "./store.mjs";
import { reservationLabel } from "../lib/reservation.mjs";

const readJson = (f, fallback) => (existsSync(f) ? JSON.parse(readFileSync(f, "utf8").replace(/^﻿/, "")) : fallback);
const writeJson = (f, v) => { writeFileSync(f + ".tmp", JSON.stringify(v, null, 2)); renameSync(f + ".tmp", f); };

export const eventDraftsPath = (root) => join(root, ".admin/event-drafts.json");
export const loadEventDrafts = (root) => readJson(eventDraftsPath(root), {});
export function saveEventDrafts(root, drafts) { const dir = join(root, ".admin"); if (!existsSync(dir)) mkdirSync(dir, { recursive: true }); writeJson(eventDraftsPath(root), drafts); }

const str = (v) => typeof v === "string" && v.trim().length > 0;
const DT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;
export const RESERVATION = { required: "事前予約が必要", recommended: "事前予約を推奨", not_required: "事前申込不要" };
/** 開催ページで「未確認」と出る項目(下書きで埋めてよいもの) */
const unknowns = (e) => ({ fee: !str(e.fee), end: !e.end && !e.timeUnknown, reservationStatus: reservationLabel(e) === "要確認" });

/**
 * 説明のない、掲載中の開催と、その下書きの状態(draft: 確かめ待ち / redo: 作り直しを頼んだ / なし: 予定タスクが書くのを待っている)。
 * 申請・管理者用ページから載せた開催だけ(週次の自動収集の開催 auto は、取得元に説明がないことがあり、数も多いので対象にしない)
 */
export function eventGaps(root) {
  const drafts = loadEventDrafts(root);
  return loadEvents(root).filter((e) => e.status === "published" && !e.auto && !str(e.description)).map((e) => ({
    id: e.id, name: e.name, kagura: e.kagura ?? "", prefecture: e.prefecture, city: e.city ?? "", venue: e.venue ?? "", address: e.address ?? "",
    start: e.start, end: e.end ?? "", fee: e.fee ?? "", reservation: reservationLabel(e), url: e.url ?? "", source: e.source ?? "",
    unknown: unknowns(e), draft: drafts[e.id] ?? null,
  }));
}

/** 書き方の手本: 同じ神楽の種類、なければ同じ県の、手で書いた説明(新しい順に3つまで) */
export function examplesFor(root, id) {
  const events = loadEvents(root), e = events.find((x) => x.id === id);
  if (!e) return [];
  const pool = events.filter((x) => x.id !== id && x.status === "published" && !x.auto && str(x.description)).sort((a, b) => b.start.localeCompare(a.start));
  const pick = [...pool.filter((x) => x.kagura === e.kagura), ...pool.filter((x) => x.kagura !== e.kagura && x.prefecture === e.prefecture), ...pool.filter((x) => x.kagura !== e.kagura && x.prefecture !== e.prefecture)];
  return pick.slice(0, 3).map((x) => ({ id: x.id, name: x.name, kagura: x.kagura, description: x.description }));
}

const ALLOWED = new Set(["description", "fee", "end", "reservationStatus", "refs"]);
/**
 * 下書きの形を確かめる(開催ページの冒頭・検索結果の説明に出るため)。errors があると下書きに入れない・公開しない。
 * e: 下書きを入れる開催(終了時刻が開始より後かを見る)
 */
export function validateEventDraft(v, e = {}) {
  const errors = [];
  if (!v || typeof v !== "object" || Array.isArray(v)) return { errors: ["下書きが、項目の集まり(オブジェクト)になっていません"] };
  for (const k of Object.keys(v)) if (!ALLOWED.has(k)) errors.push(`知らない項目「${k}」があります(使えるのは ${[...ALLOWED].join("・")})`);
  if (!str(v.description)) errors.push("説明(description)がありません");
  else {
    const d = v.description.trim(), n = [...d].length;
    if (n < 40) errors.push("説明(description)は40字以上にします(開催ページの冒頭と、検索結果の説明に出るため)");
    if (n > 300) errors.push("説明(description)は300字以内にします(管理者用ページの入力欄と同じ上限)");
    if (!/。$/.test(d)) errors.push("説明(description)は「。」で終えます");
    if (/https?:\/\//.test(d)) errors.push("説明(description)に URL を書きません(公式情報へは、ページのボタンで案内します)");
    if (/\n/.test(d)) errors.push("説明(description)は改行せずに書きます(文ごとの改行は、ページが付けます)");
  }
  if (v.fee != null && (!str(v.fee) || [...v.fee].length > 80)) errors.push("料金(fee)は、80字以内の文にします(分からなければ書きません)");
  if (v.end != null) {
    if (!DT.test(v.end)) errors.push("終了(end)は「2026-10-18T21:00」の形にします(分からなければ書きません)");
    else if (e.start && v.end <= e.start) errors.push("終了(end)は、開始より後にします");
  }
  if (v.reservationStatus != null && !Object.hasOwn(RESERVATION, v.reservationStatus)) errors.push(`予約の要否(reservationStatus)は ${Object.keys(RESERVATION).join("・")} のどれかにします(分からなければ書きません)`);
  if (!Array.isArray(v.refs) || !v.refs.length) errors.push("参考にしたページ(refs)を1つ以上書きます(確かめるときに開きます)");
  else if (!v.refs.every((r) => r && str(r.name) && /^https:\/\/\S+$/.test(r.url ?? ""))) errors.push("参考にしたページ(refs)は { name, url(https) } の並びにします");
  return { errors };
}

/** 予定タスクが書いた下書きを入れる。説明がもうある開催・形の合わないもの・すでに値のある項目の書き換えは入れない */
export function putEventDrafts(root, input, today) {
  const events = loadEvents(root), drafts = loadEventDrafts(root), added = [], rejected = [];
  for (const [id, raw] of Object.entries(input ?? {})) {
    const e = events.find((x) => x.id === id && x.status === "published");
    if (!e) { rejected.push({ id, errors: ["掲載中の開催に、この ID はありません"] }); continue; }
    if (e.auto) { rejected.push({ id, errors: ["自動収集の開催は、下書きの対象にしません"] }); continue; }
    if (str(e.description)) { rejected.push({ id, errors: ["この開催には、もう説明があります"] }); continue; }
    const { note = "", ...body } = raw ?? {};
    const { errors } = validateEventDraft(body, e);
    const u = unknowns(e);
    for (const k of ["fee", "end", "reservationStatus"]) if (body[k] != null && !u[k]) errors.push(`「${k}」は、もう入っている(未確認ではない)ので、下書きで変えません`);
    if (errors.length) { rejected.push({ id, errors }); continue; }
    if (typeof body.description === "string") body.description = body.description.trim();
    drafts[id] = { status: "draft", createdAt: today, name: e.name, draft: body, note: String(note), ...(drafts[id]?.redoNote ? { prevRedoNote: drafts[id].redoNote } : {}) };
    added.push(id);
  }
  if (added.length) saveEventDrafts(root, drafts);
  return { added, rejected };
}

/** 作り直しを頼む(運営者が、直してほしい点を書く) */
export function redoEventDraft(root, id, note, today) {
  const drafts = loadEventDrafts(root);
  if (!drafts[id]) throw new Error("下書きが見つかりません");
  drafts[id] = { ...drafts[id], status: "redo", redoNote: String(note ?? ""), redoAt: today };
  saveEventDrafts(root, drafts);
}

// 開催の項目の並び(管理者用ページの保存と同じ。差分を読みやすくする)
const ORDER = ["id", "name", "kagura", "prefecture", "city", "venue", "address", "start", "end", "timeUnknown", "fee", "url", "description", "source", "checked", "status"];
const sorted = (e) => Object.fromEntries([...ORDER.filter((k) => k in e).map((k) => [k, e[k]]), ...Object.entries(e).filter(([k]) => !ORDER.includes(k))]);

/** 下書きを開催に入れる(公開の前の確認に通らなければ、undo で元に戻す)。返すのは { event, undo } */
export function applyEventDraft(root, id) {
  const drafts = loadEventDrafts(root), d = drafts[id];
  if (!d || d.status !== "draft") throw new Error("確かめ待ちの下書きが見つかりません");
  const file = paths(root).events, before = readFileSync(file, "utf8");
  const events = loadEvents(root), i = events.findIndex((x) => x.id === id && x.status === "published");
  if (i < 0) throw new Error("掲載中の開催が見つかりません(取り下げられた可能性があります)");
  const e = events[i];
  if (str(e.description)) throw new Error("この開催には、もう説明があります");
  const { errors } = validateEventDraft(d.draft, e);
  if (errors.length) throw new Error(`下書きの形が合いません: ${errors.join(" / ")}`);
  const u = unknowns(e), next = { ...e, description: d.draft.description };
  if (d.draft.fee != null && u.fee) next.fee = d.draft.fee;
  if (d.draft.end != null && u.end) next.end = d.draft.end;
  if (d.draft.reservationStatus != null && u.reservationStatus) { next.reservationStatus = d.draft.reservationStatus; delete next.reservation; }
  events[i] = sorted(next);
  saveEvents(root, events);
  delete drafts[id];
  saveEventDrafts(root, drafts);
  return {
    event: events[i],
    undo(error) {
      writeFileSync(file, before);
      const now = loadEventDrafts(root);
      now[id] = { ...d, lastError: String(error ?? "").slice(0, 2000) };
      saveEventDrafts(root, now);
    },
  };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const root = process.cwd(), [cmd, arg] = process.argv.slice(2);
  const today = new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);
  const todo = eventGaps(root).filter((g) => !g.draft || g.draft.status === "redo");
  if (cmd === "due") {
    console.log(todo.length ? `due: ${todo.map((g) => `${g.id} ${g.name}${g.draft ? "(作り直し)" : ""}`).join("、")}` : "skip: 説明の下書きが要る開催はありません");
  } else if (cmd === "show") {
    console.log(JSON.stringify(todo.map(({ draft, ...g }) => ({ ...g, redoNote: draft?.redoNote ?? null, previous: draft?.draft ?? null })), null, 2));
  } else if (cmd === "examples") {
    console.log(JSON.stringify(Object.fromEntries(todo.map((g) => [g.id, examplesFor(root, g.id)])), null, 2));
  } else if (cmd === "put" && arg) {
    const r = putEventDrafts(root, readJson(arg, {}), today);
    for (const k of r.added) console.log(`下書きに入れました: ${k}`);
    for (const x of r.rejected) console.log(`入れませんでした: ${x.id}\n  - ${x.errors.join("\n  - ")}`);
    if (r.rejected.length) process.exitCode = 1;
  } else {
    console.error("使い方: node scripts/admin/event-draft.mjs due | show | examples | put <file>");
    process.exitCode = 2;
  }
}
