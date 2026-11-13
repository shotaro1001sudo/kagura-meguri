// 広告の報酬を自動で集める(analytics/earnings.json。このPCだけ・git に入らない)。管理者用ページの「目標・収益」の売上に入る
//   バリューコマース: 公式の注文レポート API(admin.local.json の valuecommerce.clientKey / clientSecret)。
//     管理者用ページの定期の更新(6時間に1回まで)と「最新にする」「いま読み込む」で、今月と前の2か月を読み直す(過去12か月のうち、無い月も埋める・古い月も1つずつ巡回して確定の変化を拾う)
//   楽天アフィリエイト: 成果を取る公式の API がないため、予定タスク(kagurameguri-rakuten-earnings)が、ログイン済みの Chrome で成果の画面を読み、
//     node scripts/admin/earnings.mjs rakuten 2026-11=発生/確定 … で書く。ログインが切れていたら --error login を書き、管理者用ページの「やること」に出す
// 手入力(目標・収益 → 実績を入れる)があれば、その月は手入力を優先する(overview.mjs の revenueOf)
// 安全のため: キー・トークン・注文の中身は、画面にもログにも出さない。保存するのは月ごとの件数と金額だけ
import { readFileSync, writeFileSync, existsSync, mkdirSync, renameSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const VC_TOKEN_URL = "https://api.valuecommerce.com/auth/v1/affiliate/token/?grant_type=client_credentials";
const VC_REPORT_URL = "https://api.valuecommerce.com/report/v3/affiliate/transaction/";
export const VC_SOURCE = "https://pub-docs.valuecommerce.ne.jp/docs/as-78-order-report-api/";
const VC_LIMIT = 1000, VC_MAX_PAGES = 8;
export const VC_MIN_HOURS = 6; // 定期の更新では、前回からこれだけ空ける(API に負担をかけない。「いま読み込む」は、いつでも)
export const KEEP_MONTHS = 12; // 過去12か月(今月を含む)まで持つ
export const RAKUTEN_STALE_DAYS = 10; // 楽天の記録が、これより古いと「読めていない」とする(予定タスクは3日に1回)
export const RAKUTEN_ERRORS = { login: "Chrome で楽天アフィリエイトにログインしていないため、読めませんでした", page: "楽天アフィリエイトの画面の形が変わったため、読めませんでした" };

const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;
const file = (root) => join(root, "analytics", "earnings.json");
const readJson = (p, d) => { try { return existsSync(p) ? JSON.parse(readFileSync(p, "utf8").replace(/^﻿/, "")) : d; } catch { return d; } };
const todayJst = () => new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);

export function loadEarnings(root) {
  const e = readJson(file(root), {}) ?? {};
  return { vc: e.vc ?? null, rakuten: e.rakuten ?? null };
}
function saveEarnings(root, e) {
  const p = file(root);
  if (!existsSync(dirname(p))) mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p + ".tmp", JSON.stringify(e, null, 2)); renameSync(p + ".tmp", p);
}
/** YYYY-MM の n か月後(負なら前) */
export const addMonth = (m, n) => { const d = new Date(Date.UTC(+m.slice(0, 4), +m.slice(5, 7) - 1 + n, 1)); return d.toISOString().slice(0, 7); };
/** その月の、API に渡す期間(今月は今日まで) */
export function monthWindow(month, today) {
  const end = new Date(Date.UTC(+month.slice(0, 4), +month.slice(5, 7), 0)).toISOString().slice(0, 10);
  return { month, from: month + "-01", to: end < today ? end : today };
}
/** 読み直す月: 今月と前の2か月・過去12か月で、まだ無い月・古い月を1つ(日ごとに巡回) */
export function vcMonthsToFetch(today, stored = {}) {
  const now = today.slice(0, 7);
  const recent = [0, 1, 2].map((i) => addMonth(now, -i));
  const older = Array.from({ length: KEEP_MONTHS - 3 }, (_, i) => addMonth(now, -(i + 3)));
  const missing = older.filter((m) => !stored[m]);
  return [...recent, ...(missing.length ? missing : [older[(+today.slice(8, 10) - 1) % older.length]])];
}

// ---------- バリューコマース ----------
class VcError extends Error {}
async function vcGet(fetchImpl, url, bearer) {
  let r;
  try { r = await fetchImpl(url, { method: "GET", redirect: "error", headers: { Authorization: "Bearer " + bearer, Accept: "application/json" }, signal: AbortSignal.timeout(20000) }); }
  catch { throw new VcError("バリューコマースにつながりませんでした"); }
  if (r.status === 401 || r.status === 403) throw new VcError("バリューコマースのキーが違うか、使えなくなっています(admin.local.json の valuecommerce を確かめてください)");
  if (!r.ok) throw new VcError(`バリューコマースが応答しませんでした(HTTP ${r.status})`);
  let body;
  try { body = await r.json(); } catch { throw new VcError("バリューコマースの応答を読めませんでした"); }
  if (!body || typeof body !== "object" || body.error || !body.resultSet) throw new VcError("バリューコマースの応答の形が違います");
  return body.resultSet;
}
async function vcToken(fetchImpl, key, secret) {
  const set = await vcGet(fetchImpl, VC_TOKEN_URL, Buffer.from(key + "|" + secret, "utf8").toString("base64"));
  const t = set.rowData?.bearer_token;
  if (typeof t !== "string" || !t) throw new VcError("バリューコマースの認証に失敗しました");
  return t;
}
async function vcOrders(fetchImpl, token, w) {
  const map = new Map(); // 注文ごとに、いちばん新しい状態だけを使う
  let offset = 0;
  for (let page = 0; page < VC_MAX_PAGES; page++) {
    const u = new URL(VC_REPORT_URL);
    for (const [k, v] of Object.entries({ criteria: "o", from_date: w.from, to_date: w.to, approval_status: "p,a,c,i", limit: VC_LIMIT, offset, via_ad: "true", via_vpc: "false", field: "transactionOid,affilId,orderDate,approvalStatus,affilPayment,updDate" })) u.searchParams.set(k, String(v));
    const set = await vcGet(fetchImpl, u.toString(), token);
    if (!Array.isArray(set.rowData ?? [])) throw new VcError("バリューコマースの注文の形が違います");
    for (const r of set.rowData ?? []) {
      if (r.transactionOid == null || r.affilId == null) throw new VcError("バリューコマースの注文の形が違います");
      const id = `${r.affilId}|${r.transactionOid}`, old = map.get(id);
      if (!old || String(r.updDate ?? "") >= String(old.updDate ?? "")) map.set(id, r);
    }
    const next = Number(set.responseInfo?.nextOffset);
    if (next === -1 || (set.responseInfo?.nextOffset == null && (set.rowData ?? []).length < VC_LIMIT)) return [...map.values()];
    if (!Number.isSafeInteger(next) || next <= offset) throw new VcError("バリューコマースの注文の続きを読めませんでした");
    offset = next;
  }
  throw new VcError("バリューコマースの注文が多すぎて、読み切れませんでした(途中までの数は使いません)");
}
/** 注文を、月の件数と金額にまとめる(保留 P・承認 A・否認 C・請求済 I)。sid のサイトの分だけ */
export function vcAggregate(orders, w, sid) {
  const s = { P: [0, 0], A: [0, 0], C: [0, 0], I: [0, 0] };
  for (const o of orders) {
    if (sid && String(o.affilId) !== String(sid)) continue;
    if (typeof o.orderDate !== "string" || o.orderDate.slice(0, 7) !== w.month) throw new VcError("バリューコマースの注文の月が合いません");
    const x = s[String(o.approvalStatus).toUpperCase()];
    if (!x) throw new VcError("バリューコマースの注文に、知らない状態があります");
    const v = Number(o.affilPayment);
    if (o.affilPayment === "" || o.affilPayment == null || !Number.isFinite(v)) throw new VcError("バリューコマースの報酬額が読めません(0円とはみなしません)");
    x[0]++; x[1] += v;
  }
  return { orders: s.P[0] + s.A[0] + s.C[0] + s.I[0], pendingYen: s.P[1], approvedYen: s.A[1], rejectedYen: s.C[1], billedYen: s.I[1], confirmedYen: s.A[1] + s.I[1] };
}
/**
 * バリューコマースの報酬を読み直して、analytics/earnings.json に書く。
 * 読み切れたときだけ書く(途中の月が失敗したら、前の値のまま・エラーを残す)。返す text は画面用(金額は出さない)
 */
export async function refreshVc(root, { local, sid, today = todayJst(), fetchImpl = globalThis.fetch, nowIso = new Date().toISOString() } = {}) {
  const k = local?.valuecommerce ?? {};
  if (!k.clientKey || !k.clientSecret) return { ok: false, skipped: true, text: "バリューコマースのキーが未設定です" };
  const e = loadEarnings(root);
  const prev = e.vc?.months ?? {};
  try {
    const token = await vcToken(fetchImpl, k.clientKey, k.clientSecret);
    const got = {};
    for (const m of vcMonthsToFetch(today, prev)) { const w = monthWindow(m, today); got[m] = vcAggregate(await vcOrders(fetchImpl, token, w), w, sid); }
    const cut = addMonth(today.slice(0, 7), -(KEEP_MONTHS - 1));
    const months = Object.fromEntries(Object.entries({ ...prev, ...got }).filter(([m]) => m >= cut).sort());
    saveEarnings(root, { ...e, vc: { fetchedAt: nowIso, months, error: null, source: VC_SOURCE } });
    return { ok: true, text: `バリューコマースの報酬を読み込みました(${Object.keys(got).length}か月分)` };
  } catch (err) {
    const msg = err instanceof VcError ? err.message : "バリューコマースの報酬を読めませんでした";
    saveEarnings(root, { ...e, vc: { ...(e.vc ?? { months: {} }), error: msg, errorAt: nowIso } });
    return { ok: false, text: msg };
  }
}

// ---------- 楽天アフィリエイト(予定タスクが Chrome で読んだ額) ----------
/** "2026-11=1234/0" → ["2026-11", { yen: 1234, confirmedYen: 0 }]。発生(未確定を含む)/確定。確定は省ける */
export function parseRakutenArg(s) {
  const m = /^(\d{4}-\d{2})=([\d,]+)(?:\/([\d,]+))?$/.exec(String(s).trim());
  if (!m || !MONTH.test(m[1])) return null;
  const n = (x) => (x == null ? null : Number(x.replace(/,/g, "")));
  return [m[1], { yen: n(m[2]), confirmedYen: n(m[3]) }];
}
/**
 * 楽天の報酬を書く。months: { "YYYY-MM": { yen, confirmedYen? } }。error: "login" | "page"(読めなかったとき。前の額は残す)
 */
export function recordRakuten(root, { months = {}, error = null, today = todayJst(), nowIso = new Date().toISOString() } = {}) {
  const e = loadEarnings(root);
  const prev = e.rakuten?.months ?? {};
  if (error) {
    if (!RAKUTEN_ERRORS[error]) return { code: 400, error: `error は ${Object.keys(RAKUTEN_ERRORS).join(" / ")} のどれかです` };
    saveEarnings(root, { ...e, rakuten: { ...(e.rakuten ?? { months: {} }), error, errorAt: nowIso } });
    return { ok: true, error };
  }
  const entries = Object.entries(months);
  if (!entries.length) return { code: 400, error: "月の額がありません" };
  const now = today.slice(0, 7), cut = addMonth(now, -(KEEP_MONTHS - 1));
  for (const [m, v] of entries) {
    if (!MONTH.test(m) || m > now || m < cut) return { code: 400, error: `月が正しくありません: ${m}(過去12か月まで)` };
    for (const f of ["yen", "confirmedYen"]) if (v?.[f] != null && !(Number.isInteger(v[f]) && v[f] >= 0)) return { code: 400, error: `${m} の額は 0 以上の整数(円)で入れてください` };
    if (v?.yen == null) return { code: 400, error: `${m} の発生した報酬(円)がありません` };
    if (v.confirmedYen != null && v.confirmedYen > v.yen) return { code: 400, error: `${m}: 確定が、発生した報酬より大きくなっています` };
  }
  const merged = { ...prev };
  for (const [m, v] of entries) merged[m] = { yen: v.yen, ...(v.confirmedYen != null ? { confirmedYen: v.confirmedYen } : {}) };
  const kept = Object.fromEntries(Object.entries(merged).filter(([m]) => m >= cut).sort());
  saveEarnings(root, { ...e, rakuten: { fetchedAt: nowIso, months: kept, error: null } });
  return { ok: true, months: entries.length };
}

/** 画面用の状態(金額は含めない。金額は actuals から) */
export function earningsStatus(root, { local, today = todayJst(), nowMs = Date.now() } = {}) {
  const e = loadEarnings(root);
  const r = e.rakuten;
  const age = (iso) => (iso ? (nowMs - Date.parse(iso)) / 864e5 : null);
  return {
    vc: { ready: !!(local?.valuecommerce?.clientKey && local?.valuecommerce?.clientSecret), fetchedAt: e.vc?.fetchedAt ?? null, error: e.vc?.error ?? null, errorAt: e.vc?.errorAt ?? null },
    rakuten: { fetchedAt: r?.fetchedAt ?? null, error: r?.error ? RAKUTEN_ERRORS[r.error] ?? r.error : null, errorAt: r?.errorAt ?? null,
      // 読めていない: ログイン切れなどで止まった(最後の成功より後にエラー)/ 予定より長く読めていない
      problem: !!(r?.error && (!r.fetchedAt || r.errorAt >= r.fetchedAt)) || (r?.fetchedAt ? age(r.fetchedAt) > RAKUTEN_STALE_DAYS : false) },
  };
}

// ---------- コマンド ----------
//   node scripts/admin/earnings.mjs rakuten 2026-11=1234/0 2026-10=5000/5000   (発生/確定。確定は省ける)
//   node scripts/admin/earnings.mjs rakuten --error login                       (ログインが切れていた)
//   node scripts/admin/earnings.mjs vc                                          (バリューコマースをいま読む)
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
  const [cmd, ...args] = process.argv.slice(2);
  const done = (r) => { if (r.error && r.code) { console.error(r.error); process.exitCode = 1; } else console.log(r.text ?? "記録しました"); };
  if (cmd === "rakuten") {
    const ei = args.indexOf("--error");
    if (ei >= 0) done(recordRakuten(root, { error: args[ei + 1] }));
    else {
      const pairs = args.map(parseRakutenArg);
      if (!pairs.length || pairs.some((p) => !p)) { console.error("書き方: rakuten YYYY-MM=発生した報酬/確定した報酬 …(例 2026-11=1234/0)"); process.exitCode = 1; }
      else { const r = recordRakuten(root, { months: Object.fromEntries(pairs) }); done(r.ok ? { text: `楽天の報酬を記録しました(${r.months}か月分)` } : r); }
    }
  } else if (cmd === "vc") {
    const local = readJson(join(root, "admin.local.json"), {});
    const cfg = readJson(join(root, "config.json"), {});
    refreshVc(root, { local, sid: cfg.affiliate?.valueCommerceSid }).then((r) => { console.log(r.text); if (!r.ok) process.exitCode = 1; });
  } else { console.error("使い方: node scripts/admin/earnings.mjs rakuten 2026-11=1234/0 | rakuten --error login | vc"); process.exitCode = 1; }
}
