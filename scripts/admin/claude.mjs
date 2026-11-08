// 管理者用ページから、Claude に作業を任せる(コピーして貼り付けなくてよいように)。
//   1件ごとに、専用の作業フォルダ(git worktree・専用のブランチ)を作り、そこで Claude Code を動かす。
//   作業どうしや、このPCのいつものフォルダ(作業中のファイル)は、互いに影響しない。
//   Claude は push しない。結果(変えたファイル・ひとこと)を画面で見て、人が「公開する」か「やめる」を決める。
//   Claude が質問で止まったときは、画面から返事を送ると、同じ作業の続きから動く(--resume)。
// 記録は .admin/jobs.json(Git に入らない)。作業フォルダは .admin/work/<ID>
import { spawn, execFile } from "node:child_process";
import { readFileSync, writeFileSync, existsSync, mkdirSync, renameSync, readdirSync, statSync, rmSync, rmdirSync, unlinkSync, lstatSync, symlinkSync } from "node:fs";
import { join } from "node:path";
import { randomBytes } from "node:crypto";
import { findGit, DATA_TESTS } from "./publish.mjs";

export const JOB_STATUS = { queued: "順番待ち", running: "作業中", review: "確認待ち(変更あり)", answered: "返事あり(変更なし)", failed: "止まった", publishing: "公開中", published: "公開済み", discarded: "やめた" };
const OPEN = new Set(["queued", "running", "review", "answered", "failed", "publishing"]);
export const isOpenJob = (j) => OPEN.has(j.status);

// Claude に許す操作。公開(push)は人が画面で決めるので、させない
export const ALLOWED_TOOLS = ["Read", "Edit", "Write", "Glob", "Grep", "WebFetch", "WebSearch", "TodoWrite",
  "Bash(node:*)", "Bash(npm test:*)", "Bash(npm run:*)", "Bash(ls:*)",
  "Bash(git status:*)", "Bash(git diff:*)", "Bash(git add:*)", "Bash(git commit:*)", "Bash(git log:*)", "Bash(git show:*)"];
export const DISALLOWED_TOOLS = ["Bash(git push:*)", "Bash(git checkout:*)", "Bash(git switch:*)", "Bash(git reset:*)", "Bash(git rebase:*)", "Bash(git worktree:*)"];

export const SYSTEM = [
  "あなたは、神楽めぐり(このリポジトリ)の管理者用ページから頼まれた作業をしています。運営者は、この場では質問に答えられません。",
  "- この作業用のフォルダ(専用のブランチ)の中だけで作業してください。git push はしないでください(公開するかは、運営者が画面で決めます)。",
  "- 変更したら、npm test が通ることを確かめてから、コミットしてください。頼まれた文に ID(例: SEO-20261107-1、MON-…)があれば、コミットのメッセージに入れてください。",
  "- 運営者が決めないと進めないこと(お金・契約・外部サービスの設定・方針の選択など)があれば、そこで作業を止め、最後の返事の最初の行を「質問: 」で始めて、選べる形で尋ねてください。画面から返事が届きます。",
  "- 最後の返事は、日本語で短く: 変えたこと / 確かめたこと / 運営者がやること(あれば)。",
].join("\n");

const readJson = (p, d) => { try { return existsSync(p) ? JSON.parse(readFileSync(p, "utf8")) : d; } catch { return d; } };
const writeJson = (p, v) => { writeFileSync(p + ".tmp", JSON.stringify(v, null, 2)); renameSync(p + ".tmp", p); };

/** Claude アプリに入っている Claude Code(claude.exe)の場所。いちばん新しいもの。admin.local.json の claude.path・ADMIN_CLAUDE で差し替えられる */
export function findClaude(local = {}, env = process.env) {
  const given = local.claude?.path || env.ADMIN_CLAUDE;
  if (given) return existsSync(given) ? given : null;
  const base = env.LOCALAPPDATA ? join(env.LOCALAPPDATA, "Claude-Data") : null;
  const found = [];
  const dirs = (p) => { try { return readdirSync(p, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => join(p, d.name)); } catch { return []; } };
  if (base) for (const a of dirs(base)) for (const v of dirs(join(a, "claude-code"))) for (const h of dirs(v)) {
    const f = join(h, process.platform === "win32" ? "claude.exe" : "claude");
    if (existsSync(f)) found.push([statSync(f).mtimeMs, f]);
  }
  return found.sort((x, y) => y[0] - x[0])[0]?.[1] ?? null;
}

// Claude アプリの中から起動されたときの設定(接続先など)を、子の Claude に引き継がない
export function cleanEnv(env = process.env) {
  const out = {};
  for (const [k, v] of Object.entries(env)) if (!/^(CLAUDE|ANTHROPIC_BASE_URL$|ANTHROPIC_AUTH_TOKEN$)/.test(k)) out[k] = v;
  return { ...out, GIT_TERMINAL_PROMPT: "0" };
}

function run(cmd, args, opts = {}) {
  return new Promise((resolve) => {
    execFile(cmd, args, { encoding: "utf8", maxBuffer: 16 << 20, timeout: 120_000, windowsHide: true, ...opts }, (err, stdout, stderr) =>
      resolve({ ok: !err, out: `${stdout ?? ""}${stderr ?? ""}`.trim() }));
  });
}

/** ログインしているか(claude auth status) */
export async function claudeAuth(exe) {
  if (!exe) return { found: false, loggedIn: false };
  const r = await run(exe, ["auth", "status"], { env: cleanEnv(), timeout: 30_000 });
  try { const j = JSON.parse(r.out.slice(r.out.indexOf("{"))); return { found: true, loggedIn: !!j.loggedIn, method: j.authMethod || "" }; }
  catch { return { found: true, loggedIn: false, error: r.out.slice(0, 300) }; }
}

/** 本物の Claude Code を動かす。1行ごとの JSON(stream-json)を onLine に渡す。テストでは差し替える */
export function runClaude({ exe, args, cwd, input, onLine, timeoutMs = 60 * 60e3 }) {
  return new Promise((resolve) => {
    const p = spawn(exe, args, { cwd, env: cleanEnv(), windowsHide: true, stdio: ["pipe", "pipe", "pipe"] });
    let buf = "", err = "";
    const timer = setTimeout(() => { err += "\n時間切れ(60分)で止めました"; p.kill(); }, timeoutMs);
    p.stdout.on("data", (c) => { buf += c; let i; while ((i = buf.indexOf("\n")) >= 0) { const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1); if (line) onLine(line); } });
    p.stderr.on("data", (c) => { err = (err + c).slice(-4000); });
    p.on("error", (e) => { clearTimeout(timer); resolve({ code: -1, err: e.message }); });
    p.on("close", (code) => { clearTimeout(timer); if (buf.trim()) onLine(buf.trim()); resolve({ code, err: err.trim() }); });
    p.stdin.end(input);
  });
}

// ツールの使い方を、画面に出す短い1行にする(中身の全文は出さない)
function toolLine(t) {
  const i = t.input || {};
  const what = i.command || i.file_path || i.pattern || i.url || i.query || "";
  const name = { Read: "読む", Edit: "直す", Write: "書く", Glob: "探す", Grep: "探す", Bash: "実行", WebFetch: "ページを読む", WebSearch: "検索", TodoWrite: "手順を立てる" }[t.name] || t.name;
  return `${name}${what ? ": " + String(what).replace(/\s+/g, " ").slice(0, 120) : ""}`;
}

/**
 * Claude の作業の管理。root はいつものフォルダ(リポジトリ)。
 * serial: 公開(push)を、開催データの公開と重ならないように順番に行うための関数(server.mjs と共有)
 */
export function createJobs({ root, serial = (fn) => fn(), git = findGit(), local = () => ({}), runner = runClaude, findExe = findClaude, auth = claudeAuth,
  check = checkWorktree, parallel = 2, now = () => new Date().toISOString(), onChange = () => {} } = {}) {
  const dir = join(root, ".admin");
  const file = join(dir, "jobs.json");
  const workDir = join(dir, "work");
  const env = cleanEnv();
  const g = (cwd, ...a) => run(git, a, { cwd, env });
  let jobs = readJson(file, { jobs: [] }).jobs;
  // 管理者用ページが止まったときに動いていた作業は、止まったものとして扱う(返事を送れば、続きから動く)
  for (const j of jobs) if (j.status === "running" || j.status === "publishing" || j.status === "queued") { j.status = "failed"; j.error = "管理者用ページが止まったため、中断しました。返事を送ると、続きから動きます。"; }
  let saveTimer = null;
  const save = (soon) => {
    const go = () => { saveTimer = null; if (!existsSync(dir)) mkdirSync(dir, { recursive: true }); writeJson(file, { jobs }); onChange(); };
    if (soon) { if (!saveTimer) saveTimer = setTimeout(go, 1500); return; }
    if (saveTimer) clearTimeout(saveTimer);
    go();
  };
  save();
  let authCache = null;
  const status = async (fresh) => {
    if (!fresh && authCache && Date.now() - authCache.at < 5 * 60e3) return authCache.v;
    const exe = findExe(local());
    const v = { ...(await auth(exe)), exe: !!exe };
    authCache = { at: Date.now(), v };
    return v;
  };

  const find = (id) => jobs.find((j) => j.id === id);
  const view = (j) => ({ id: j.id, title: j.title, source: j.source, status: j.status, createdAt: j.createdAt, startedAt: j.startedAt, endedAt: j.endedAt,
    turns: j.turns, progress: (j.progress || []).slice(-15), question: j.question || "", commits: j.commits || 0, files: j.files || [], dirty: !!j.dirty,
    error: j.error || "", denied: j.denied || [], publish: j.publish || null, branch: j.branch, canReply: !!(j.sessionId && existsSync(j.dir || "")) });
  const list = () => jobs.slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map(view);

  // ---------- 作業用のフォルダ ----------
  const linkModules = (wt) => {
    const src = join(root, "node_modules"), dst = join(wt, "node_modules");
    if (existsSync(src) && !existsSync(dst)) { try { symlinkSync(src, dst, "junction"); } catch { /* なくても、ほとんどの作業はできる */ } }
  };
  // node_modules はリンク(junction)なので、先にリンクだけを外す(中身を消さないように)
  const unlinkModules = (wt) => {
    const dst = join(wt, "node_modules");
    try { if (lstatSync(dst).isSymbolicLink()) { try { unlinkSync(dst); } catch { rmdirSync(dst); } } } catch { /* ない */ }
  };
  async function makeWorktree(j) {
    if (!existsSync(workDir)) mkdirSync(workDir, { recursive: true });
    await g(root, "fetch", "-q", "origin");
    const base = (await g(root, "rev-parse", "origin/main")).out || (await g(root, "rev-parse", "HEAD")).out;
    j.base = base; j.branch = `admin/${j.id}`; j.dir = join(workDir, j.id);
    const r = await g(root, "worktree", "add", "-q", "-b", j.branch, j.dir, base);
    if (!r.ok) throw new Error(`作業用のフォルダを作れませんでした: ${r.out}`);
    linkModules(j.dir);
  }
  async function removeWorktree(j) {
    if (j.dir && existsSync(j.dir)) {
      unlinkModules(j.dir);
      try { if (lstatSync(join(j.dir, "node_modules")).isSymbolicLink()) return; } catch { /* ない */ } // リンクを外せないときは、消さずに残す(本体の node_modules を守る)
      const r = await g(root, "worktree", "remove", "--force", j.dir);
      if (!r.ok) rmSync(j.dir, { recursive: true, force: true });
    }
    await g(root, "worktree", "prune");
    if (j.branch) await g(root, "branch", "-D", j.branch);
  }

  // ---------- 順番に動かす(同時に parallel 件まで) ----------
  let active = 0;
  const pump = () => {
    while (active < parallel) {
      const j = jobs.filter((x) => x.status === "queued").sort((a, b) => a.queuedAt.localeCompare(b.queuedAt))[0];
      if (!j) return;
      j.status = "running"; active++; save();
      work(j).catch((err) => { j.status = "failed"; j.error = err.message; }).finally(() => { active--; j.endedAt = now(); save(); pump(); });
    }
  };

  async function work(j) {
    const exe = findExe(local());
    if (!exe) throw new Error("このPCで、Claude アプリの Claude Code が見つかりません。");
    j.startedAt = now(); j.error = ""; j.question = "";
    if (!j.dir || !existsSync(j.dir)) { j.sessionId = null; await makeWorktree(j); }
    const ask = j.next; delete j.next;
    const args = ["-p", "--output-format", "stream-json", "--verbose", "--permission-mode", "acceptEdits",
      "--allowedTools", ...ALLOWED_TOOLS, "--disallowedTools", ...DISALLOWED_TOOLS, "--append-system-prompt", SYSTEM];
    if (j.sessionId) args.push("--resume", j.sessionId);
    j.progress = j.progress || [];
    let result = null;
    const r = await runner({ exe, args, cwd: j.dir, input: ask, onLine: (line) => {
      let m; try { m = JSON.parse(line); } catch { return; }
      if (m.session_id) j.sessionId = m.session_id;
      if (m.type === "assistant") for (const c of m.message?.content || []) {
        if (c.type === "tool_use") j.progress.push({ at: now(), text: toolLine(c) });
        else if (c.type === "text" && c.text.trim()) j.progress.push({ at: now(), text: c.text.trim().split("\n")[0].slice(0, 160) });
      }
      if (m.type === "result") result = m;
      if (j.progress.length > 60) j.progress = j.progress.slice(-60);
      save(true);
    } });
    const answer = String(result?.result ?? "").trim();
    j.denied = [...new Set((result?.permission_denials || []).map((d) => toolLine({ name: d.tool_name, input: d.tool_input })))].slice(0, 10);
    if (answer) j.turns.push({ who: "claude", at: now(), text: answer.slice(0, 8000) });
    const q = answer.match(/^\s*質問[:：]/m);
    j.question = q ? answer.slice(q.index).trim().slice(0, 2000) : "";
    await inspect(j);
    if (!result || result.is_error || r.code !== 0) {
      j.status = "failed";
      j.error = (/Not logged in|\/login/i.test(answer + r.err) ? "Claude にログインしていません。画面の「Claude にログインする」を押してください。" : answer || r.err || `Claude Code が終了しました(${r.code})`).slice(0, 2000);
      return;
    }
    j.status = j.commits || j.dirty ? "review" : "answered";
  }

  // 作業用のフォルダで、変わったもの(コミットの数・ファイル・コミットしていない変更)
  async function inspect(j) {
    if (!j.dir || !existsSync(j.dir)) return;
    j.commits = Number((await g(j.dir, "rev-list", "--count", `${j.base}..HEAD`)).out) || 0;
    const files = (await g(j.dir, "diff", "--name-status", `${j.base}..HEAD`)).out;
    j.files = files ? files.split("\n").slice(0, 80) : [];
    // 改行(CRLF/LF)だけの違いは、変更として数えない(Windows では、テストのために改行を直すことがあるため)
    const st = (await g(j.dir, "status", "--porcelain")).out.split("\n").filter((l) => l && !/ node_modules\/?$/.test(l));
    const untracked = st.some((l) => l.startsWith("??"));
    const content = !(await g(j.dir, "diff", "HEAD", "--ignore-cr-at-eol", "--quiet")).ok;
    j.dirty = untracked || content;
    j.eolOnly = !j.dirty && st.length > 0;
  }
  // 起動したとき、確認待ちの作業を確かめ直す(前の版で、改行だけの違いを変更と数えていた分を直す)
  const recheck = Promise.all(jobs.filter((j) => j.status === "review").map((j) => inspect(j).catch(() => {}))).then(() => save());

  return {
    ready: () => recheck,
    list, status,
    resetAuth: () => { authCache = null; },
    exe: () => findExe(local()),
    /** 新しく頼む。source: どこから頼んだか({ kind: "proposal"|"mon", id }) */
    start({ title, prompt, source = { kind: "proposal" } }) {
      const text = String(prompt ?? "").trim();
      if (!text) return { code: 400, error: "頼む内容が空です" };
      if (text.length > 8000) return { code: 400, error: "頼む内容が長すぎます(8000字まで)" };
      if (source.id && jobs.some((j) => isOpenJob(j) && j.source?.id === source.id)) return { code: 409, error: "この案は、すでに Claude が作業中か、確認待ちです" };
      const at = now();
      const j = { id: `j${at.slice(0, 10).replace(/-/g, "")}-${randomBytes(3).toString("hex")}`, title: String(title || text.split("\n")[0]).slice(0, 120), source,
        status: "queued", createdAt: at, queuedAt: at, turns: [{ who: "you", at, text }], next: text, progress: [] };
      jobs.push(j);
      // 古い記録(終わってから30日)を片付ける
      const cut = new Date(Date.now() - 30 * 864e5).toISOString();
      jobs = jobs.filter((x) => isOpenJob(x) || (x.endedAt || x.createdAt) > cut);
      save(); pump();
      return { job: view(j) };
    },
    /** 返事を送って、同じ作業の続きを頼む */
    reply(id, text) {
      const j = find(id);
      if (!j) return { code: 404, error: "作業が見つかりません" };
      const t = String(text ?? "").trim();
      if (!t) return { code: 400, error: "返事が空です" };
      if (!["review", "answered", "failed"].includes(j.status)) return { code: 400, error: "いまは返事を送れません" };
      j.turns.push({ who: "you", at: now(), text: t.slice(0, 8000) });
      j.next = t.slice(0, 8000); j.status = "queued"; j.queuedAt = now();
      save(); pump();
      return { job: view(j) };
    },
    /** やめる(作業用のフォルダとブランチを消す。GitHub には何も送らない) */
    async discard(id) {
      const j = find(id);
      if (!j) return { code: 404, error: "作業が見つかりません" };
      if (["running", "publishing"].includes(j.status)) return { code: 400, error: "作業中は、やめられません。終わるまで待ってください" };
      if (j.status === "published") return { code: 400, error: "公開済みです" };
      await removeWorktree(j);
      j.status = "discarded"; j.endedAt = now(); delete j.next;
      save();
      return { job: view(j) };
    },
    /**
     * 公開する: GitHub の最新に重ねる → サイトを作る確認とテスト → GitHub の main に送る → いつものフォルダも最新にする。
     * 開催データの公開と重ならないよう、serial で順番に。
     */
    publish(id) {
      const j = find(id);
      if (!j) return Promise.resolve({ code: 404, error: "作業が見つかりません" });
      if (j.status !== "review") return Promise.resolve({ code: 400, error: "公開できるのは、確認待ち(変更あり)の作業だけです" });
      j.status = "publishing"; save();
      return serial(async () => {
        // 公開の前に、もう一度確かめる。改行だけの違いは、元に戻してから重ねる
        await inspect(j);
        if (j.dirty) { j.status = "review"; save(); return { code: 400, error: "コミットしていない変更があります。Claude に「コミットして」と返事を送ってください" }; }
        if (j.eolOnly) { await g(j.dir, "reset", "-q"); await g(j.dir, "checkout", "--", "."); j.eolOnly = false; }
        const fail = (step, log) => { j.status = "review"; j.publish = { ok: false, step, log: String(log).slice(-2000), at: now() }; save(); return { publish: j.publish, job: view(j) }; };
        await g(j.dir, "fetch", "-q", "origin");
        const rb = await g(j.dir, "rebase", "origin/main");
        if (!rb.ok) { await g(j.dir, "rebase", "--abort"); return fail("rebase", `GitHub 側の変更と、内容が重なりました。Claude に「GitHub の最新(origin/main)に合わせて直して」と返事を送ってください。\n${rb.out}`); }
        j.base = (await g(j.dir, "rev-parse", "origin/main")).out;
        await inspect(j);
        if (!j.commits) { await removeWorktree(j); j.status = "published"; j.publish = { ok: true, commit: "", at: now(), note: "GitHub 側に、同じ変更がすでにありました" }; save(); return { publish: j.publish, job: view(j) }; }
        const c = await check(j.dir);
        if (!c.ok) return fail(c.step, c.log);
        const p = await g(j.dir, "push", "origin", "HEAD:main");
        if (!p.ok) return fail("push", p.out);
        const head = (await g(j.dir, "rev-parse", "--short", "HEAD")).out;
        // いつものフォルダも最新に(作業中のファイルと重なるときは、そのまま。次の公開のときに取り込む)
        const ff = (await g(root, "symbolic-ref", "--short", "HEAD")).out === "main" ? await g(root, "merge", "--ff-only", "-q", "origin/main") : { ok: false };
        await removeWorktree(j);
        j.status = "published"; j.endedAt = now(); j.publish = { ok: true, commit: head, at: now(), synced: ff.ok };
        save();
        return { publish: j.publish, job: view(j), source: j.source };
      });
    },
    /** テスト用: 動いている作業がなくなるまで待つ */
    async idle() { while (active || jobs.some((x) => x.status === "queued")) await new Promise((r) => setTimeout(r, 20)); if (saveTimer) save(); },
  };
}

/** 公開前の確認(作業用のフォルダで): サイトを作れるか、npm test と同じテストが通るか */
export async function checkWorktree(dir) {
  const { mkdtempSync } = await import("node:fs");
  const { tmpdir } = await import("node:os");
  const out = mkdtempSync(join(tmpdir(), "kagura-job-"));
  const b = await run(process.execPath, ["scripts/build.mjs"], { cwd: dir, env: { ...process.env, OUT_DIR: out }, timeout: 300_000 });
  rmSync(out, { recursive: true, force: true });
  if (!b.ok) return { ok: false, step: "build", log: b.out.slice(-2000) };
  for (const t of [...DATA_TESTS, "tests/run.mjs"]) {
    if (!existsSync(join(dir, t))) continue;
    const r = await run(process.execPath, [t], { cwd: dir, timeout: 600_000 });
    if (!r.ok) return { ok: false, step: "test", log: `${t}\n${r.out}`.slice(-2000) };
  }
  return { ok: true };
}
