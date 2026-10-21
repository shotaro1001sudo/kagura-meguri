# ValueCommerce → 神楽めぐり統合Google Sheets｜Google Cloudを自分で作成しない無料枠連携

## なぜこの方式か
- Google Apps Scriptは作成時に「デフォルトCloudプロジェクト」を内部で自動作成する。ユーザー自身でGoogle Cloud Consoleを開き、標準プロジェクト・課金アカウント・サービスアカウント・JSON鍵を作る必要はない。
- 既存の **統合Google Sheet** から「拡張機能 → Apps Script」で実行する。GASにはSpreadsheetAppとUrlFetchAppが組み込みであるため、Google Sheets APIを追加有効化する必要もない。
- 本番サイトやGitHub Actions・公開GitHubの注文データには触れない。既存のGitHub「valuecommerce-private-sheets-sync.yml」は**手動のみで使わない**。両方の収集を同時実行しない。
- GAS標準の個人アカウントのURL Fetch上限は原則20,000回/日、時間トリガー実行の合計上限は90分/日（Googleの変更や個別制限に注意）。今回の設計はトークン1回+月4件を各最大8ページ=1実行最大33リクエストで小規模。GASは一般に1実行6分まで。API実行が上限に近づいたら自動化を停止する。
- 個人の無料Googleアカウントを前提に追加課金の必要な操作なし。Google Cloudの請求先登録・外部サービス契約は行わない。

## ユーザーが操作する手順（キー文字列をチャットやGitHubに貼らない）
1. このシートを開く: https://docs.google.com/spreadsheets/d/13wwhjxbh9SH0xMXpd8uhNGgiCTv6gJ52qEBNMB-x8vY/edit
2. 「拡張機能」→「Apps Script」を開く。ブラウザ版を使用。スマホならパソコン版サイトの表示を推奨。
3. [完成コード](../scripts/apps-script/valuecommerce-sheet-sync.gs) の全文を Apps Script の \`コード.gs\` に貼り付けて保存する。GitHubに掲載したソース内にはAPIキーは含まれていない。
4. Apps Scriptの左「プロジェクトの設定」（歯車）→「スクリプト プロパティ」→2件追加。
   - プロパティ: \`VC_CLIENT_KEY\`、値: 再発行後のバリューコマース CLIENT_KEY
   - プロパティ: \`VC_CLIENT_SECRET\`、値: 再発行後のバリューコマース CLIENT_SECRET
   - **GitHub Secretsには別途設定済みだが、Apps ScriptのScript Propertiesと自動同期されないので、ユーザー本人がここへも登録する。** トークンの値をスクリプトに直書きしない。Script Propertiesは強固な鍵保管庫ではなく、スクリプトの編集権限を持つユーザーから参照できるため、他人に台帳やApps Scriptの編集権限を付与しない。
5. スクリプトエディタで関数 \`dailyValueCommerceSync\` を選択し、「実行」を**1回だけ**押す。権限承認では自分のGoogleアカウントとシートへの編集権限、外部接続について説明を確認する。
6. [統合台帳](https://docs.google.com/spreadsheets/d/13wwhjxbh9SH0xMXpd8uhNGgiCTv6gJ52qEBNMB-x8vY/edit) の「11_VC月次成果」2～26行に取得日・確認状態・P/A/C/I別集計が記録されるか確認。「07_収益・経費」の実売上や入金は**変更しない**。
7. 初回に成功し異常値がなければ、関数 \`createDailyTrigger\` を1回実行。毎日**日本時間の6～7時ごろ**に \`dailyValueCommerceSync\` を自動実行する（日付やGoogle側により多少変動）。
8. 停止する場合は関数 \`stopDailyTrigger\` を手動実行するか、Apps Scriptの「トリガー」画面で該当設定を削除する。

## 集計内容と制限
- 実行ごとに当月と前2か月、さらに過去3～24か月のうち1か月を順番に更新。履歴全体の確認には最大22日程度かかる。注文・金額を返さない「0件」はゼロとして記録するが、未取得の月は**空欄**のまま。
- 対象はバリューコマースサイトID 3784232。別サイトの注文は除外。
- 同じ注文IDの新しい更新レコードを優先して二重計上を防止。P=保留、A=承認、C=拒否、I=請求済。
- 金額が未定義/unknown、取得が途中で失敗、ページングの上限、トークン期限切れでは数字の書込みを止める。履歴の複数日にまたがる修正は巡回で反映。
- API照会上限は注文レポート900正常リクエスト/30分。こちらは最大33/実行（token1＋4か月×8ページ）。月1日はAPI側のデータ更新が遅れる場合がある。
- **請求済み≠銀行入金済み。** バリューコマースの公式「サイト別支払レポート」で支払額と税額を照合しない限り、「07_収益・経費」に実売上・純利益を推定計上しない。
- Google Sheets自体を誰でも閲覧可能にしない。Script Propertiesはスクリプト編集者が参照できるため、権限は所有者だけにする。ログにキー・トークン・注文明細・合計額を出力しない。コードを改変する場合はレビューする。

## 既存のGithub方式との比較

| | 今回おすすめ：GAS | 以前のGitHub Actions |
| --- | --- | --- |
| Google Cloud Consoleの新規設定 | 不要（GASがデフォルトプロジェクトを管理） | 別途Sheets認証を設計する必要あり |
| GoogleサービスアカウントJSON | 不要 | 現行コードでは必要 |
| APIキー設定場所 | GAS Script Properties | GitHub Secrets |
| 保存先 | 既存の非公開Google Sheet | 同上 |
| 日次自動化 | 初回成功後、GASの1日1回トリガー | 現行は手動のみ |
| 追加課金 | 無料枠内で運用を開始 | サービスアカウント/無料枠確認が必要 |

## 公式ドキュメント
- https://developers.google.com/apps-script/guides/cloud-platform-projects
- https://developers.google.com/apps-script/guides/services/quotas
- https://developers.google.com/apps-script/reference/properties/properties-service
- https://developers.google.com/apps-script/reference/script/clock-trigger-builder
- https://pub-docs.valuecommerce.ne.jp/docs/as-77-token-api/
- https://pub-docs.valuecommerce.ne.jp/docs/as-78-order-report-api/
