// 毎日の公開を深夜(2:00〜3:00 JST)に起動する Apps Script と、予備の予定実行(deploy.yml の gate)のテスト。
// GitHub の予定実行が毎日3〜7時間遅れるようになったため(2026-11-08 ごろから)、起動を Apps Script に移した。
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import YAML from "yaml";

const SOURCE = "scripts/apps-script/nightly-deploy-trigger.gs";

// Apps Script の環境をまねて、起動の関数を動かす
function sandbox({ token = "github_pat_example", codes = [204], lastSuccess = null, triggers = [] } = {}) {
  const props = new Map(Object.entries({ KAGURA_GITHUB_DISPATCH_TOKEN: token, KAGURA_NIGHTLY_DEPLOY_LAST_SUCCESS: lastSuccess }).filter(([, v]) => v != null));
  const fetches = [], sleeps = [], logs = [], created = [];
  const queue = [...codes];
  const builder = { spec: {} };
  const chain = {
    timeBased: () => chain,
    inTimezone: (tz) => { builder.spec.tz = tz; return chain; },
    atHour: (h) => { builder.spec.hour = h; return chain; },
    everyDays: (d) => { builder.spec.days = d; return chain; },
    create: () => { created.push({ ...builder.spec }); return {}; },
  };
  const context = {
    Date, JSON, Object, Error,
    console: { log: (s) => logs.push(String(s)), error: (s) => logs.push(String(s)) },
    PropertiesService: { getScriptProperties: () => ({ getProperty: (k) => props.get(k) ?? null, setProperty: (k, v) => props.set(k, v) }) },
    Utilities: {
      sleep: (ms) => sleeps.push(ms),
      formatDate: (d, tz) => d.toLocaleString("sv-SE", { timeZone: tz, hour12: false }).slice(0, 16),
    },
    UrlFetchApp: { fetch: (url, params) => { fetches.push({ url, params }); const c = queue.length > 1 ? queue.shift() : queue[0]; return { getResponseCode: () => c, getContentText: () => "{}" }; } },
    ScriptApp: {
      getProjectTriggers: () => triggers.map((h) => ({ getHandlerFunction: () => h })),
      newTrigger: (h) => { builder.spec = { handler: h }; return chain; },
    },
  };
  runInNewContext(readFileSync(SOURCE, "utf8"), context);
  const call = (name) => { try { return { result: runInNewContext(`${name}()`, context) }; } catch (e) { return { error: e.message }; } };
  return { call, fetches, sleeps, logs, created, props };
}

export function nightlyDeployTests({ ok, section }) {
  section("毎日の公開: 深夜2〜3時に Apps Script から起動する");
  const src = readFileSync(SOURCE, "utf8");
  ok(!/github_pat_|ghp_[A-Za-z0-9]{20}/.test(src) && /getProperty\(KAGURA_NIGHTLY_DEPLOY\.TOKEN_PROPERTY\)/.test(src), "トークンはソースに書かず、Script properties から読む");
  ok(!/(^|\s)(eval|fetch)\s*\(/.test(src), "危険な eval や汎用の fetch を使わない");

  {
    const s = sandbox();
    const r = s.call("triggerKaguraNightlyDeploy");
    const f = s.fetches[0];
    ok(r.result?.status === "dispatched" && s.fetches.length === 1, "成功(204)なら1回だけ起動する");
    ok(f?.url === "https://api.github.com/repos/shotaro1001sudo/kagura-meguri/actions/workflows/deploy.yml/dispatches" && f.params.method === "post" && JSON.parse(f.params.payload).ref === "main", "起動するのは、このリポジトリの公開のワークフロー(main)");
    ok(f?.params.headers.Authorization === "Bearer github_pat_example" && f.params.muteHttpExceptions === true && f.params.followRedirects === false, "トークンはヘッダーで送り、転送はたどらない");
    ok(!!s.props.get("KAGURA_NIGHTLY_DEPLOY_LAST_SUCCESS") && s.logs.every((l) => !l.includes("github_pat_example")), "成功の日時を残し、トークンは記録に出さない");
  }
  {
    const s = sandbox({ codes: [502, 204] });
    const r = s.call("triggerKaguraNightlyDeploy");
    ok(r.result?.status === "dispatched" && s.fetches.length === 2 && s.sleeps.length === 1, "GitHub 側の一時的な失敗(5xx)は、間をあけてやり直す");
  }
  {
    const s = sandbox({ codes: [503] });
    const r = s.call("triggerKaguraNightlyDeploy");
    ok(r.error === "NIGHTLY_DEPLOY_HTTP_503" && s.fetches.length === 3 && !s.props.get("KAGURA_NIGHTLY_DEPLOY_LAST_SUCCESS"), "やり直しは3回まで。それでも失敗なら止まって知らせる(成功の記録は残さない)");
  }
  {
    const s = sandbox({ codes: [401] });
    const r = s.call("triggerKaguraNightlyDeploy");
    ok(r.error === "NIGHTLY_DEPLOY_HTTP_401" && s.fetches.length === 1, "トークンの期限切れ・誤り(401)は、やり直さずに止まる");
  }
  {
    const s = sandbox({ token: null });
    const r = s.call("triggerKaguraNightlyDeploy");
    ok(r.error === "NIGHTLY_DEPLOY_TOKEN_MISSING" && s.fetches.length === 0, "トークンが無ければ、何も送らずに止まる");
  }

  section("毎日の公開: 深夜の起動の設定(本人が手動で有効にする)");
  {
    const s = sandbox();
    ok(s.call("installKaguraNightlyDeployTrigger").error === "NIGHTLY_DEPLOY_FIRST_MANUAL_RUN_REQUIRED" && s.created.length === 0, "手動の起動が1回成功するまでは、毎日の起動を作らない");
  }
  {
    const s = sandbox({ lastSuccess: "2026-11-17 23:50" });
    const r = s.call("installKaguraNightlyDeployTrigger");
    const t = s.created[0];
    ok(r.result?.status === "installed" && s.created.length === 1 && t.handler === "triggerKaguraNightlyDeploy" && t.tz === "Asia/Tokyo" && t.hour === 2 && t.days === 1, "毎日 2:00〜3:00(日本時間)に起動する");
  }
  {
    const s = sandbox({ lastSuccess: "2026-11-17 23:50", triggers: ["triggerKaguraNightlyDeploy"] });
    ok(s.call("installKaguraNightlyDeployTrigger").result?.status === "already_installed" && s.created.length === 0, "もう有効なら、二重に作らない");
    const d = sandbox({ lastSuccess: "2026-11-17 23:50", triggers: ["triggerKaguraNightlyDeploy", "triggerKaguraNightlyDeploy"] });
    ok(d.call("installKaguraNightlyDeployTrigger").error === "NIGHTLY_DEPLOY_DUPLICATE_TRIGGERS_REVIEW_REQUIRED", "二重にできていたら、止めて見直しを求める");
  }

  section("毎日の公開: GitHub の予定実行は予備(今日公開済みなら何もしない)");
  const dy = YAML.parse(readFileSync(".github/workflows/deploy.yml", "utf8"));
  const gate = dy.jobs.gate;
  ok(dy.on.schedule?.[0]?.cron === "0 18 * * *" && "workflow_dispatch" in dy.on, "予備の予定実行(3:00 JST)と、外部からの起動(workflow_dispatch)の両方がある");
  ok(gate?.if === "${{ github.event_name == 'schedule' }}" && JSON.stringify(gate.permissions) === JSON.stringify({ actions: "read" }) && gate["timeout-minutes"] > 0, "確かめる手順は予定実行のときだけ動き、権限は実行の一覧を読むことだけ");
  const run = gate?.steps?.[0]?.run ?? "";
  ok(/TZ=Asia\/Tokyo date \+%F\) 00:00 \+0900/.test(run) && /--status success/.test(run) && /--created ">=\$since"/.test(run) && /\|\| echo 0/.test(run) && !/\$\{\{/.test(run), "日本時間の今日の0時からの公開の成功を数える。数えられなければ公開する側に倒す");
  ok(dy.jobs.build.needs === "gate" && dy.jobs.build.if === "${{ !cancelled() && needs.gate.outputs.skip != 'true' }}", "組み立てを飛ばすのは、予備で今日公開済みのときだけ(push・手動では必ず組み立てる)");
  ok(dy.jobs.deploy.if === "${{ !cancelled() && needs.build.result == 'success' }}", "公開は、組み立てが成功したときに動く(gate が飛ばされても止まらない)");
  ok(/needs\.deploy\.result == 'success'/.test(dy.jobs.indexnow.if ?? "") && /needs\.build\.outputs\.indexnow_body != ''/.test(dy.jobs.indexnow.if ?? ""), "IndexNow は、公開が成功したあとだけ送る");
}
