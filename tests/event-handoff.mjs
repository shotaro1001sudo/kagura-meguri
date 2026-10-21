import { readFileSync } from "node:fs";
import { parse } from "yaml";
import { classifyHandoff, isUserFacingChange } from "../scripts/handoff/event-router.mjs";

export function eventHandoffTests({ok,section}) {
  section("イベント駆動: 公開成功・失敗の安全な引き継ぎ");
  const repoName="shotaro1001sudo/kagura-meguri", sha="a".repeat(40);
  const baseline = {
    workflow_run: {
      name:"build-and-deploy",head_branch:"main",
      head_repository:{full_name:repoName},
      head_sha:sha,event:"push",id:12345,conclusion:"success",
    },
  };
  ok(isUserFacingChange("data/events.json") &&
     isUserFacingChange("scripts/client/ga4-consent.js") &&
     isUserFacingChange("styles/main.css") &&
     !isUserFacingChange("docs/monetization-private.md") &&
     !isUserFacingChange(".github/workflows/valuecommerce-private-sheets-sync.yml"),
     "表示関連の変更だけを通知対象にし、報酬・設定ファイルを除外");
  const safe=classifyHandoff({event:baseline,repoName,changedFiles:["scripts/client/ga4-consent.js","docs/monetization-private.md"]});
  ok(safe?.kind==="publication-evidence" &&
     safe.title.includes(sha.slice(0,12)) &&
     safe.body.includes("https://github.com/"+repoName+"/actions/runs/12345") &&
     safe.body.includes("実表示") &&
     !safe.body.includes("monetization-private") &&
     safe.body.includes("実表示確認前の新機能告知は禁止"),"公開成功で引き継ぎを発行し、表示未検証を区別");
  ok(classifyHandoff({event:baseline,repoName,changedFiles:["docs/valuecommerce-gas-no-cloud.md"]})===null,
     "内部ドキュメント変更時に不要な告知を作らない");
  const noSchedule=JSON.parse(JSON.stringify(baseline)); noSchedule.workflow_run.event="schedule";
  ok(classifyHandoff({event:noSchedule,repoName,changedFiles:["data/events.json"]})===null,
     "毎日の時間駆動ビルドは公開引継ぎを作らない");
  const failure=JSON.parse(JSON.stringify(baseline));failure.workflow_run.conclusion="failure";failure.workflow_run.event="schedule";
  const failed=classifyHandoff({event:failure,repoName,changedFiles:[]});
  ok(failed?.kind==="failure"&&failed.title.includes("#12345")&&failed.body.includes("成功と判定しません"),
     "定期実行での公開エラーでも一度だけエラー用Issueを生成可能");
  const foreign=JSON.parse(JSON.stringify(baseline));foreign.workflow_run.head_repository.full_name="outside/attacker";
  ok(classifyHandoff({event:foreign,repoName,changedFiles:["data/events.json"]})===null,
     "フォーク由来のイベントを除外");
  const wrongBranch=JSON.parse(JSON.stringify(baseline));wrongBranch.workflow_run.head_branch="feature-x";
  ok(classifyHandoff({event:wrongBranch,repoName,changedFiles:["data/events.json"]})===null,
     "main以外の実行を除外");
  const config=parse(readFileSync(".github/workflows/team-handoff-after-publish.yml","utf8"));
  ok(config.on.workflow_run.workflows[0]==="build-and-deploy"&&config.on.workflow_run.types.includes("completed") &&
     !config.on.schedule && config.permissions.issues==="write" &&
     config.jobs.route.timeout_minutes===undefined && config.jobs.route["timeout-minutes"]===3,
     "無料のGitHub Actions上でデプロイ完了時のみ起動し、短時間で終了");
  ok(!readFileSync(".github/workflows/team-handoff-after-publish.yml","utf8").includes("VALUECOMMERCE_CLIENT_SECRET"),
     "公開Issueへの連携ではASP秘密鍵を参照しない");
}
