# 神楽めぐり：バリューコマース成果レポートAPIの安全な接続手順

## 状態
2026-10-21：利用者は画像掲載後にCLIENT_KEYとCLIENT_SECRETを再発行済みと報告。**新キーの登録・実接続はまだ未確認**。旧キーの文字列をコード・管理台帳・GitHub Issue・ログに残さない。

## 1. 利用者が自分で行う設定（キーの共有は不要）
1. [Repository Secrets画面](https://github.com/shotaro1001sudo/kagura-meguri/settings/secrets/actions)で **New repository secret** を開く。
2. `VALUECOMMERCE_CLIENT_KEY` に再発行後の CLIENT_KEY を設定。
3. `VALUECOMMERCE_CLIENT_SECRET` に再発行後の CLIENT_SECRET を設定。
4. 名前と登録件数だけを確認。値そのものはメッセージや画像で共有しない。GitHub Actions のログでキー/トークン・注文レポートを表示しない。

## 2. 実接続試験（キー保存後に利用者の操作で手動実行）
- [GitHub Actions: valuecommerce-readonly-check](https://github.com/shotaro1001sudo/kagura-meguri/actions/workflows/valuecommerce-readonly-check.yml)を開き、Run workflow を1回だけ起動する（本ワークフローがmainにマージされた後）。
- 内部でトークン取得 GET 1回と、v3注文別レポートの当日データ・limit=1のGET 1回だけ実行。
- 結果表示は「接続成功」または一般化されたエラーのみ。注文番号、成果報酬、Bearerトークン、CLIENT_KEY / CLIENT_SECRET、API応答JSONは出さない。
- これは**接続確認だけ**。収益データの記録、定期実行、サイト更新、契約変更は行わない。

## 3. 次工程：集計先を非公開にしてから日次自動化
- 取得仕様：注文日と処理日を区別し、保留/承認/拒否/請求済の別に記録。重複や処理日変更に対応するため注文IDで照合し、日時・更新日時による差分だけを反映する。税抜/税込と請求・入金額の概念を区別。
- 認証情報と**個別注文・金融データを公開GitHubリポジトリ/Pages/Issues/Actionsログ/Artifactsへ書き込まない**。
- 既存の非公開Google Sheetsへ書くための認証方式と保管場所を別途確定し、アクセス制限と追加料金を確認してから、安全な集計ワークフローを実装。
- 本番自動化は1日1回で開始。2時間ごとのChatGPTマネタイズタスクは台帳を参照するのみで、APIの多重取得を避ける。
- 利用規約・API費用・Actions無料枠・実績保管権限が未検証なら自動取得を有効化しない。

## 公式資料
- トークン: https://pub-docs.valuecommerce.ne.jp/docs/as-77-token-api/
- 注文別レポート: https://pub-docs.valuecommerce.ne.jp/docs/as-78-order-report-api/
- GitHub Secrets: https://docs.github.com/en/actions/how-tos/write-workflows/choose-what-workflows-do/use-secrets
