# 分析用データの品質と保存（ISS-003 / PLAN-001）

## 2026-10-23の変更と測定開始基準

過去の45人・61セッション・588PVなどは自己操作/Debug/集計差が未解消の暫定値。
今回の変更で過去データが洗浄されるわけではない。成長率の基準日は、
本番で次の同意/通信試験を通過した日とする。GA4は同意した訪問だけの集計であり全訪問数ではない。
GSCはGoogle検索のクリック数で、GA4セッションと同一指標ではない。

## 自分のGA4アクセスを除外

普段使う端末・ブラウザごとに `https://kagurameguri.jp/?analytics=off` を開く。
そのブラウザのlocalStorageに除外設定を保存し、以後GA4タグを読み込まない。
解除は `https://kagurameguri.jp/?analytics=on`。プライベートモード/別端末/サイトデータ削除では設定が引き継がれない。
localStorageが使えない場合、off付きのページでだけ除外する。
これはGA4の除外であり、GoatCounterや広告など他事業者のタグを停止するスイッチではない。
localhost、公開ホスト以外、gtm_debug/gtm_preview/debug_mode付きURLもGA4は送信しない。
Google拡張機能側のDebug設定まで検出できるわけではない。

ブラウザの開発者ツールで `window.kaguraAnalytics` を読むと次を確認できる。

| status | 意味 |
|---|---|
| excluded | 自己/Preview/非公開ホストで除外 |
| waiting_consent | 統計同意待ち、Googleタグ未読込 |
| loading | タグ読込中 |
| tag_loaded | タグJS読込成功。GA受信成功を意味しない |
| tag_error | タグJS読込失敗。計測不可 |

同意を撤回すると送信可フラグを止めて再読込する。Cookiebotが動かない場合も同意を推定しない。
計測のために同意ゲートを外さない。フォーム入力値や任意のURLクエリ/ハッシュを送らない。

## イベントと評価

| イベント | 定義 | 用途 |
|---|---|---|
| page_view | 既存configから1文書1回の自動送信 | ページ閲覧（拡張計測の管理設定は別途確認） |
| view_event | 同意後の公演詳細/定期公演表示1回 | 公演詳細への到達 |
| select_event | サイト内の公演詳細リンクの操作 | 一覧→詳細の導線 |
| official_link_click | 明示した公式情報ボタンの操作 | 観覧検討行動。予約/来場ではない |
| filter_events | 地方/県/日付の操作種類のみ | 探し方の利用。選択値・自由入力を送らない |
| affiliate_click | 既存の広告主/掲載位置/対象ID付きクリック | 広告送客。成約/報酬ではない |

`select_event`と`view_event`は別の行動で、足し合わせて「人数」にしない。
GA4でcontent_id/content_type/source_page/filter_type/link_domainをイベント範囲のカスタムディメンションに登録すればUIで内訳を参照できる。
登録前の過去データへ遡及適用はされない。Google受信の検証までは計測開始済みとしない。
既存のaffiliate_partner/affiliate_placement/affiliate_content_idは引き続き使用する。

## SNSのUTM規約（予約投稿はこの変更で編集しない）

誘導先ホストは `https://kagurameguri.jp/` に統一する。
投稿ごとの比較が必要な場合、`?utm_source=x&utm_medium=social&utm_campaign=kagura_202610&utm_content=post_20261023_0800` のように付与する。
英数字・ハイフン・アンダースコア80文字以内。氏名/メール/自由文をタグに入れない。
UTMなしの過去投稿への遡及帰属はできない。Buffer clicksとサイトセッションは別集計。
予約投稿の変更は集客担当が元の投稿ID・公開予定時刻と照合して実施する。

## Windsorに依存しない取得コード（設置・認証前）

`scripts/apps-script/analytics-sheet-sync.gs` を既存の**非公開**統合SheetのApps Scriptへ追加できる。
公開サイトやGitHub Actionsへ分析結果・認証情報を保存しない。既存VCスクリプト/トリガーを置換しない。
このPRの公開だけではAPI接続も定期取得も始まらない。

1. 本人のGoogleアカウントで既存Sheetを開き、Apps Scriptへ別ファイルとして追加する。
2. 既存の請求先未登録のデフォルトプロジェクトでAnalyticsData高度なサービスを有効化し、Search Console APIの利用可否を確認する。
   Cloudの請求先登録・標準プロジェクトへの移行・有料化を求められたら中止し、CSVの無料エクスポートへ切り替える。
3. スクリプトプロパティ `KAGURA_GA4_PROPERTY_ID` にGA4管理画面のプロパティIDを設定する。
   WindsorのアカウントIDからは推定しない。権限はGA4閲覧・GSC閲覧と既存Sheet書込のみ。
   明示マニフェストを使っている場合は既存VC用スコープを消さずanalytics.readonly/webmasters.readonly/
   spreadsheets.currentonly/script.external_requestを追加する。OAuthトークンやキーはコード/チャットへ貼らない。
4. 無料・請求先未登録・既存利用枠を確認してから `KAGURA_ANALYTICS_FREE_CONFIRMED=yes` を設定する。
5. `dailyKaguraAnalyticsSync()` を本人が初回実行し、認証・12〜14タブの内容・管理画面との一致を確認する。
6. 成功後に既存GASの日次トリガー構成と照合し、この関数を1日1回、分析タスク前の7時台に指定する。
   本関数はトリガーを自動作成せず、同じJST日に成功済みなら再取得しない。

上限は1回7リクエスト、各最大1000行、再試行/無制限ページングなし。直近28日を再取得しIDで更新する。
日次行と28日内訳は別タブ、ユーザー数を日別に足して期間ユニーク人数を作らない。
GA4は処理更新の可能性を残し「確定」と自動認定しない。GSCは`dataState:final`、日付はPT（GA4はプロパティ時間帯）。
欠損行はゼロに置換せず、打切り・しきい値・サンプリング・取得日時を明記。
API取得が途中で失敗したら保存前に止める。Sheet書込が途中で失敗した場合は部分保存の可能性があるので、
14タブの成功と取得日時を確認する。古い行が残っても当日取得済みと解釈しない。
旧01_アクセス分析・10_課題管理は自動上書きしない。分析担当が新原本を検証して反映する。

### 無料エクスポートによる代替

APIの有効化/無料条件を確認できない場合、GA4とGSCの標準UIからCSVを保存し既存の非公開Sheetへ取り込む。
対象期間・取得時刻・GA4フィルタ/時間帯・GSC検索タイプ/時間帯・確定状態を併記する。
CSVがないことや取得失敗を「0アクセス/0収益」としない。

## 本番受入試験（PC/スマホ）

1. offを開いたブラウザで、同意済みでもGA4タグ/collectが0件であることを確認。
2. onで解除→同意をリセットし、未同意/拒否時のGA4タグ/collectが0件を確認。
3. 明示的な統計同意で1文書1回のpage_viewと公演詳細1回のview_eventを実通信で確認。
4. 一覧から詳細、公式ボタン、広告ボタン、絞り込みを操作し、各イベントの区別と1操作1送信を確認。
5. 同意撤回後は停止すること、フォーム本文/クエリ/氏名が送信されないことを確認。
6. PC/スマホのviewport、時刻、URL、測定ID、同意状態、実リクエストの種類/回数を記録。
   QAは自己除外を基本とし、受信試験をした少数アクセスは記録して評価対象から分ける。

ローカルVM/jsdomテストは同意・除外・イベントの回帰を確認するが、Cookiebot本番設定やGoogle受信を証明しない。
過去の計測途絶（10/21以降）の原因は未確定であり、このPRで解消したと断定しない。

## 一次資料

- https://developers.google.com/analytics/devguides/collection/ga4/views
- https://developers.google.com/apps-script/advanced/analyticsdata
- https://developers.google.com/analytics/devguides/reporting/data/v1/quotas
- https://developers.google.com/webmaster-tools/v1/searchanalytics/query
- https://developers.google.com/webmaster-tools/pricing
- https://developers.google.com/apps-script/guides/services/quotas
