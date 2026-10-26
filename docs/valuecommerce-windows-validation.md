# 未公開VC修正のWindows検証引き継ぎ

基準main: `983c2bb188039448aa8918bc46398342263753f1`。draft PRのみ。マージ・本番公開禁止。

## 取得・依存

既存の承認済みGitHub取得経路でPRの確定headを取得し、別のクリーンな作業先で使用する。旧ZIPを現行証拠にしない。ハッシュ一覧は `docs/valuecommerce-validation-hashes.json`。

検証プローブはNode標準APIのみ。既存Node25/Chromeを使用し、npm install・Python・追加ソフトは不要。サイト全体のbuild/testにはpackage-lockの依存が必要なので、既存依存がなければ実行前に親へ報告する。

```powershell
$env:CHROMIUM_BIN = '確認済みの既存chrome.exeの絶対パス'
node tests/valuecommerce-transfer-probe.mjs > vc-guard.json
```

初回は実CMPも広告タグも実行せず通信遮断だけ確認する。画像/script/iframe/fetch/worker/追加タブの6ケースで `allBlocked=true`, `noExternalContinued=true`, `fatal=null` が必要。ページと追加ターゲットは起動待ちにし、Fetch Request段階で既定拒否。Fetch非対応workerは起動前にNetwork.setBlockedURLs('*')を設定する。対応しないターゲットやAPIエラーでは停止し、実タグへ進まない。現在のハーネスが確認する対象はこの6ケースであり、ブラウザ全機能に対する網羅証明ではない。

```powershell
$env:VC_REAL_CMP = '1'
node tests/valuecommerce-transfer-probe.mjs > vc-real-initial.json
Remove-Item Env:VC_REAL_CMP
```

上記も毎回事前遮断テストを通過してから実uc.jsへ進む。localhostに配信する最小fixtureで、本番origin偽装なし。公開CMPホストのGETのみ許可し、広告/解析/同意ログ要求を遮断する。workerは引き続き全URL拒否。実広告リンククリック・購入・成果送信なし。使い捨てChromeプロフィールでユーザーの通常ブラウザ設定を変更しない。

これは**実CMPの初期状態確認のみ**。未選択/拒否/許可・保存済み拒否・再読込・撤回を証明するには、親とWindows担当が同じ遮断を保持して実CMP UIを操作する追加検証が必要。Cookiebot状態をコードで書き換えて実証としない。初期プローブは終了時プロフィールを削除するため保存状態の検証に流用しない。実サイト生成ページのscript順序との統合も別確認。

ローカルライセンス不一致・auto分類による遮断・同意ログ遮断による保存不能なら報告して停止。ignore/necessary化/CSP拡張/設定・権限変更は不可。現在のクラウドではuc.jsがERR_TUNNEL_CONNECTION_FAILEDで、実3状態は未検証。

## 原本と品質

`tests/fixtures/valuecommerce-issued.json` の5例を親が再取得した元記録とコード文字列として照合、一致。`docs/valuecommerce-source-comparison.json` に原本ファイルの親報告ハッシュと比較限界を記録。新しい管理画面承認確認ではない。

全10,498テスト成功、142ページbuild成功。旧保存パッチの52単体テスト、模擬CMP＋Chromium成功。ただし実CMPの分類・3状態は未確定で公開条件に残る。GA4統計同意・自己除外・最近のPR127を保持。

## 診断版（PR128追加）

`responses` はHTTPステータス・MIME・キャッシュ有無、`failures` はネットワーク失敗、`consoleErrors` は警告/エラー、`cmpEvents` は実Cookiebot Ready/Load/Accept/Decline/Dialogイベントを記録する。query/fragmentは保存せずURLパス内のUUIDも伏せる。Cookie値、要求/応答ヘッダー、通信本文は採取しない。コンソールのURLもqueryを除去する。取得不可・未承認・地域設定等を、API初期値だけで決めつけない。

```powershell
$env:VC_REAL_CMP = '1'
$env:VC_FIXTURE = 'generated'
node tests/valuecommerce-transfer-probe.mjs > vc-generated-diagnostics.json
```

`tests/fixtures/vc-generated-event.html` はcloudで既存build出力した大朝イベントHTMLのバイト一致コピー。PR128初版head9a09d29のサイト実装、基準main PR127を含む。CMPタグ属性、初期化順序、CSP、GA4同意処理、宿・体験の実広告markupを保持。画像等の付随ローカルアセットはこのプローブでは提供しないため、デザインQAではない。外部広告・GA4は引き続き遮断する。minimal fixtureに戻すにはVC_FIXTUREを削除。

```powershell
$env:VC_UI_SEQUENCE = '1'
node tests/valuecommerce-transfer-probe.mjs > vc-real-ui.json
Remove-Item Env:VC_UI_SEQUENCE
Remove-Item Env:VC_REAL_CMP
Remove-Item Env:VC_FIXTURE
```

UI sequenceは実ダイアログ表示＋未選択gateを確認できた時だけ、実ボタンにCDPマウス入力で拒否→同一隔離プロフィール再読込→Widget設定→許可→Widget設定→拒否を試す。Cookiebotプロパティ/保存Cookieは書き換えない。保存拒否の再読込ではVC要求の増加0も検証する。サイト/地域設定でWidgetや既知ボタンが出ない場合、勝手にAPI設定で代替せず停止する。実行は最大約20秒の待機を含む有限回のみ。実環境で全ステップ成功したとの記録はまだない。

公式のテスト用Domain Alias: https://support.cookiebot.com/hc/en-us/articles/26381611471388-What-are-Domain-Aliases-in-the-Cookiebot-Manager 。localhost/127.0.0.1は登録可能だがPremiumが前提、alias自体は請求対象外との説明。現在の契約/登録状況は未確認。自動ブロックの検証には公開サイトとの同一性が必要とされ、この1ページfixtureは全サイトの同一性を保証しない。イベント根拠: https://support.cookiebot.com/hc/en-us/articles/360020661139-How-to-find-out-when-the-Cookiebot-script-has-loaded 。

もしドメイン未承認の明示エラーが出たら、本番失敗と扱わず停止。最小の次案は既存の承認済みテストaliasがあるかの読み取り確認。なければ契約/費用/設定変更の必要性を親に報告して承認待ち。現段階ではalias追加、契約変更、本番origin偽装、TLS回避、CSP変更をしない。

## 準備完了の診断修正と1回の統合確認

Page.enable後、document-startに読み取りobserverを登録する。window/documentのcapture両方を記録し、`observer-installed`という起動証拠、実行context、時刻、document.readyState、adapterの存在/stateを残す。CMPイベントが0件でもobserver自体が起動したかを区別できる。補助サンプルは25ms間隔・10秒上限で状態変化時だけ記録し、Cookie値/全設定は読まない。`loaded`など未文書化のフラグを許可判定には使わない。

adapter候補は公式のCookiebotOnDialogDisplayも待受する。consent.method=nullは「同意なし」であり、未選択表示にはhasResponse=falseかつmarketing=falseとの一致が必要。method欠落はnullの代用にしない。拒否後のバナー再表示、DialogInitのみ、暗黙許可は引き続き広告停止。実CMPとの整合は今回のWindows実証で確認する。

既存Chromeパスを設定済みの同じPowerShellで、確定headと全manifestを確認してから1回:

```powershell
$env:VC_REAL_CMP = '1'
$env:VC_FIXTURE = 'generated'
$env:VC_UI_SEQUENCE = '1'
node tests/valuecommerce-transfer-probe.mjs > vc-readiness-ui.json
Remove-Item Env:VC_UI_SEQUENCE
Remove-Item Env:VC_REAL_CMP
Remove-Item Env:VC_FIXTURE
```

最初に遮断6ケース・observer起動を検証。1280x900の固定viewportで、操作対象をスクロールして表示範囲とelementFromPointの一致を確認し、実マウス入力する。main frameに実ダイアログがなければ停止する（別frameのコントロールへ座標を流用しない）。初回に拒否ボタンがなければ既知のDetailsボタンを1回だけ押して状態を記録する。OKを名前だけで許可とは扱わない。拒否/許可/設定の既知controlがなければそこで止め、記録されたid/tag/role/aria-label/textを親へ返す。イベントログ、UI対象、API/state、VC要求数を同じJSONで比較する。Cookiebot値を直接書き換えることはない。

Aliasはユーザーが公式フォームで追加し、親がconfiguration.js200と実バナーを確認済み。新しい設定変更は不要。この事実は未選択時のauto分類や保存済み拒否の検証完了を意味しない。

## 画面外コントロールの診断

WindowsでTextToggleがy974にあり、900px viewport外のため安全停止した。これは拒否/選択機能が存在しない証拠ではない。ハーネスのChrome起動ウィンドウとEmulationを共に1280x1400へ揃え、DPR1を指定。CSSやhidden/display属性を変更しない。実際のinner/outer/screen/visualViewport/client寸法、CDP layout/window bounds、対象と祖先7段の位置・高さ・overflow・scroll量を採取する。クリックは依然elementFromPoint一致が必要。

次回は同じ1回の統合コマンドにスクリーンショット先を追加できる。画像は隔離検証ページのみでローカル保存、Libraryアップロードなし。

```powershell
$env:VC_CAPTURE_DIR = Join-Path $PWD 'vc-layout-captures'
$env:VC_REAL_CMP = '1'
$env:VC_FIXTURE = 'generated'
$env:VC_UI_SEQUENCE = '1'
node tests/valuecommerce-transfer-probe.mjs > vc-layout-ui.json
Remove-Item Env:VC_CAPTURE_DIR
Remove-Item Env:VC_UI_SEQUENCE
Remove-Item Env:VC_REAL_CMP
Remove-Item Env:VC_FIXTURE
```

initial、操作直前、説明展開後のスクリーンショットとJSONを照合する。より大きいviewportでも画面外/遮蔽なら停止し、UI成功としない。非表示の選択controlは操作しない。SDK代案はこの実UI検証とは分離し、まだハーネスへ追加していない。

## ハング修正・逐次証拠（次回はこの形式）

クラウドの可視mockコントロール（y950）でPage.captureScreenshot無応答を再現。追加タブを閉じ、対象Page.bringToFrontを行うと、initial撮影→scroll/hit判定→直前撮影→祖先7段走査→実マウス1クリックが完了した。Windowsの元実行には途中ログがないため、同一原因と断定はしない。

各CDP応答は8秒上限。Runtime.evaluateは同期の読み取り/有限DOM操作だけとしawaitPromise=false、Chrome側実行上限3秒。コマンド開始/完了/timeoutを即時JSONL出力し、VC_EVIDENCE_FILEのUTF-8 JSONにも全証拠を逐次保存する。応答待ちで停止しても最後のmethod/idとevaluateラベルが残る。stdoutは単一JSONではなくJSONLになった点に注意。遅延応答、接続切断、タイムアウト保存の単体テストは通常CIにも含む。

ローカルmock実証は実CMPではない。外部通信を許可せず、可視controlのスクリーンショット・座標・祖先走査・クリック1回を検証した。Windowsで実再実行する場合の1回コマンド:

```powershell
$env:VC_CAPTURE_DIR = Join-Path $PWD 'vc-layout-captures'
$env:VC_EVIDENCE_FILE = Join-Path $PWD 'vc-layout-checkpoint.json'
$env:VC_REAL_CMP = '1'
$env:VC_FIXTURE = 'generated'
$env:VC_UI_SEQUENCE = '1'
node tests/valuecommerce-transfer-probe.mjs > vc-layout-progress.jsonl
```

チェックポイントJSONとprogress JSONLを返す。エラーでも同一実行を繰り返さず最後のmethod/id/labelを確認する。終了後、使用した環境変数を削除。VC_MOCK_UIは実CMPと同時指定不可。SDK代替は追加していない。すべて隔離プロフィール内で、本番設定/サイト挙動変更なし。

## 初期化競合の修正候補

VC readiness専用の小さなinline記録コードがCMP外部scriptより前に入り、controllerは後に残る。正式イベントよりcontrollerが遅れても現在のAPI状態を判定できる。広告処理/GA4をCMPより前へ移していない。公式の「CMPを最初のscript」推奨に対する記録専用コードの限定例外であり、公式承認済みとは扱わない。実CMP auto動作の検証と公開前レビューを継続する。

更新head/manifest確認後、前節の単一実行コマンドを使用する。観測上はDialogDisplayがcontroller前でも後でもunselectedになる必要がある。拒否/許可/保存拒否再読込/撤回を確認するまでは公開しない。stdout JSONLとVC_EVIDENCE_FILEを両方保存する。新しいアカウント/カテゴリ/許可先変更は不要。

## 実SDK統合検証（通常バナーUIとは別）

現行バナーの説明展開は成功したが、拒否/カテゴリ選択UIは現れず、OKは押していない。通常UIの再試行はしない。公式 https://www.cookiebot.com/en/developer/ のSDK呼出しを、同じ隔離プロフィールと既存ガード下で検証する専用フラグを追加した。

```powershell
Remove-Item Env:VC_UI_SEQUENCE -ErrorAction SilentlyContinue
Remove-Item Env:VC_MOCK_UI -ErrorAction SilentlyContinue
$env:VC_REAL_CMP = '1'
$env:VC_FIXTURE = 'generated'
$env:VC_SDK_SEQUENCE = '1'
$env:VC_CAPTURE_DIR = Join-Path $PWD 'vc-sdk-captures'
$env:VC_EVIDENCE_FILE = Join-Path $PWD 'vc-sdk-checkpoint.json'
node tests/valuecommerce-transfer-probe.mjs > vc-sdk-progress.jsonl
```

初期unselectedと実画像要素が成立した後、submitCustomConsent(false,false,false) → 同じprofileでreload → submitCustomConsent(false,false,true) → withdraw()を各1回。実プロパティは書き換えない。APIがなければ停止。実状態を最大5秒待ち、さらに1秒間の要求/DOMを観測してphaseを記録する。Cookie値は読まない。public PIDのみを要求識別に使い、同じ画像pathでも宿/体験を区別する。

sdkPhasesには前後のVC要求差分/ユニーク要求数/重複数、MutationObserverによるmount数、実API/stateを記録。reject/reload/withdrawでは新規要求0・mount0・画像0が必要。allowはexplicit/marketing=true、予定数のmount1回ずつ、同一宛先への重複要求なしを要求。撤回後に未選択扱いへ戻って画像が出れば失敗とし、成功へ丸めない。撤回後のhasResponseはfalseでもよいがgateはdeniedかunknownのみ許容。

これは実SDK/保存/ネットワーク制御の検証であり、公開バナーから拒否できる証明ではない。B案は確認済み未選択での広告要求を許容し、この試験ではそれを送信前に遮断する。『同意前通信が常に0』とは言わない。DOM除去は既に開始された要求を取消さず、拒否後に新たな要求がないことを検証する。account設定・課金・privacyカテゴリ・本番変更なし。

最小の公開UI案（未実装）: Cookiebot.renew()への設定リンクは既存バナーを再表示するだけなので、今回のバナーに拒否controlがなければ単独で解決しない。公式SDKで必要Cookieのみを選択する明示的な『任意Cookieを拒否』ボタンをサイト側に設ける案がある。これはユーザーの操作でsubmitCustomConsent(false,false,false)を呼ぶ変更で、同意/アクセス解析の条件コード自体は変えないが、公開UI変更として親が範囲を判断する。ベンダー設定の無断変更はしない。

## 保存拒否reloadの限定診断

head43ff36fの実SDK結果: rejectはexplicit denied・画像0・追加要求0・mount0で成功。Page.reload後はunselectedへ戻り画像/要求2件で停止。logconsent.ashx GETが遮断されたが因果関係は未確定。公開本番の不具合と断定しない。

次の診断はreject/reloadだけに限定し、allow/withdrawへ進まない:

```powershell
$env:VC_REAL_CMP = '1'
$env:VC_FIXTURE = 'generated'
$env:VC_SDK_SEQUENCE = '1'
$env:VC_SDK_PERSISTENCE_ONLY = '1'
$env:VC_EVIDENCE_FILE = Join-Path $PWD 'vc-persistence-checkpoint.json'
node tests/valuecommerce-transfer-probe.mjs > vc-persistence-progress.jsonl
```

VC_UI_SEQUENCE/VC_MOCK_UIは解除済みとする。初期・reject前後・reload前後に、実targetId/browserContextId/origin/portとCookieの名前/domain/path/expires/session/secure/httpOnly/sameSiteだけを保存する。CDPのCookie応答には値も含まれるが、受信後直ちに許可したmetadataだけを取り出し、値・cookieLine・headers・tokenはログ/チェックポイントに保存しない。ブラウザAuditsのCookie除外/警告理由とNetwork ExtraInfoのblockedReasonsも保存する。

設定変更、Cookie注入、allowlist緩和はない。コード上は同一Chrome profile/target/origin/portでPage.reloadするが、実測metadataで確認する。Cookie absentの場合とpresent-but-excludedの場合を区別し、同じCookie属性が保持されてもCMPが未回答になる場合は別の原因として扱う。Aliasで同意データを収集しないという一般説明だけでは、client側Cookieの保存可否やlogconsentの因果を証明できない。

## 承認済み・最大4回の同意ログを伴うSDK検証

2026-10-26 23:54 JSTに、テスト選択・テストURL・ブラウザ情報・接続元IPのCookiebotへの送信をユーザーが承認。前節のログ遮断による保存診断に代わり、次の1回を使用する。実CMPの応答で保存を検証し、Cookieを注入したり応答を模造しない。

指定headを取得し全manifestを照合後、既存CHROMIUM_BINを保持して実行:

```powershell
Remove-Item Env:VC_UI_SEQUENCE -ErrorAction SilentlyContinue
Remove-Item Env:VC_MOCK_UI -ErrorAction SilentlyContinue
Remove-Item Env:VC_SDK_PERSISTENCE_ONLY -ErrorAction SilentlyContinue
$env:VC_REAL_CMP = '1'
$env:VC_FIXTURE = 'generated'
$env:VC_SDK_SEQUENCE = '1'
$env:VC_ALLOW_CONSENT_LOG = '1'
$env:VC_CAPTURE_DIR = Join-Path $PWD 'vc-sdk-authorized-captures'
$env:VC_EVIDENCE_FILE = Join-Path $PWD 'vc-sdk-authorized-checkpoint.json'
try {
  node tests/valuecommerce-transfer-probe.mjs > vc-sdk-authorized-progress.jsonl
} finally {
  Remove-Item Env:VC_ALLOW_CONSENT_LOG -ErrorAction SilentlyContinue
}
```

通常の公開CMPリソースに加え、正確に `https://consent.cookiebot.com/logconsent.ashx` の初回GETだけを実行全体で最大4回許可。全リダイレクトは拒否（別CMP/local宛も拒否）。別host/path/port、POST、広告/GAは許可しない。上限到達/redirect/保存失敗時はそこで証拠を返し、自動再実行や上限拡張をしない。

consentLogScope/consentLogRequestsに許可条件・回数・判断を記録。query値、Cookie値、応答本文は保存しない。callbackやHTTP 200だけで保存成功とせず、実Cookie metadata、拒否reload時の実CMP状態とVC要求0を確認。成功すれば許可→撤回へ進み、失敗すれば停止。通常UIからの拒否到達性は別の未解決事項。今回も本番公開しない。
