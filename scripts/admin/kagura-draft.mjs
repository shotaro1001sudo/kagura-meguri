// 神楽の種類の解説(data/kagura-info.json)の下書き。
// 申請などで、解説のない新しい神楽の種類が掲載されたら、予定タスク(kagurameguri-kagura-drafts)が出典つきで下書きを書き、
// 運営者が管理者用ページの「やること」で読んで「公開する」を押したときだけ、kagura-info.json に入れてサイトに出す。
// 下書きは .admin/kagura-drafts.json(このPCだけ。確かめる前の文を、公開のリポジトリに出さない)。
//
// 予定タスクの使い方:
//   node scripts/admin/kagura-draft.mjs due          … 1行目が「skip: …」なら何もしない。「due: …」なら、続く行の種類の下書きを書く
//   node scripts/admin/kagura-draft.mjs show         … 下書きが要る種類と、その種類の開催・定期公演(公式の URL つき)、作り直しの理由
//   node scripts/admin/kagura-draft.mjs put <file>   … { "種類": { ...kagura-info と同じ形, "note": "確かめきれなかった点" } } を確かめて、下書きに入れる
import { readFileSync, writeFileSync, existsSync, mkdirSync, renameSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const readJson = (f, fallback) => (existsSync(f) ? JSON.parse(readFileSync(f, "utf8").replace(/^﻿/, "")) : fallback);
const writeJson = (f, v) => { writeFileSync(f + ".tmp", JSON.stringify(v, null, 2)); renameSync(f + ".tmp", f); };

export const draftsPath = (root) => join(root, ".admin/kagura-drafts.json");
export const infoPath = (root) => join(root, "data/kagura-info.json");
export const loadDrafts = (root) => readJson(draftsPath(root), {});
export function saveDrafts(root, drafts) { const dir = join(root, ".admin"); if (!existsSync(dir)) mkdirSync(dir, { recursive: true }); writeJson(draftsPath(root), drafts); }
export const loadKaguraInfo = (root) => readJson(infoPath(root), {});
// リポジトリの kagura-info.json は、2字下げで、最後に改行がある形
export const saveKaguraInfo = (root, info) => { const f = infoPath(root); writeFileSync(f + ".tmp", JSON.stringify(info, null, 2) + "\n"); renameSync(f + ".tmp", f); };

/** 掲載中の開催(終了したものを含む)と定期公演の、神楽の種類ごとの記録 */
function records(root) {
  const events = readJson(join(root, "data/events.json"), []).filter((e) => e.status === "published");
  const regular = readJson(join(root, "data/regular.json"), []).filter((r) => !r.status || r.status === "published");
  return [...events, ...regular].filter((x) => x.kagura);
}

/** サイトにある神楽の種類(解説のあるもの + 掲載している開催・定期公演の種類)。入力の候補に使う */
export function kaguraKinds(root) {
  return [...new Set([...Object.keys(loadKaguraInfo(root)), ...records(root).map((x) => x.kagura)])].sort((a, b) => a.localeCompare(b, "ja"));
}

/** 解説のない神楽の種類と、その下書きの状態(draft: 確かめ待ち / redo: 作り直しを頼んだ / なし: 予定タスクが書くのを待っている) */
export function kaguraGaps(root) {
  const info = loadKaguraInfo(root), drafts = loadDrafts(root), recs = records(root);
  return [...new Set(recs.map((x) => x.kagura))].filter((k) => !info[k]).map((kind) => {
    const list = recs.filter((x) => x.kagura === kind);
    return { kind, count: list.length, items: list.map((x) => ({ id: x.id, name: x.name, start: x.start ?? "", prefecture: x.prefecture, city: x.city ?? "", url: x.url ?? "" })), draft: drafts[kind] ?? null };
  });
}

const ALLOWED = new Set(["tagline", "intro", "source", "history", "features", "programs", "viewing", "refs"]);
const str = (v) => typeof v === "string" && v.trim().length > 0;
/**
 * 解説の形を確かめる(サイトの種類のページと、npm test の決まりに合わせる)。
 * errors があると下書きに入れない・公開しない。warnings は、ページに「情報がありません。」の欄ができるもの。
 */
export function validateKaguraInfo(v) {
  const errors = [], warnings = [];
  if (!v || typeof v !== "object" || Array.isArray(v)) return { errors: ["解説が、項目の集まり(オブジェクト)になっていません"], warnings };
  for (const k of Object.keys(v)) if (!ALLOWED.has(k)) errors.push(`知らない項目「${k}」があります(使えるのは ${[...ALLOWED].join("・")})`);
  if (!str(v.tagline) || !/^\S.*\S ・ \S/.test(v.tagline)) errors.push("一言紹介(tagline)は「地域 ・ ひとこと」の形にします(例: 長崎県平戸市 ・ …)");
  if (!str(v.intro)) errors.push("紹介文(intro)がありません");
  else {
    if ([...v.intro].length < 60) errors.push("紹介文(intro)は60字以上にします(検索結果と種類のページの冒頭に出るため)");
    if (!/。$/.test(v.intro.trim())) errors.push("紹介文(intro)は「。」で終えます");
  }
  if (!str(v.source)) errors.push("出典(source)がありません");
  const texts = (key, label, need) => {
    if (v[key] == null) { if (need) errors.push(`${label}(${key})がありません`); else warnings.push(`${label}がありません(ページに「情報がありません。」と出ます)`); return; }
    if (!Array.isArray(v[key]) || !v[key].every(str)) { errors.push(`${label}(${key})は、文の並び(配列)にします`); return; }
    if (!v[key].length) { if (need) errors.push(`${label}(${key})を1つ以上書きます`); else warnings.push(`${label}がありません(ページに「情報がありません。」と出ます)`); }
  };
  texts("history", "歴史", true);
  texts("features", "特徴", false);
  texts("viewing", "観賞のコツ", false);
  if (v.programs == null || (Array.isArray(v.programs) && !v.programs.length)) warnings.push("主な演目がありません(ページに「情報がありません。」と出ます)");
  else if (!Array.isArray(v.programs) || !v.programs.every((p) => p && str(p.name) && str(p.text))) errors.push("主な演目(programs)は { name, text } の並びにします");
  if (!Array.isArray(v.refs) || !v.refs.length) errors.push("参考にしたページ(refs)を1つ以上書きます(確かめるときに開きます)");
  else if (!v.refs.every((r) => r && str(r.name) && /^https:\/\/\S+$/.test(r.url ?? ""))) errors.push("参考にしたページ(refs)は { name, url(https) } の並びにします");
  return { errors, warnings };
}

/** 予定タスクが書いた下書きを入れる。解説がすでにある種類・形の合わないものは入れない */
export function putDrafts(root, input, today) {
  const info = loadKaguraInfo(root), drafts = loadDrafts(root), added = [], rejected = [];
  for (const [kind, raw] of Object.entries(input ?? {})) {
    const { note = "", ...body } = raw ?? {};
    if (info[kind]) { rejected.push({ kind, errors: ["この種類には、もう解説があります"] }); continue; }
    const { errors, warnings } = validateKaguraInfo(body);
    if (errors.length) { rejected.push({ kind, errors }); continue; }
    drafts[kind] = { status: "draft", createdAt: today, info: body, note: String(note), warnings, ...(drafts[kind]?.redoNote ? { prevRedoNote: drafts[kind].redoNote } : {}) };
    added.push(kind);
  }
  if (added.length) saveDrafts(root, drafts);
  return { added, rejected };
}

/** 作り直しを頼む(運営者が、直してほしい点を書く) */
export function redoDraft(root, kind, note, today) {
  const drafts = loadDrafts(root);
  if (!drafts[kind]) throw new Error("下書きが見つかりません");
  drafts[kind] = { ...drafts[kind], status: "redo", redoNote: String(note ?? ""), redoAt: today };
  saveDrafts(root, drafts);
}

/** 下書きを解説に入れる(公開の前の確認に通らなければ、undo で元に戻す) */
export function applyDraft(root, kind) {
  const drafts = loadDrafts(root), d = drafts[kind];
  if (!d || d.status !== "draft") throw new Error("確かめ待ちの下書きが見つかりません");
  const { errors } = validateKaguraInfo(d.info);
  if (errors.length) throw new Error(`下書きの形が合いません: ${errors.join(" / ")}`);
  const before = existsSync(infoPath(root)) ? readFileSync(infoPath(root), "utf8") : null;
  const info = loadKaguraInfo(root);
  if (info[kind]) throw new Error("この種類には、もう解説があります");
  saveKaguraInfo(root, { ...info, [kind]: d.info });
  delete drafts[kind];
  saveDrafts(root, drafts);
  return {
    undo(error) {
      if (before == null) return;
      writeFileSync(infoPath(root), before);
      const now = loadDrafts(root);
      now[kind] = { ...d, lastError: String(error ?? "").slice(0, 2000) };
      saveDrafts(root, now);
    },
  };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const root = process.cwd(), [cmd, arg] = process.argv.slice(2);
  const today = new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);
  const todo = kaguraGaps(root).filter((g) => !g.draft || g.draft.status === "redo");
  if (cmd === "due") {
    console.log(todo.length ? `due: ${todo.map((g) => g.draft ? `${g.kind}(作り直し)` : g.kind).join("、")}` : "skip: 下書きの要る神楽の種類はありません");
  } else if (cmd === "show") {
    console.log(JSON.stringify(todo.map((g) => ({ kind: g.kind, items: g.items, redoNote: g.draft?.redoNote ?? null, previous: g.draft?.info ?? null })), null, 2));
  } else if (cmd === "put" && arg) {
    const r = putDrafts(root, readJson(arg, {}), today);
    for (const k of r.added) console.log(`下書きに入れました: ${k}`);
    for (const x of r.rejected) console.log(`入れませんでした: ${x.kind}\n  - ${x.errors.join("\n  - ")}`);
    if (r.rejected.length) process.exitCode = 1;
  } else {
    console.error("使い方: node scripts/admin/kagura-draft.mjs due | show | put <file>");
    process.exitCode = 2;
  }
}
