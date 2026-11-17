/**
 * 神楽めぐり｜サイトの毎日の公開を、深夜2〜3時(日本時間)に起動する
 *
 * なぜ: GitHub の予定実行(deploy.yml の cron、3:00)は、2026-11-08 ごろから毎日3〜7時間遅れ、
 * 公開が朝〜昼になっていた(運営者の依頼 2026-11-17「深夜2、3時あたりにしたい」)。
 * Apps Script の時刻の起動は、決めた1時間の中で動くので、ここから公開のワークフローを起動する。
 * deploy.yml の予定実行は、ここが動かなかった日の予備として残す(その日すでに公開済みなら、何もしない)。
 *
 * 設置先: 統合管理台帳の Apps Script(既存のプロジェクトに、このファイルを足す)
 * ※このソースにトークンを貼り付けないこと。
 * Project Settings > Script properties に KAGURA_GITHUB_DISPATCH_TOKEN を本人が登録する
 *   (GitHub の fine-grained token。対象はこのリポジトリだけ、権限は Actions の Read and write だけ)。
 * 初回は本人が triggerKaguraNightlyDeploy() を手動で実行し、GitHub で公開が動いたのを確かめてから、
 * installKaguraNightlyDeployTrigger() を手動で実行して、毎日の起動を有効にする。
 * 起動に失敗したときは例外で止まり、Apps Script の失敗の通知メールが届く(その日は予備の予定実行が公開する)。
 */
const KAGURA_NIGHTLY_DEPLOY = Object.freeze({
  URL: "https://api.github.com/repos/shotaro1001sudo/kagura-meguri/actions/workflows/deploy.yml/dispatches",
  REF: "main",
  TOKEN_PROPERTY: "KAGURA_GITHUB_DISPATCH_TOKEN",
  LAST_SUCCESS_PROPERTY: "KAGURA_NIGHTLY_DEPLOY_LAST_SUCCESS",
  HANDLER: "triggerKaguraNightlyDeploy",
  HOUR: 2, // 2:00〜3:00 のどこかで動く(Apps Script の時刻の起動は、1時間の幅で決まる)
  ATTEMPTS: 3, // GitHub 側の一時的な失敗(5xx・429)だけ、間をあけてやり直す
  WAIT_MS: 30000,
});

function kaguraNightlyFailure_(code) {
  const error = new Error("NIGHTLY_DEPLOY_" + code);
  error.name = "KaguraNightlyDeployError";
  return error;
}

/** 公開のワークフロー(deploy.yml)を1回起動する。トークンも応答の中身も、記録に出さない。 */
function triggerKaguraNightlyDeploy() {
  const props = PropertiesService.getScriptProperties();
  const token = props.getProperty(KAGURA_NIGHTLY_DEPLOY.TOKEN_PROPERTY);
  if (!token) throw kaguraNightlyFailure_("TOKEN_MISSING");
  let code = 0;
  for (let attempt = 1; attempt <= KAGURA_NIGHTLY_DEPLOY.ATTEMPTS; attempt++) {
    if (attempt > 1) Utilities.sleep(KAGURA_NIGHTLY_DEPLOY.WAIT_MS * (attempt - 1));
    const response = UrlFetchApp.fetch(KAGURA_NIGHTLY_DEPLOY.URL, {
      method: "post",
      contentType: "application/json",
      payload: JSON.stringify({ ref: KAGURA_NIGHTLY_DEPLOY.REF }),
      headers: {
        Authorization: "Bearer " + token,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
      muteHttpExceptions: true,
      followRedirects: false,
    });
    code = response.getResponseCode();
    if (code === 204 || code === 200) {
      const at = Utilities.formatDate(new Date(), "Asia/Tokyo", "yyyy-MM-dd HH:mm");
      props.setProperty(KAGURA_NIGHTLY_DEPLOY.LAST_SUCCESS_PROPERTY, at);
      console.log("NIGHTLY_DEPLOY_DISPATCHED; at=" + at + "; attempt=" + attempt);
      return { status: "dispatched", at: at };
    }
    // 401(トークンの期限切れ・誤り)・403(権限不足)・404・422 は、やり直しても同じなので止める
    if (code < 500 && code !== 429) break;
  }
  throw kaguraNightlyFailure_("HTTP_" + code);
}

/** 本人が、手動の起動が1回成功したあとに実行する。毎日 2:00〜3:00(日本時間)に起動する。 */
function installKaguraNightlyDeployTrigger() {
  const props = PropertiesService.getScriptProperties();
  if (!props.getProperty(KAGURA_NIGHTLY_DEPLOY.TOKEN_PROPERTY)) throw kaguraNightlyFailure_("TOKEN_MISSING");
  if (!props.getProperty(KAGURA_NIGHTLY_DEPLOY.LAST_SUCCESS_PROPERTY)) throw kaguraNightlyFailure_("FIRST_MANUAL_RUN_REQUIRED");
  const existing = ScriptApp.getProjectTriggers().filter((t) => t.getHandlerFunction() === KAGURA_NIGHTLY_DEPLOY.HANDLER);
  if (existing.length > 1) throw kaguraNightlyFailure_("DUPLICATE_TRIGGERS_REVIEW_REQUIRED");
  if (existing.length === 1) return { status: "already_installed" };
  ScriptApp.newTrigger(KAGURA_NIGHTLY_DEPLOY.HANDLER).timeBased().inTimezone("Asia/Tokyo").atHour(KAGURA_NIGHTLY_DEPLOY.HOUR).everyDays(1).create();
  return { status: "installed", schedule: "02:00-03:00 Asia/Tokyo; approximate" };
}
