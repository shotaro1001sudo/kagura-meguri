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

- 上限は1実行10リクエスト（GA4 6回、GSC date/query/page/device各1回）、各最大1000行。直近28日を再取得し、媒体ごとの保存・読戻が終わってから成功時刻を進める。
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

### 流入元品質・固定ページ導線・検索端末（ローカル検証、実GAS未反映）

GSC page追加後の8要求に以下を加え、通常10要求（GA4 6＋GSC 4）。元のdate/queryのみの版からは7→10要求となる。すべて既存のreadonlyスコープ内で、28日・各APIの時間帯・保存先を維持。ブラウザ追跡や同意動作、manifest、トリガー、APIキー・権限・課金設定は変更しない。GA4は既に同意を得て収集されたデータの集計であり、同意のない利用者を補完しない。

| 13_計測内訳のsource / breakdown | dimension列 | metrics_jsonの順序 | 判断すること |
|---|---|---|---|
| GA4 / source | sessionSourceMedium（従来どおり） | `[sessions,engagedSessions,engagementRate]` | 流入数と、エンゲージメントのある流入元 |
| GA4 / page_event | JSON配列 `[pagePath,eventName]` | `[eventCount]` | 固定ページから公式・広告への導線と広告表示 |
| GSC / device | DESKTOP / MOBILE / TABLET | `[clicks,impressions,ctr,position]` | Google検索段階の端末差。GA4の端末別sessionsとは別指標 |

sourceは既存1要求の指標を増やすだけ。既存ID・先頭のsessionsを保持しqualityに `metrics=sessions,engagedSessions,engagementRate; schema=2` を記す。品質2指標の値欠損のみJSON null＋`optional_metrics_missing (not zero)` とする。必須sessions欠損、列定義の不足、NaN/負値、率>1、engagedSessions>sessionsはGA4エラーで旧原本を保持する。旧配列 `[sessions]` に追加指標が存在すると仮定しない。率は0〜1で、百分率表示時のみ100倍。単純平均して全体率を作らない。

page_eventはAPI側のcase-sensitive inListFilterで、`FUNNEL_PAGES` の完全一致15パスと既存の `official_link_click / affiliate_click / affiliate_view` のみを要求。任意のslug、クエリ付きURL、利用者ページ、フォームや個別開催ページは対象外。現在はトップ（/と/index.html）、guide、experiences、weekend、this-month、map、calendar、kagura/indexと定期公演6ページ。公開パスであっても対象外は0件と解釈しない。追加する際は実在する公開ページか・PIIを含まないかをレビューして定数を更新する。未知の返却パス/イベントや重複複合キーは保存せず、応答本文もログへ出さない。新規の利用者ID・永続追跡は不要。

IDは `GA4-page_event-<末日>-<JSON複合dimension>`、`GSC-device-<末日>-<端末>` とし、同じページの異なるイベントや他内訳との衝突を避ける。2内訳とも最新の媒体スナップショットで置換し、空応答では古い該当内訳を消してno_rowsを記録する。日次があれば媒体successでも内訳は空のことがある。未返却を0とせず、打切り/上位制限/しきい値/サンプリングの注記を読む。イベント数を人数・成約・ASP報酬と呼ばず、affiliate_viewとaffiliate_clickを合計しない。

新要求に失敗した場合はその媒体全体が未確認となり、取得段階の失敗なら旧原本を保持。他媒体の成功は維持する。読戻不一致は成功を進めず、再取得は既存の媒体別1日2回上限内で実施。成功済み同日ガードは変更せず、旧コードで当日成功済みなら更新後も翌日の実行を待つ。

Googleの標準フィールド・runReport/inListFilterとGSC device単独集約の仕様を確認した設計。**対象の実GA4プロパティでの組合せ互換性・実データ受信・API残枠は未検証**。実反映後、GA4/GSCの媒体別ログとreadback、source schema=2・page_eventのJSON dimension・GSC deviceの4指標、旧日次/実行履歴、空/上限注記を照合する。GSC pageを含め既存gsファイルを一度だけ置換し、同名関数を重複追加しない。GAS更新承認・次回実行確認は下記手順に従う。ローカルモック成功を実GAS成功とは報告しない。

標準APIの利用枠は2要求分増えるが、追加サービス・課金設定は不要。残枠を確認できない場合は無料で無制限に使えるとは断定しない。新しい永続追跡や個人情報は集めず、意思決定の材料として使い、集客向上を保証しない。

一次資料: https://developers.google.com/analytics/devguides/reporting/data/v1/api-schema / https://developers.google.com/analytics/devguides/reporting/data/v1/rest/v1beta/properties/runReport / https://developers.google.com/analytics/devguides/reporting/data/v1/rest/v1beta/FilterExpression

### GSCページ別28日内訳の追加（PR #109、実GAS未反映）

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

PR #109単体では通常取得が7→8回になるため無料APIの利用枠・GAS実行枠は消費する（上記3内訳の追加後は10回）。既存の無料確認ゲートを保持し、新しい有料サービス・API・認証スコープは追加しない。アカウント残枠はローカルでは確認できない。ページ内訳は改善候補の判断材料であり、集客向上を保証しない。

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

## 日付型のreadback互換性（実GASへの反映は別工程）

SheetsのgetValuesはDate型を返す場合がある。日付文字列をsetValuesした後の読戻しをJSON.stringifyだけで比較すると、UTCのISO文字列と入力の暦日/日時文字列が不一致になる。日次保存に続いてエラー実行記録も同じ理由で失敗すると、独立したGSC処理まで中断する。

比較処理はヘッダーがdate/from/to/fetched_at_JSTの列だけDateを正規化する。スプレッドシート自身のtimezoneを使って保存時の文字列表現を復元し、GA4/GSCの集計timezoneやUTCへ読み替えない。日付欄の非0時、ミリ秒、不正Dateは拒否し、日時の秒差、指標の型/値不一致は引き続き失敗とする。書式・権限・トリガーを変更せず、数式エスケープも保持する。

媒体エラーの記録にさらに失敗した場合は、安全な媒体名/原因コードだけconsole.errorに残して次媒体へ進む。成功記録と全体記録のreadbackは必須のままで、失敗した媒体や全体の成功ガードは更新しない。既に書かれた未検証行がある可能性は残るので、成功とみなさない。

ローカルではSheetsのDate変換を模したテストで再現・修正を確認。実行環境のDate型/時間帯を直接計測した結果ではなく、報告されたスタックと日付セルの状態に一致する有力原因。実GAS反映と次回承認された実行で、媒体別/全体readback、内訳更新、成功ガードを確認するまでは復旧済みと扱わない。手動再実行はこの作業では行わない。

仕様: https://developers.google.com/apps-script/reference/spreadsheet/range#getValues() 、 https://developers.google.com/apps-script/reference/spreadsheet/spreadsheet#getSpreadsheetTimeZone()

### 全体実行IDの追加対策

実環境の追加証拠では、実行台帳の全体ID（2026-10-26）がDATEセルの数値46321として保存されていた。媒体別の保存・readback成功後も、この全体行のreadbackが未確認のため、表示上のsuccessだけで全体完了と扱わない。

14_計測実行かつRUN_HEADER完全一致の場合に限り、ID列のDateをシート時間帯の暦日へ復元する。比較だけでなく既存行のupsertキーにも適用し、Date IDと文字列IDを別行として追加しない。異なる日付やGA4/GSC接尾辞、数値と文字列の相違は維持。不正Date/非0時/ミリ秒は拒否。他シートのIDは対象外。

ローカルの再試行テストでは、媒体別成功ガードがある一方で全体成功ガードがない状態を再現する。API再取得なしで全体行を更新し、readback成功後だけ全体ガードを更新。日付型IDの既存行・同日重複を一行に集約し、別日の履歴を保持。本当のreadback不一致では引き続き全体ガードを更新しない。

GitHub公開と実GAS反映は別工程。既存プロジェクトの対象ファイルだけを反映し、承認された検証実行で全体readbackと成功ガードを確認する。媒体別の同日成功ガードを編集して再取得させない。

## 2026-10-26: 既存タブ・戻る操作での自己除外

旧コードは初期読込でしか除外フラグを確認せず、別タブで除外を設定した後も起動済みページの許可状態が残り得た。既存のlocalStorageキーのみを使い、storage通知、pageshow（BFCache復元を含む）、focus、popstate、同意通知時に再確認する。除外すると独自イベントの許可を止め、Googleの `ga-disable-MEASUREMENT_ID` をtrueにする。除外後の遅延タグloadや同意通知では再開しない。解除は従来どおり `?analytics=on` への新しいナビゲーションで行う。過去に送信済みの情報は取り消せない。

当サイトは通常のHTMLページ遷移で、SPAルーター/GTMコンテナを追加していない。独自にpushStateでURLを書き換えるだけでは除外設定を新規登録しない。除外設定は必ず上記off URLを普通に開く。除外済み文書では同一文書内の画面操作も除外を維持する。

### Windows / Androidでの設定と確認

1. 普段使うWindowsのChrome/Edge、AndroidのChrome等、それぞれの通常ブラウザで `https://kagurameguri.jp/?analytics=off` を開く。アプリ内ブラウザを使うならそれも別に設定する。
2. 既に開いているサイトのタブを閉じ、通常URLから開き直す。新コード公開前もこの手順で古い文書を残さない。
3. Windowsの開発者ツールで、次を読み取り確認する（設定変更を伴わない）。通常URL・再読み込み・戻る操作の後も確認する。
   - `localStorage.getItem('kagura.analytics.exclude')` が `'1'`
   - `window.kaguraAnalytics.status` が `'excluded'`
   - `window.kaguraGa4Allowed` が `false`
4. AndroidはURLを開いた事実だけで保存成功と断定しない。既存のリモートDevTools接続を使える場合は同じ読み取りを行う。接続できない場合は「設定操作済み・保存状態未確認」と記録する。今回ユーザー端末は検査していない。
5. Networkでgtag/jsやGA collect要求がないかは、外部送信を遮断した検証環境で確認する。実ユーザーの本番操作をわざとGA4へ送り、除外の確認用データにしない。

ブラウザ/プロファイル/端末ごとの設定。シークレット、別ブラウザ、サイトデータ削除、localStorageの禁止では引き継がれない。保存不能時はoff URLの文書だけが除外対象で、他ページへ永続しない。GoatCounter・広告の停止ではない。GA4 Internal TrafficフィルターのTest/Activeはこのフラグとは別で、今回管理設定は変更しない。自己除外だけで全訪問を実人数として確定できず、同意しない閲覧・広告ブロック・複数端末等も残る。

### 検証と根拠

- オフラインVM: 初期除外、保存不能、別タブ通知、復元/フォーカス/履歴/同意通知、遅延load、解除後に古い文書が勝手に再開しないことを検証。
- Chromiumローカル: 同一originの別文書からの実storage通知、遷移、reload、実BFCacheで戻る、除外後の同一文書履歴変更とクリックを確認。Cookiebotはモック、Googleタグはネットワークで捕捉し空スクリプトに置換。実Googleライブラリ/CMP/GA4受信の試験ではない。外部送信0。除外後の独自eventコマンド増加0。
- https://developers.google.com/tag-platform/security/guides/privacy （Google公式のga-disable方式）
- https://developer.mozilla.org/en-US/docs/Web/API/Window/pageshow_event
- https://developer.mozilla.org/en-US/docs/Web/API/Window/storage_event

## 2026-11-04: 同意後の行動をGA4セッション単位で読む

既存の `view_event` / `official_link_click` / `affiliate_click` の総数・イベント名は維持する。
再クリックを間引いたり、sessionStorage/独自タイマーをGA4セッションとして扱わない。
公演閲覧は従来どおり1文書1回（再読込・別タブは別文書、BFCache復元は同一文書）。
長時間開いた文書でGA4セッションが切り替わっても、閲覧イベントを自動で再発行しない。
そのため `view_event` sessions は「イベントを受信したセッション」であり、全滞在セッションではない。
クリックはセッション切替後も操作ごとに送り、GA4側の割当・集計に任せる。
公式・広告クリックと広告表示の直前にも既存CMPの保存同意と自己除外を再確認する。
これにより別タブでの撤回後、focus通知前の操作でも古い許可フラグだけで送信しない。

### 既存アクセスだけを使う読取専用レポート

`analytics-session-report.gs` は `analytics-sheet-sync.gs` と同じ既存の非公開GAS向けの
**任意の手動関数**。リポジトリ公開だけではGASには反映されない。
本変更では実GASへの設置・実行、権限追加、サービス有効化、トリガー変更は行っていない。
既存AnalyticsDataの認証・無料設定が使えなければ未取得として保留する。新しいOAuth認証を求めない。
既存の日次取得10要求やSheet列・保存済み値は変更しない。

`readKaguraSessionReport('2026-10-27', '2026-11-02')` は同じ期間を指定した5要求を行う。
日付は実プロパティ時間帯、両端を含む最大28日。7日/28日はそれぞれ直接取得する。
3番目の引数に `/events/実在ID.html` 等の公開パスを渡せば、そのパスで発生した行動だけを集計する。
パスの実在はサイト原本と照合する。クエリ・ハッシュ・外部URLは指定不可。

| kind | APIの条件 | 読み方 |
|---|---|---|
| all | eventName指定なし | 全体sessions（page指定時はそのページのsessions） |
| view_event | eventName完全一致 | 公演詳細閲覧イベントのあるsessions |
| official_link_click | eventName完全一致 | 公式リンク操作のあるsessions |
| affiliate_click | eventName完全一致 | 広告リンク操作のあるsessions |
| outbound_union | 上記クリック2種のinListFilter | どちらかの外部遷移があるsessions。2行の和ではない |

全要求で `dimensions: []`、`metrics: sessions,eventCount` とし、条件は `dimensionFilter` に置く。
日別・URL別・イベント別行を合算して期間全体やunionにしない。
同じセッションで両リンクを押した場合もunionはAPIが直接計算する。
`eventCount` は同じ条件の総回数を並記する。予約・来場・売上や実人数ではない。
URLごとの数値を全体の内訳として加算しない。クリックsessions÷閲覧sessionsも、同一セッションの
順序付きファネル転換率を保証しない（クリックしたセッションにview_eventがない場合がある）。

- GA4のsessionsはHLL++による**重複除外セッション集計（近似）**。厳密な人数や独自IDのdistinctではない。
- レポートは期間・時間帯・取得時刻・品質注記を返す。無応答行はnull、0へ置換しない。
- 時間帯不一致、不正スキーマ/数値、権限エラーは停止。自動再試行・保存・ログ出力はしない。
- しきい値・サンプリング・other行への欠落は品質注記に残す。速報値は後日変わり得る。
- 同意情報の有無、自己/Debug除外はAPI通信成功だけで認証できない。既存記録は利用者による
  除外設定報告のみで実測未認証。外部利用者の確定KPIとして扱わない。
- WindsorでeventNameを非表示にしても複数の集計行が返る場合、unionではない。
  日別合算と一致する期間値にも非加算保証はない。上の無次元集計と照合できるまで参考値に留める。
- 既存の標準指標・標準dimensionのみ。カスタムdimension登録、キーイベント化、BigQueryや課金は不要。

検証: ローカルのモックで拒否/撤回・通知前の除外・復元・重複クリック、要求の期間とunionフィルター、
欠損・不正値・品質フラグを検証する。実Googleタグ/複数タブのGAセッション割当やGA4受信は模擬しない。
再読込/別タブ/セッション切替を跨ぐ重複除外はGA4依存で、実受信検証なしに成功とは断定しない。

一次資料: [Data APIのレポート](https://developers.google.com/analytics/devguides/reporting/data/v1/basics)、
[標準指標](https://developers.google.com/analytics/devguides/reporting/data/v1/api-schema)、
[GA4のHLL++近似集計](https://developers.google.com/analytics/blog/2022/hll)。

## 2026-11-04: 日次の期間セッションsnapshot（任意の追加ファイル）

`analytics-session-sync.gs` を既存の2分析ファイルと同じ非公開GASへ追加すると、
`dailyKaguraAnalyticsSync()` の既存GA4/GSC処理後に、前日までの**28日間**を直接取得・保存する。
毎日の実行でも1日分の実績ではない。7日値はこの自動保存の対象外で、28日値から推定しない。
5種類は全体・公演閲覧・公式クリック・広告クリック・外部遷移union。
既存のイベント件数・日次指標・成功ガード・manifest・VC処理・トリガーは維持する。
追加ファイル未設置なら既存日次は従来どおり動き、戻り値 `sessionSnapshot.status=unavailable`。
読取関数が未設置なら専用台帳行は `setup_required`、追加API読取なし。

### API予算（以前の10要求から明示的に変更）

- 既存の日次: GA4 6＋GSC 4。期間snapshot: GA4 5。**全部未取得の1実行は最大15要求**。(2026-11-10 に、広告クリックの内訳の追加で最大17要求へ。下の「広告クリックの内訳を全ページで取る」)
- バッチ化して見かけの回数を小さくすることはしない。GA4の通常消費は6→11レポートへ増える。
- 既存GA4/GSCとsnapshotそれぞれに同日成功ガード・1日最大2試行。自動再試行なし。
  すべての試行が上限まで必要な最悪ケースは合計30要求/日。手動の無ガード読取関数はこの予算外。
- 初回検証/失敗回復には `syncKaguraSessionSnapshot()` を使う。最大5要求で、既存の
  GA4/GSC成功ガードを消したり、成功済み日次を再取得したりしない。同日成功後は0要求。
- 新規キー・有料サービス・OAuthスコープ追加なし。既存の無料確認設定が必要。
  クォータ不足は安全なエラーとして停止し、無制限リトライしない。

### 保存形式と日次レポートの読取条件

既存の13/14の列順をそのまま使用。12_計測日次・旧01・収益表は追加処理から書かない。

| 保存先 | 内容 |
|---|---|
| 13_計測内訳 | `source=GA4_SESSION`, `breakdown=period_sessions`、最新成功snapshotの5行 |
| dimension | `all`, `view_event`, `official_link_click`, `affiliate_click`, `outbound_union` |
| metrics_json | `[sessions,eventCount]`。schema=1。空応答は `[null,null]`、実際に返された0だけ `[0,0]` |
| from/to/timezone | 各行に対象期間・GA4プロパティ時間帯を保存 |
| quality | 非加算・HLL++近似・同意/自己/Debug未認証・しきい値等の元注記を保持 |
| 14_計測実行 | `YYYY-MM-DD-GA4_SESSION` の専用状態・取得日時。既存の全体行やGA4/GSC行とは別 |

`GA4_SESSION` は同じGA4媒体の**保存用区分**で、新しい解析媒体ではない。
既存処理が `source=GA4` の最新内訳を置換しても、snapshot行は消えない。逆も同様。
snapshotは毎日蓄積せず5行を更新し、既存の他区分の行と過去の実行台帳は保持する。

日次レポートは必ず、対象実行日の専用台帳が `success` または `no_data`、
その取得日時が5行の `fetched_at_JST` と一致、from/to/timezoneが一致することを確認する。
`success` でも行単位でnullや品質制限があり得る。全行nullの正常応答だけ `no_data`。
専用台帳がない/`error`/`setup_required`、読戻不一致、取得日時不一致なら「未取得・未確認」。
前回値を表示する場合は**前回の期間と取得日時**を併記し、今日の実績として扱わない。
既存の全体行 `success` は引き続きGA4/GSCの日次保存成功だけを表す。
追加snapshot失敗を隠さないため、全体行だけで新KPIを採用してはいけない。

### 安全な反映・検証

1. 既存の同名関数の衝突と依存関数を照合。新ファイルは
   `syncKaguraSessionSnapshot` / `kaguraSyncSessionSnapshot_` の2関数だけ。
2. 新ファイルを追加し、`analytics-sheet-sync.gs` は本変更の差分だけを既存版と照合して反映。
   `analytics-session-report.gs` は既存のものを利用。日付固定の手動確認関数を上書きしない。
   manifest・認証・トリガーは変更しない。新しい権限画面が出た場合は停止。
3. `syncKaguraSessionSnapshot()` を1回実行。既存GA4/GSC/VCの成功時刻とトリガー数が
   変わらず、13に5行、14に専用行が保存され、読戻成功したことを確認する。
4. 直後の同じ関数再実行は `skipped:true`・追加API0件になる。失敗なら原因を確認し、
   2試行上限内でのみ再実行。ガードの削除・日付の偽装・上限回避は行わない。
5. 翌朝の既存トリガーで専用台帳と期間が更新されたことを確認してから「日次連携稼働」とする。
   コード公開/手動成功だけではトリガー稼働まで確認済みにしない。

検証対象: 通常15要求、同日重複抑止、既存成功後の5要求だけの初回保存、失敗媒体の独立性、
依存ファイル欠落、取得/保存/台帳読戻失敗、古いsnapshotの保持と未確認表示、nullと0、
プロパティ変更、時間帯不一致、品質注記、他媒体行の保持。専用guardはデータと台帳の読戻後のみ進める。

### 同意後の実受信確認の限界

親タスクが既存認証で実APIを読み取り、2026-10-27〜11-02の直接期間集計を確認済み。
これはイベントがGA4で集計可能であることの根拠で、各訪問の同意時点や自己除外成功の証明ではない。
本番へ検証用クリックを送らず、同意テストは外部通信を遮断したローカル環境で行う。
`npm test` は実CMPのJSDOM検証（未回答、保存、カテゴリ別同意、撤回、Cookie消失）と
GA4のVM検証（同意前のタグ未読込、遅延同意、拒否、撤回・再読込、自己除外、通知前の再確認）、
イベントのモック検証（重複クリック総数維持、BFCache相当通知、個人情報非送信）を含む。
`tests/cookieconsent-browser.mjs` は別のChromium試験で、npm testには含まれない。
Googleタグは空のモックへ置換し通信を遮断するため、成功してもGoogle受信は証明しない。
実Googleライブラリの複数タブ・セッション切替・BFCache割当、広告ブロック、送信取りこぼし、
本番ユーザー端末の自己除外、GA4管理フィルターの実効性は、既存コードと集計値だけでは未認証。

今回のローカルChromium再検証では幅1280/390の双方で、初回拒否、統計のみ/広告のみの同意、
保存、撤回後のreload、キーボード操作、CMP資産欠落時の停止が成功。
実ローカルCMPを使用し、外部要求32件を遮断、外部へ継続した要求は0件。
Googleタグはモックであり、本番受信・複数タブのGAセッション割当の証拠にはしない。

## 2026-11-10: 広告クリックの内訳を全ページで取る(MEAS-20261110-1、2026-11-10 に実GASへ反映)

週次の分析で、広告のクリック(28日で20回)のうち、どのページ・どの広告から出たかが分かるのは固定ページの分だけでした。
開催ページ(夜神楽・花祭など)の宿の広告が押されているかが分からず、収益の施策(宿の導線・ふるさと納税)の効果を確かめられません。
`scripts/apps-script/analytics-sheet-sync.gs` に、次の2つの内訳を足します。既存の `page_event`(固定ページ15件)は変えません。

| 13_計測内訳のsource / breakdown | dimension列(JSON配列) | metrics_json | 分かること | GA4側の準備 |
|---|---|---|---|---|
| GA4 / aff_page | `[pagePath,eventName]` | `[eventCount]` | 全ページの、広告の表示(affiliate_view)とクリック(affiliate_click) | 不要(標準の項目だけ) |
| GA4 / aff_detail | `[pagePath,affiliate_partner,affiliate_placement,eventName]` | `[eventCount]` | ページ × 広告主(jalan・rakuten など)× 置き場所(event_stay・kagura_furusato など) | カスタムディメンション2つの登録が要る |

### 取り方と、守っていること

- API側で、`eventName` を `affiliate_click / affiliate_view` に、`pagePath` を公開ページのパスの形(`AFF_ROUTE`。`/events/<id>.html`・`/regular/<id>.html`・`/kagura/<名前>.html`・`/pref/<県>.html`・`/month/<年-月>.html`・`/history/…`・固定ページ)に絞ります。クエリ付きのURL・空白入り・想定外の階層は対象外です。
- 返ってきた行も、同じパスの形・イベント名・広告主と置き場所の値(サイトが送る値の一覧。`scripts/client/affiliate.js` とテストで照合)・複合キーの重複を確かめ直します。1行でも想定外なら、その内訳は保存せず、実行記録にも値を書きません。
- 新しく測るものはありません。サイトがすでに送っているイベントとパラメータ(`affiliate_partner`・`affiliate_placement`)を、GA4から読むだけです。フルURL・利用者ID・セッションIDは要求しません。数えるのは、解析に同意した訪問の分だけです(プライバシーポリシーの範囲内)。
- **この2つは「任意の内訳」です。** 失敗しても GA4・GSC の成功の記録は変えず、日次と既存の内訳はいつもどおり保存します。失敗した内訳は保存せず(古い行も残さない)、`14_計測実行` の GA4 の行の notes に `aff_detail: unavailable (原因コード); optional breakdown not saved; missing is not zero` と残します。
- 行が無いページは 0 ではありません(イベントが無い・同意が無い・しきい値で伏せられた、のどれかです)。
- `(not set)` は、カスタムディメンションを登録する前のイベント・値のないイベントです。広告主ではありません。

### API予算(15 → 17要求)

- 日次: GA4 6 → 8、GSC 4。期間snapshot 5。**全部未取得の1実行は最大17要求**(以前は15)。
- 同日の成功ガード・1日2試行までは変えません。最悪の場合は合計34要求/日(以前は30)。
- 新しいキー・有料サービス・OAuthスコープの追加はありません。

### 反映の記録(2026-11-10)

- Apps Script: 統合管理台帳に紐づくプロジェクトの `analytics-sheet-sync.gs.gs` を、コミット 6fccad8 の全文に置き換えて保存した。置き換える前の中身は、1つ前の版(コミット 2b59e0e)と一致していた(長さ・ハッシュで照合)。保存後に読み込み直し、新しい版と一致することを確かめた。ほかのファイル・トリガーは変えていない。
- GA4 のカスタムディメンション: `affiliate_partner`(表示名「広告主」)・`affiliate_placement`(表示名「広告掲載位置」)は、**2026-10-20 に登録済み**だった(範囲はイベント)。新しく作ったものはない。
- 最初の取得は、2026-11-11 の朝7時台。結果は `14_計測実行` の `2026-11-11-GA4` の行で確かめる。

### 運営者の手順(もう一度反映するとき)

1. **Apps Script の貼り替え(これだけで aff_page が取れます)**
   非公開の統合管理台帳で「拡張機能 → Apps Script」を開き、このスクリプトを入れてあるファイル(`dailyKaguraAnalyticsSync` がある .gs)の中身を、リポジトリの `scripts/apps-script/analytics-sheet-sync.gs` の全文で置き換えて保存します。トリガーや他のファイルは触りません。
   その日の取得が済んでいれば、新しい内訳は翌朝7時台の取得から入ります(同日は取り直しません)。
2. **GA4 のカスタムディメンションの登録(aff_detail に必要)**
   GA4 の「管理 → データの表示 → カスタム定義 → カスタム ディメンションを作成」で、次の2つを作ります。
   - ディメンション名 `affiliate_partner` / 範囲: イベント / イベント パラメータ: `affiliate_partner`
   - ディメンション名 `affiliate_placement` / 範囲: イベント / イベント パラメータ: `affiliate_placement`
   登録の前のイベントには、さかのぼって付きません。登録から28日たつまでは `(not set)` の行が混ざります。
3. **確かめ方**
   翌朝、`14_計測実行` の `<日付>-GA4` の行の notes に `aff_page:` と `aff_detail:` が出ていること。
   `aff_detail: unavailable (GA4_DIMENSION_NOT_REGISTERED)` なら、2 の登録がまだです(ほかの数字には影響しません)。
   `13_計測内訳` に breakdown が `aff_page`(と `aff_detail`)の行が入っていること。

### 未検証のこと

- 実の GA4 プロパティでの動作(正規表現の絞り込み・カスタムディメンションの組み合わせ・しきい値)は未検証です。ローカルのテスト(`tests/analytics-sync.mjs`)は、API の応答を模した検証です。
- 未登録のときに API が返すエラーの文面が想定(`not a valid dimension`)と違う場合、原因コードは `UNCLASSIFIED_ERROR` になりますが、動作(その内訳だけ保存しない)は同じです。
- 反映のあと、週次の分析が7日後に「計測できている / できていない」を判定します。

一次資料: https://developers.google.com/analytics/devguides/reporting/data/v1/rest/v1beta/FilterExpression / https://developers.google.com/analytics/devguides/reporting/data/v1/api-schema#custom_dimensions
