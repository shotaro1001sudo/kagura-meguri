// 管理者用ページの操作を、サイトに反映する: 確認のビルド → 開催データだけをコミット → push
// GitHub 側に、週次の自動収集などの新しいコミットがあるときは、取り込んでから push し直す。
import { execFile } from "node:child_process";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const DATA = ["data/events.json", "data/geocache.json"];

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

/** 開催データに、まだサイトへ反映していない変更があるか(未コミット、または未 push) */
export async function pendingChanges(root, git = findGit()) {
  const g = (...a) => run(git, a, { cwd: root, env: { ...process.env, GIT_TERMINAL_PROMPT: "0" } });
  const st = await g("status", "--porcelain", "--", ...DATA);
  const ahead = await g("rev-list", "--count", "@{u}..HEAD");
  return { uncommitted: st.ok && st.out.length > 0, unpushed: ahead.ok ? Number(ahead.out) || 0 : 0 };
}

/**
 * 開催データをコミットして push する。返り値の ok が false なら、step(build / commit / push)と log で理由を示す。
 * データの保存は済んでいるので、失敗しても、あとで「もう一度公開する」でやり直せる。
 */
export async function publish(root, message, { git = findGit(), check = true } = {}) {
  const env = { ...process.env, GIT_TERMINAL_PROMPT: "0" };
  const g = (...a) => run(git, a, { cwd: root, env });

  // 1. 公開前の確認: サイトを作れるか(壊れたデータを公開しない)
  if (check) {
    const out = mkdtempSync(join(tmpdir(), "kagura-admin-"));
    const b = await run(process.execPath, ["scripts/build.mjs"], { cwd: root, env: { ...process.env, OUT_DIR: out } });
    rmSync(out, { recursive: true, force: true });
    if (!b.ok) return { ok: false, step: "build", log: b.out.slice(-2000) };
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
