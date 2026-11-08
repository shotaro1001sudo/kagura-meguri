// 管理者用ページの操作を、サイトに反映する: 確認のビルド → 開催データだけをコミット → push
// GitHub 側に、週次の自動収集などの新しいコミットがあるときは、取り込んでから push し直す。
import { execFile } from "node:child_process";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// 却下した保留(rejected.json)も送る(週次の自動収集が、GitHub 上で同じものを取り直さないように)
// 協賛のページのアクセスの概数(media-stats.json。週次の分析タスクが scripts/media-stats.mjs で作る。丸めた数字だけ)も、ここから公開する
const DATA = ["data/events.json", "data/geocache.json", "data/rejected.json", "data/media-stats.json"];

// 公開前に走らせる、開催データを確かめるテスト(package.json の test:data と同じもの)。
// GitHub の公開処理は npm test(この6本 + tests/run.mjs)が通らないと公開しないので、データで落ちるものはここで止める。
export const DATA_TESTS = ["keichiku-events", "social-evidence", "held-review", "tokyo-events", "collection-172", "national-sources"].map((t) => `tests/${t}.mjs`);

function run(cmd, args, opts) {
  return new Promise((resolve) => {
    execFile(cmd, args, { encoding: "utf8", maxBuffer: 8 << 20, timeout: 120_000, ...opts }, (err, stdout, stderr) =>
      resolve({ ok: !err, code: err?.code ?? 0, out: `${stdout ?? ""}${stderr ?? ""}`.trim() }));
  });
}

/** git の場所(PATH になければ、Windows の標準のインストール先) */
export function findGit() {
  if (process.platform !== "win32") return "git";
  const std = ["C:\\Program Files\\Git\\cmd\\git.exe", "C:\\Program Files\\Git\\bin\\git.exe"].find(existsSync);
  return std ?? "git";
}

/**
 * 開催データに、まだサイトへ反映していない変更があるか(未コミット、または未 push)。
 * 未 push は、開催データを変えたコミットだけを数える(Claude のコードの変更は、プッシュの指示を待つため、ここでは数えない)
 */
export async function pendingChanges(root, git = findGit()) {
  const g = (...a) => run(git, a, { cwd: root, env: { ...process.env, GIT_TERMINAL_PROMPT: "0" } });
  const st = await g("status", "--porcelain", "--", ...DATA);
  const ahead = await g("rev-list", "--count", "@{u}..HEAD", "--", ...DATA);
  return { uncommitted: st.ok && st.out.length > 0, unpushed: ahead.ok ? Number(ahead.out) || 0 : 0 };
}

/**
 * 定期の更新: GitHub の最新(週次の自動収集・振り返り・Claude の作業の公開など)を、いつものフォルダに取り込む。
 * main にいて、開催データに未コミットの変更がなく、早送りで済むときだけ(作業中のものには触らない)
 */
export async function syncMain(root, git = findGit()) {
  const g = (...a) => run(git, a, { cwd: root, env: { ...process.env, GIT_TERMINAL_PROMPT: "0" } });
  const f = await g("fetch", "-q", "origin");
  if (!f.ok) return { ok: false, text: `GitHub に接続できませんでした(${f.out.split("\n")[0].slice(0, 120)})` };
  if ((await g("symbolic-ref", "--short", "HEAD")).out !== "main") return { ok: false, text: "main 以外のブランチにいるため、取り込みませんでした" };
  const behind = Number((await g("rev-list", "--count", "HEAD..origin/main")).out) || 0;
  if (!behind) return { ok: true, text: "最新です" };
  if ((await g("status", "--porcelain", "--", ...DATA)).out) return { ok: false, text: `GitHub に新しい変更が ${behind} 件ありますが、開催データに送っていない変更があるため、取り込みませんでした(「もう一度公開する」で取り込みます)` };
  const m = await g("merge", "--ff-only", "-q", "origin/main");
  return m.ok ? { ok: true, text: `GitHub の新しい変更を ${behind} 件取り込みました`, pulled: behind }
    : { ok: false, text: `GitHub の新しい変更を取り込めませんでした(このPCに、送っていないコミットか、重なる作業中のファイルがあります)` };
}

/** 最近のコミットのメッセージに書かれた改善案の ID(検索 SEO-日付-番号、計測 MEAS-日付-番号)。実施したかの目安に使う(判定は週次の分析タスク) */
export async function mentionedIds(root, git = findGit()) {
  const r = await run(git, ["log", "--since=120.days", "--format=%s%n%b"], { cwd: root, env: { ...process.env, GIT_TERMINAL_PROMPT: "0" } });
  return r.ok ? [...new Set(r.out.match(/\b(?:SEO|MEAS)-\d{8}-\d+\b/g) ?? [])] : [];
}

/** GitHub のリポジトリの画面の URL(Issue・Actions へのリンクに使う)。GitHub 以外なら空 */
export async function repoWebUrl(root, git = findGit()) {
  const r = await run(git, ["remote", "get-url", "origin"], { cwd: root });
  const m = r.ok && r.out.match(/github\.com[/:]([\w.-]+)\/([\w.-]+?)(?:\.git)?$/);
  return m ? `https://github.com/${m[1]}/${m[2]}` : "";
}

/**
 * 開催データをコミットして push する。返り値の ok が false なら、step(build / test / commit / push)と log で理由を示す。
 * データの保存は済んでいるので、失敗しても、あとで「もう一度公開する」でやり直せる。
 */
export async function publish(root, message, { git = findGit(), check = true } = {}) {
  const env = { ...process.env, GIT_TERMINAL_PROMPT: "0" };
  const g = (...a) => run(git, a, { cwd: root, env });

  // 1. 公開前の確認: サイトを作れるか、開催データのテストが通るか(GitHub の公開処理で落ちるデータを送らない)
  if (check) {
    const out = mkdtempSync(join(tmpdir(), "kagura-admin-"));
    const b = await run(process.execPath, ["scripts/build.mjs"], { cwd: root, env: { ...process.env, OUT_DIR: out } });
    rmSync(out, { recursive: true, force: true });
    if (!b.ok) return { ok: false, step: "build", log: b.out.slice(-2000) };
    for (const t of DATA_TESTS) {
      if (!existsSync(join(root, t))) continue;
      const r = await run(process.execPath, [t], { cwd: root });
      if (!r.ok) return { ok: false, step: "test", log: `${t}\n${r.out}`.slice(-2000) };
    }
  }

  // 2. 開催データだけをコミット(ほかの作業中のファイルは、巻き込まない)
  const files = DATA.filter((f) => existsSync(join(root, f)));
  const st = await g("status", "--porcelain", "--", ...files);
  if (!st.ok) return { ok: false, step: "commit", log: st.out };
  if (st.out) {
    const c = await g("commit", "-m", message, "--", ...files);
    if (!c.ok) return { ok: false, step: "commit", log: c.out };
  }

  // 3. push。GitHub 側が先に進んでいたら、取り込んでから、もう一度
  let p = await g("push");
  if (!p.ok && /rejected|fetch first|non-fast-forward/i.test(p.out)) {
    const pull = await g("pull", "--rebase", "--autostash");
    if (!pull.ok) {
      await g("rebase", "--abort");
      return { ok: false, step: "push", log: `GitHub 側の変更と、内容が重なりました。コミットは、このPCに残っています。\n${pull.out}` };
    }
    p = await g("push");
  }
  if (!p.ok) return { ok: false, step: "push", log: p.out };
  const head = await g("rev-parse", "--short", "HEAD");
  return { ok: true, commit: head.out, committed: !!st.out };
}
