# バリューコマース：非公開収益集計の設定（追加費用・機密情報漏えい防止）

2026-10-21：利用者がAPI鍵再発行とGitHub Secrets登録、手動API接続テスト成功を報告。
[公式トークン](https://pub-docs.valuecommerce.ne.jp/docs/as-77-token-api/) / [公式注文別レポート](https://pub-docs.valuecommerce.ne.jp/docs/as-78-order-report-api/)

## データの保存方針
- レポートAPIから取得するのは注文ID・注文日時・状態・報酬額・サイトID・更新日時のみ。詳細商品/ユーザー情報は要求しない。
- 注文データ・トークン・秘密鍵を **GitHub（公開Repo、Issue、Actionsログ、Artifact、Pages）へ一切保存しない**。Node.jsのプロセスメモリだけで月次集計し、**共有なしの非公開Google Sheets**「神楽めぐり｜統合管理台帳・チーム連携ダッシュボード」の「11_VC月次成果」へ状態別の件数・報酬合計だけを送信。
- ステータスは P（保留）、A（承認）、C（拒否）、I（請求済）。Iを「入金済み」と解釈しない。AとIの参考報酬額も実際の売上/純利益への確定計上に使わない。実際の銀行入金・支払額はASP管理画面の「サイト別支払レポート」で照合。
- 25か月（月単位、API公式参照期限まで）を毎回再取得し、注文IDと更新日時で重複排除。照会ページングが途中で失敗、金額が不明、認証不可なら**一切書き込まない**。月ごと上限8ページ、25か月×最大8回=200注文APIリクエスト/実行（公式上限900/30分以内）。
- Sheetの「11_VC月次成果」A2:N26は自動同期専用。手動上書き厳禁。07_収益・経費の売上・純利益は支払証憑と経費が確定するまで手動照合を維持する。
- リポジトリへのHTTP変更、ASP申請、外部へのメール・SNS投稿等の副作用はない。

## 必要な追加設定（本人がGoogle Cloud / Google Sheets / GitHubで行う）
**Google Cloudプロジェクトの追加有料契約や課金アカウント紐付けはしない。** 既存の無料で使えるプロジェクトがある場合のみ、Google Sheets APIを有効化。プロジェクトがなければ費用条件を確認するまで止める。

1. [Google Cloudのサービスアカウント](https://console.cloud.google.com/iam-admin/serviceaccounts)でSheets書き込み専用のサービスアカウントを作る。APIを有効にする。組織ポリシーで鍵作成禁止なら回避せず中止。
2. そのサービスアカウントのJSONキーを安全に作成し、GitHubのRepository secretsに**`GOOGLE_SHEETS_SERVICE_ACCOUNT_JSON`**という名前でJSON全文を保存。**チャット、Google Docs、GitHubのコード、Issue、スクリーンショットに貼らない**。JSONファイルを公開リポジトリへアップロードしない。
3. GitHub Secrets設定後、ローカルに保存したJSON鍵は安全に保管し、不用意にコピーを残さない。
4. [非公開統合台帳](https://docs.google.com/spreadsheets/d/13wwhjxbh9SH0xMXpd8uhNGgiCTv6gJ52qEBNMB-x8vY/edit)をサービスアカウントのメールアドレス（`...iam.gserviceaccount.com`）と**編集者**として個別共有。リンクを知る全員への公開や組織全体への共有をしない。サービスアカウントはアクセス対象スプレッドシート以外に共有しない。
5. 最初の手動テストは[ValueCommerce private Sheets sync](https://github.com/shotaro1001sudo/kagura-meguri/actions/workflows/valuecommerce-private-sheets-sync.yml)のRun workflow→mainで1回のみ。
6. [11_VC月次成果タブ](https://docs.google.com/spreadsheets/d/13wwhjxbh9SH0xMXpd8uhNGgiCTv6gJ52qEBNMB-x8vY/edit)に月次26行が埋まり、値・状態・取得日時に異常がないことと、07_収益・経費のC・Dが勝手に更新されていないことを確認する。成果データに誤りがあれば自動化せず調査する。

## 次の工程（初回手動成功後）
- API利用条件/Sheetsクォータ/利用料金0円が確実と確認できたら「1日1回」だけ定期化。ChatGPTの2時間おきマネタイズ調査タスクは集計値の参照だけを行い、APIの多重アクセスはしない。
- 08_チームタスク・00_全体ダッシュボード・07_収益・経費に検証結果を反映する際は、確認状態と根拠を厳密に記録する。

※ Googleは、ユーザー管理のサービスアカウント鍵をセキュリティリスクと位置づけている。長期的にはWorkload Identity Federationなどの鍵不要方式へ切り替えることを推奨。費用と設定の条件が整うまでは連携を起動しない。
