// GitHub Actions -> public, evidence-only team handoff.
// Never contains credentials, order details, affiliate payouts, or personal analytics.
import { readFileSync, appendFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

export function isUserFacingChange(file) {
  if (typeof file !== "string" || file.includes("\u0000")) return false;
  return /^(?:data\/(?:events|regular)\.json|scripts\/build\.mjs|scripts\/client\/.+|(?:src|site|public|assets|styles|templates|pages)\/.+|(?:index|style|app)(?:\.[a-z0-9_-]+)*\.(?:html|css|js)|[^/]+\.(?:html|css))$/.test(file);
}

export function classifyHandoff({event, repoName, changedFiles = []}) {
  const r = event?.workflow_run;
  if (!r || typeof repoName !== "string" || !/^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/.test(repoName)) return null;
  if (r.name !== "build-and-deploy" || r.head_branch !== "main" ||
      r.head_repository?.full_name !== repoName ||
      !Number.isSafeInteger(r.id) || !/^[0-9a-f]{40}$/i.test(r.head_sha || "")) return null;
  const link = "https://github.com/" + repoName + "/actions/runs/" + r.id;
  const sha = r.head_sha.toLowerCase();
  const kind = r.event;
  if (r.conclusion === "failure" || r.conclusion === "timed_out") {
    return {
      kind: "failure",
      title: "【公開処理エラー】GitHub Actions #" + r.id,
      body: [
        "### 神楽めぐり・公開処理の失敗通知",
        "公開処理が " + r.conclusion + " で終了。実際の公開/表示は成功と判定しません。",
        "- 実行: " + link,
        "- コミット: " + sha,
        "- 発火イベント: " + (["schedule","push","workflow_dispatch"].includes(kind) ? kind : "other"),
        "- 担当: サイト改修。ログとPR/コミットを確認し、費用ゼロの範囲で原因切り分け。再実行・課金・強制マージは自動で行いません。",
        "- 影響: 公開サイトの状態は別途確認が必要です。",
      ].join("\n"),
    };
  }
  // 公開成功の引継ぎIssue(【集客引継ぎ・公開処理成功】)は、2026-11-07に廃止。失敗のときだけ知らせる
  return null;
}

export function writeGitHubOutput(result, outputPath) {
  if (!outputPath) return;
  if (!result) {
    appendFileSync(outputPath,"handoff=false\n");
    return;
  }
  const marker = "KAGURA_" + result.kind.replaceAll("-","_").toUpperCase() + "_END";
  appendFileSync(outputPath, [
    "handoff=true",
    "kind=" + result.kind,
    "title=" + result.title,
    "body<<" + marker,
    result.body,
    marker,
    "",
  ].join("\n"));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const raw = JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH, "utf8"));
  const changed = process.env.HANDOFF_CHANGED_FILES_FILE ? readFileSync(process.env.HANDOFF_CHANGED_FILES_FILE,"utf8") : (process.env.HANDOFF_CHANGED_FILES || "");
  const files = changed.split("\n").map(s=>s.trim()).filter(Boolean);
  const result = classifyHandoff({event:raw,repoName:process.env.GITHUB_REPOSITORY,changedFiles:files});
  writeGitHubOutput(result,process.env.GITHUB_OUTPUT);
  if(process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY,
    result ? "引継ぎ候補: " + result.kind + "。公開Issueに根拠のみ記録します。視覚確認は別工程。\n"
      : "新規の引き継ぎ対象なし。通知を作成しません。\n");
}
