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

## Windsorに依存しない自動取得（2026-10-24改善、設置・認証前）

`scripts/apps-script/analytics-sheet-sync.gs` を既存の**非公開**統合SheetのApps Scriptへ追加する。
公開サイトやGitHub Actionsへ実データ・認証情報を保存しない。既存VCスクリプト/スコープ/トリガーを置換しない。
GitHubへコードを保存してもGASは設置・実行されず、Googleへの本人認証が別途必要。

1. 本人が既存Sheetの「拡張機能→Apps Script」を開き、別の `.gs` ファイルとして追加する。
2. GA4はAnalyticsData高度なサービスを有効化する。GA4管理画面のプロパティIDを
   `KAGURA_GA4_PROPERTY_ID` に設定する（WindsorのアカウントIDから推定しない）。
   プロパティの実際の時間帯がJST以外なら `KAGURA_GA4_TIMEZONE` にIANA時間帯を設定する。
3. **GSCはUrlFetch方式なので明示的なOAuthスコープが必須。**
   `analytics-manifest.example.json` の `oauthScopes` と `enabledAdvancedServices` を既存の
   `appsscript.json` へマージする。既存VC等のスコープ・サービスは削除しない。
   `script.scriptapp` は本人が日次トリガーを設置するための権限。自動設置はしない。
4. Search Console APIの有効化を確認する。デフォルトCloudプロジェクトはCloud Consoleで直接管理できない。
   旧手順の「デフォルトプロジェクトでGSC APIを有効化」は常に実行できるものではない。
   GSCの403は閲覧権限/OAuthスコープ/API未有効化をそれぞれ確認する。
   既存の請求先未登録プロジェクトで利用できない場合はGSCの工程を保留する。
   標準Cloudプロジェクトへの切替や新規作成を自動実行しない。カード/請求先登録/有料化も行わない。
5. 無料・請求先未登録・利用枠を確認した本人が `KAGURA_ANALYTICS_FREE_CONFIRMED=yes` を設定する。
   `checkKaguraAnalyticsSetup()` でローカル設定を診断する。この関数はGA4/GSC APIを呼ばず、権限や接続成功は証明しない。
6. `dailyKaguraAnalyticsSync()` を本人が初回実行し、Googleの権限画面を確認して認証する。
   `14_計測実行` の全体行とGA4/GSCそれぞれの行、12/13の値・時間帯・取得日時を管理画面と照合する。
7. 両媒体の保存・読戻成功後だけ `installKaguraAnalyticsDailyTrigger()` を本人が明示実行する。
   毎日7時台JSTのトリガーを1つ設置する。再実行は既存1個を維持し、VCのトリガーは変更しない。
   同じハンドラが複数ある場合は自動削除せず要確認で停止。7時台は実行幅であり07:00固定ではない。

### 取得・保存・再実行の規則

- 上限は1実行8リクエスト（GA4 5回、GSC date/query/page各1回）、各最大1000行。直近28日を再取得し、媒体ごとの保存・読戻が終わってから成功時刻を進める。
- GA4/GSCは独立。GSCが403等でも取得済みGA4は保存する。再実行は失敗した媒体だけ。
- 失敗試行は媒体ごとに1日最大2回、成功済みは同日再取得しない。プロパティ/時間帯変更時は旧設定の成功判定を流用しない。
- GA4は設定時間帯で期間を計算し、API返却時間帯が異なれば保存を止める。GSCはPT・`dataState:final`。
- 12は日別の原本。未返却日も指標欄を空白・`not_returned`付きで明示する。0アクセスを推定しない。
  GA4ユーザーを日別に足して7日/28日ユニーク人数を作らない。
- 13は**媒体ごとの直近成功時点の28日内訳**。同じ28日分を日々複製しない。
  取得失敗した媒体は古い内訳を保持するので、必ず取得日時と14の媒体行を照合する。
- 14は全体 `YYYY-MM-DD` と媒体別 `YYYY-MM-DD-GA4/GSC` の状態を同一IDで更新する。
  `success` は通信・保存・読戻の成功であり、自己アクセス除外やGoogle計測の正確性を証明しない。
- `partial` は一方だけ成功、`error` は未確認、`no_data` は正常応答だが日次行なし、`setup_required` は設定不足。
  `GA4_TIMEZONE_MISMATCH` / `GSC_HTTP_403` / `GSC_HTTP_429` / `SHEET_READBACK_MISMATCH` 等の安全な原因コードだけを記録する。
  OAuthトークン・応答本文・生の例外文はログへ出さない。
- 全体行がpartial/errorでも、媒体別の保存成功行と取得日時が一致する原本はその媒体の範囲で参照できる。
  失敗媒体の部分保存行は現時点の確定原本として使わない。日次の成功処理とGoogle受信の確認は別工程。
- 列の不一致はAPI取得前に停止。読戻不一致や保存失敗を成功扱いしない。
  書込途中に失敗した場合は部分保存があり得るため、再実行時にID更新で整合を回復する。
- 打切り/しきい値/サンプリングを注記し、GA4の処理更新可能性、GSCクエリ匿名化による全体との差を残す。
  旧01_アクセス分析・10_課題管理・VC/収益表はこのGASから自動上書きしない。

### GSCページ別28日内訳の追加（2026-10-25、実GAS未反映）

`kaguraCollectGsc_` に `dimensions:["page"]` の1要求を追加する。PTの前日を末日とする28日（両端含む）、`type:web`、`dataState:final`、`rowLimit:1000` を使用。query×page、ページング、追加トリガーは使わない。既存のSearch Console APIと `webmasters.readonly` の範囲で、認証スコープ・manifest・プロパティ・課金設定は変更しない。

`13_計測内訳` の `source=GSC / breakdown=page` に返却URLと `[clicks,impressions,ctr,position]` を保存する。IDは `GSC-page-<期間末日>-<返却URL>` でquery行と分離。GSCが全取得成功したときだけquery/pageを最新スナップショットへ置換し、前回だけ存在したURLも除去する。12の日次履歴と14の過去日実行記録、GA4の内訳は維持する。

- APIは上位行のみを返し、1000件未満でも完全性は保証されない。1000件到達時は行のqualityと14のnotesに `limit reached; completeness not guaranteed` を記録する。1000件到達は上限に達した事実であり、欠落件数は不明。
- ページ集約とプロパティ全体の集約は異なる。ページ別クリック/表示回数の合計を12の日次合計と一致させたり、不一致分を欠測0で補ったりしない。CTR・掲載順位は単純合計/単純平均しない。queryの匿名化省略と上位制限の注記は維持する。
- pageが空なら旧page行を消し、notesに `page: ... no_rows` を残す。未返却ページを検索実績0とは扱わない。日次に値があれば媒体statusはsuccessのままなので、pageのnotesも必ず読む。`final`でも直近未返却日があり得る。
- pageのHTTP/形式エラーはGSC全体の取得失敗とし、既存GSC日次・query・pageを保持。GA4成功は維持する。保存後のreadback不一致ではGSC成功を記録せず、部分保存行を現行原本と扱わない。再試行は既存の媒体別1日2回上限内、成功媒体は再取得しない。

#### 反映の承認・次回実行の証拠

1. このリポジトリ変更の公開承認と、既存の非公開Sheetに紐づく実Apps Scriptのコード更新承認は別工程。現時点ではローカル検証のみ。実データ・台帳は変更していない。
2. GAS反映の承認後、運用者が既存の `analytics-sheet-sync.gs` をバックアップし、同じファイルの内容を更新する。同名関数を別ファイルへ重複追加しない。VCコード・manifest・Script Properties・既存トリガーを保持する。新規認証/請求先登録が求められた場合は停止し、理由を確認する。
3. 通常は既存の次回日次トリガーを待つ。旧版が同日成功済みなら新コードにしても成功ガードで取得は省略される。ガードを消したり、追加トリガーを作ったりしない。手動実行は別途承認された場合のみ。
4. 次回実行後、14の全体行・GSC行の日時/状態と `page:`、`saved/readback verified`、上限/空応答注記を記録。13のpage行についてfrom/toがPTの28日、timezoneがAmerica/Los_Angeles、最大1000行、IDの一意性、返却4指標と取得日時を確認する。管理画面との比較は同じ期間・web・ページ集約で行い、実データを公開PRへ転載しない。
5. GA4の独立保存、既存query、12の日次履歴、14の履歴とトリガー数不変も確認する。pageが0件ならno_rowsの記録を証拠とし、架空行を作らない。これらの実アカウントでの確認が済むまで「GAS反映・実測保存完了」と報告しない。

通常取得が7→8回になるため無料APIの利用枠・GAS実行枠は消費する。既存の無料確認ゲートを保持し、新しい有料サービス・API・認証スコープは追加しない。アカウント残枠はローカルでは確認できない。ページ内訳は改善候補の判断材料であり、集客向上を保証しない。

仕様・負荷制限: https://developers.google.com/webmaster-tools/v1/searchanalytics/query / https://developers.google.com/webmaster-tools/limits

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
