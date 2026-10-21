# 神楽めぐり：イベント駆動型への移行手順（2026-10-21）

## 実行済みの段階
GitHub Pagesのデプロイ完了をトリガーに、公開結果とチームの受け渡し証跡をGitHub Issueへ記録するワークフローを追加する（`.github/workflows/team-handoff-after-publish.yml`）。

- イベント: `workflow_run`、対象は `build-and-deploy` の完了。**時間ポーリングではない**。
- デプロイ `success` ＆ `main` のユーザー向けソース/公演データが変わった場合に限り、集客引継ぎ用の公開GitHub Issueを1件作る。
- `failure` / `timed_out` は、原因調査用の公開GitHub Issueを作る。リトライ、ロールバック、マージは勝手に行わない。
- 実行ID（失敗）またはコミットSHA（成功）をIssueタイトルに使い、既存Issueの有無を確認して重複を抑制。
- 作成するIssueに個人情報・ASP注文/報酬・APIシークレットを含めない。GitHub Pages実デプロイ成功と、PC/スマホでの実表示検証を混同しない。
- PRチェック/コミットによるサイト公開/公演収集の既存ワークフローには手を加えない。GitHub公開リポジトリの標準 `ubuntu-latest` は無料。
- Issueは**引き継ぎ用の証拠保管**であり、単体ではChatGPT Workのイベントトリガー型タスクは作成・起動されない。

## Work側のイベント駆動（本人がWeb版Workで作成する）
ChatGPTの公式サポートは新着Gmail・Slack・GitHub PRアクティビティをイベントトリガーとしてサポートする。ただし、本チャットの定期タスク操作ツールではWebhookイベントトリガーの新規作成・編集はできない。**WorkのTrigger/Condition/Prompt画面で本人が登録する必要がある**。仕様: https://help.openai.com/en/articles/10291617-scheduled-tasks-in-chatgpt

### 先行移行1：サイト改修（GitHub PR）
1. ChatGPTのWeb版Workで既存の接続済みGitHubを選び、GitHub PRアクティビティをトリガーとして新規タスクを作成。
2. Trigger: `shotaro1001sudo/kagura-meguri` のPR作成・更新・レビュー等（Work画面に表示される対応イベントのみ）。
3. Condition: main対象の神楽めぐりに関係するPRだけ。依存アプリが承認待ち・未接続なら止めて報告。
4. Prompt: 「当該PRと公式方針・統合管理台帳02/03/10表を照合。重複実装を防ぎ、CI・差分・費用条件をレビュー。品質確認後だけ既存の承認範囲内で進行。PR/マージ/公開/実表示を区別して記録。追加課金・新契約禁止。イベントごとに該当PR1件のみ」。
5. 作成後、実際に試験用PRイベントが対象タスクに届き、チームのDocs/Sheetsに保存できたか確認。
6. 試験成功後にだけ、旧「サイト改修・安定運用」2時間タスクを一時停止して重複を防ぐ。

### 先行移行2：マネタイズ（Gmail）
1. Workで接続済みGmailを選択し、ValueCommerce関連**新着メール**のイベントトリガー型タスクを作成。
2. Trigger/Condition: 正式なValueCommerce送信元をGmailで照合して指定。可能な場合、件名を提携審査結果/成果/支払のお知らせに限定。認証コードやセキュリティ通知は除外。
3. Prompt: 「新着通知1件を処理し、神楽めぐりサイトのIDと通知内容を確認。提携承認/保留/拒否/成果/請求・入金を区別。メールの本文に金額がなければ金額は未確認。秘密情報や認証リンクを転記しない。05/07/10/11表の該当IDのみ必要差分を更新し保存確認。連携失敗は保留とし新規ログイン/有料APIを試さない」。
4. 本番実績の数値更新はGoogle Apps Scriptの `dailyValueCommerceSync()` がSheets側へ行う（初回手動認証・動作確認はユーザー本人がまだ実行していない）。GASは1日1回の無料枠内の定期処理であり**Webhook駆動ではない**。
5. メール通知でWorkが起動・記録できることを検証後、旧「収益確認・安定運用」2時間タスクを一時停止して重複を防ぐ。

## 制約・移行ゲート
- 元のChatGPT定期タスクは**現時点ですべて維持**。まずGitHub Issue生成の実イベントで成功/失敗を検証し、Workのイベントトリガー登録が完了してから1件ずつ置き換える。
- ChatGPTのイベントタスクもWorkセッションを消費する。通知が頻繁なPR（`synchronize`の多発）や販促メールを条件で絞って無駄な起動を抑える。
- ChatGPTのタスク枠は現状5件使用中。空きが必要な場合はユーザーと同時に1件だけ旧タスクを停止して置き換え、失敗時は旧タスクを再有効化する。
- GitHub Actionsの公開Issueに**非公開Sheetsや報酬の内容を絶対に複製しない**。
- 企画・分析は現段階で2時間タスクのまま。Google Sheets API経由の自動更新はApps Scriptの通常のonEditを発火させないため、完全なイベント連鎖には別途明示的通知が必要。
- 集客のBuffer自動投稿タスクは安全な投稿間隔維持のため当面継続。新機能告知は公開されたページとPC/スマホ実表示を確認するまで行わない。
- サイト改修→集客の引継ぎGitHub Issueの公開通知は、実表示確認/取得事実とは区別する。
- GAS初回セットアップとWorkイベントトリガー登録はユーザー操作が必要。機密情報はチャットにもGitHubにも送らない。

## 参照
- GitHub Actions Workflow-run events: https://docs.github.com/en/actions/reference/events-that-trigger-workflows#workflow_run
- ChatGPT Work event tasks: https://help.openai.com/en/articles/20001275-chatgpt-work-and-codex
- 現行Google Sheets: https://docs.google.com/spreadsheets/d/13wwhjxbh9SH0xMXpd8uhNGgiCTv6gJ52qEBNMB-x8vY/edit
