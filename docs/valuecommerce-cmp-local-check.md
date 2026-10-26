# 実Cookiebotローカル検証（2026-10-25・未公開）

実施コマンド: `node tests/valuecommerce-real-cmp.mjs`（ローカルChromiumが必要）。実config.jsonの公開Cookiebot ID・data-blockingmode=autoと、既存CSPを使用。localhostにローカルHTMLを配信し、本番のoriginやDNSを偽装しない。隔離ブラウザプロファイルを使用し、終了時に削除する。公開Cookiebot GETのみ許可し、広告・GA4等は要求段階で遮断する。管理画面・同意分類・CSP許可は変更しない。

## 今回の観測

- 初回: テストDNS制限が環境の既存proxyホストも対象にしていたため `ERR_PROXY_CONNECTION_FAILED`。
- 既存proxyホストのみDNS制限から除外して再確認: `https://consent.cookiebot.com/uc.js` が `net::ERR_TUNNEL_CONNECTION_FAILED`。
- localhost文書はcomplete。Cookiebot APIのhasResponse/consentは取得不能（id=Cookiebotのscript要素がwindow名として見えることとAPI準備完了は別）。独自ゲートはunknown、表示画像0、CMPボタン0。
- VC・広告・GA4への実送信は0件。広告リンクのクリック、テスト購入、CMPの管理設定変更は未実施。
- 実未選択/拒否/許可の比較は未実施。分類で止まったのか、ローカルドメインのライセンス制約なのかは未判定。今回の失敗を本番サイトの失敗と解釈しない。
- 生ログ: `/tmp/vc-real-cmp.log`、`/tmp/vc-real-cmp-proxy.log`。proxyの認証情報は出力していない。

## 再開条件

Cookiebotの公開配信先へ既存の正規接続経路で到達できる検証環境が必要。広告/GA4送信の遮断を維持して再試行し、まずローカルoriginが許容されるかを確認する。ドメイン不一致なら設定改変や本番origin偽装で回避せず報告する。実分類が未選択時の画像を遮断する場合もignore付与、necessary化、auto無効化で回避しない。3状態の実証と公開可否判断は別途必要。PR/push/merge/deployは行っていない。

## 再開時チェックポイント（2026-10-26）

最新main 983c2bb188039448aa8918bc46398342263753f1から別worktree `/workspace/kagura-vc-resume` に移植。元worktreeは保持。PR125の外部送信説明と診断CSSを維持して競合を解消。`/workspace/shared/valuecommerce-issued-code-evidence-2026-10-25.json` は現環境に存在しないが、`tests/fixtures/valuecommerce-issued.json` に発行元・取得日時・5原本例が残る。親が別途取得する証拠との照合待ち。

保存パッチの原本・状態単体テスト52件成功。実Chromium＋模擬CMPの検証成功（広告通信0）。実Cookiebotを通常経路で1回再確認したがuc.jsがERR_TUNNEL_CONNECTION_FAILED。API unavailable、gate unknown、画像0、実広告/GA4送信0。ログ `/tmp/vc-resume-browser.log`、`/tmp/vc-resume-real-cmp.log`。これは本番失敗や分類拒否を証明しない。実CMPの3状態と原本照合を公開条件として保留。設定・権限・CSPの回避変更は行わない。

統合検証: 全10,498テスト成功・0失敗、73イベント/6定期/142ページbuild成功。PR120で追加された宿泊案内テストを正式PID・外側wrapper・不活性templateに対応させ、宿泊日/人数/市町村/広告属性の検証を保持。PR125の提供会社と画像ホストの区別、一般方針と個別要求の留保を保持。公開操作なし。

親から元キャプチャ内容を再受領し、5コード文字列と取得日時・SID・program/materialを照合、一致。元ファイル全体のバイト/ハッシュ一致ではない（docs/valuecommerce-source-comparison.json）。追加の依存なしプローブとWindows手順は docs/valuecommerce-windows-validation.md。クラウドで6種の遮断事前検証成功。公開保留は実CMP統合・3状態の未検証による。

## Windows実CMPの確定ブロッカー（2026-10-26、親からの検証結果）

検証対象head: `ee7e67fa930c20a29deb7053d724e3e98dc7430d`。Windows側で13ファイルのSHA-256が一致し、画像/script/iframe/fetch/worker/追加タブの全6遮断事前検証が成功した。公開CMPのGET5件を許可。uc.jsと他3リソースは200、`127.0.0.1/configuration.js` は404。コンソールの確定エラー:

> The domain 127.0.0.1 is not authorized to show the cookie banner for domain group ID 6a4ea6ee-9934-4406-b303-5cc8e491a686. Please add it to the domain group in the Cookiebot Manager to authorize the domain.

ダイアログとCMP準備完了イベントは発生せず、gate=unknown、VC画像0・VC要求0。拒否/許可/保存済み拒否の再読込/撤回は未実施。これは当該テストoriginのドメイン未承認を示すもので、本番ドメインの失敗や未選択時のauto分類を示さない。クラウドの接続エラーとは別の、Windowsで実uc.jsへ到達した後のブロッカーである。

PR128はdraft・未マージ。設定追加、課金、origin偽装、TLS回避、CSP拡張は行っていない。親が既存の承認済みテストoriginを読み取り確認中。承認済みoriginでの同じ遮断を保った実検証が可能になるまで公開保留。新規aliasの追加を承認済みとは扱わない。

独立した小修正の評価: PIDだけの置換では現行の画像省略を残すため原本一式の要件を満たさない。画像だけの復元では未選択/拒否時通信の実証がないため採用しない。正式URL・原本fixtureの照合は完了済みの独立検証成果だが、本番変更に分割して実CMP検証を省く根拠にはならない。現時点で全要件を保った小さな本番修正は確認できていない。

## Alias追加後のWindows観測とローカル修正候補

親報告: ユーザー自身が公式Aliasフォームへ127.0.0.1を追加。configuration.jsは200となり、実バナー表示。hasResponse=false/marketing=false、gate unknown、VC画像・要求0。「もっと見る」「OK」のみが見える。ボタンの意味を許可/拒否と推測せず、状態変更操作前に停止した。

公式 https://www.cookiebot.com/en/developer/ はDialogDisplayをバナー表示、consent.method=nullを同意なし、hasResponseをaccept/declineへの応答と定義する。https://support.cookiebot.com/hc/en-us/articles/360020661139-How-to-find-out-when-the-Cookiebot-script-has-loaded はOnLoadがスクリプト読み込みではなく同意読み込みを意味すると明記。現アダプターはDialogDisplayを監視せず、初回未回答ではreadyObjectが設定されない可能性がある。ただし実イベント順序を受領しておらず、原因確定ではない。

ローカル候補は既存ready通知にDialogDisplayを追加するだけ。未知/method欠落/不整合/暗黙許可は停止、明示拒否は非表示を維持。DialogInitだけでは開始しない。新規15回帰を含む単体検証を実施。現行draftへ未push、生成fixture・hashはまだ旧headで、Windows診断後に更新する。実CMP状態の製造、バナー設定変更、カテゴリ変更はしない。

Windowsへの読み取り依頼: 現headのログcmpEvents（順序を保持）とinitial state、実ダイアログ/ボタンのid/role/text/aria-label、API hasResponse/consented/declined/consent.marketing/consent.method（値と型）を返す。可能ならdocument開始時から各イベントのperformance.now、document.readyState、window.kaguraVcConsentの存在とstateを記録し、DialogDisplayがアダプター初期化の前/後かを判断する。Cookie値・識別子・全設定のdumpは不要。OK/もっと見る/拒否/許可の操作は今回の診断ではしない。

診断版更新: Page.enableとdocument-start observerを明示し、window/document capture双方、observer起動、adapter出現時系列を記録。ガード6件とobserver起動ログをローカルChromiumで確認。adapter候補と観測コードの回帰を追加。新しい生成fixture/hashへ更新してWindowsの1回の統合確認に引き渡す。過去の空イベントログだけでイベント不発とは判断しない。

## Windowsで初回未選択の実証（head87475b8）

親報告: observer起動14ms、実CookiebotOnDialogDisplay2017ms、gate unknown→unselected2840ms。hasResponse=false/marketing=false/method=null。正式VC画像2要素と2種類の要求を送信前遮断。公開CMP GET5件200、非許可外部要求のcontinueなし。これは初回未選択判定を実証するが、拒否/許可/再読込/撤回はまだ未検証。

実controlはCybotCookiebotDialogBodyContentTextToggle（もっと見る）、CybotCookiebotDialogBodyLevelButtonAccept（OK）。ローカルのハーネス候補に前者を説明展開として追加し、checkboxのchecked/disabled/labelsとinput typeも診断へ追加。汎用AcceptをAllowAllの代替とするselectorは削除。親が説明展開後のDOMを取得中なので、この段階では追加probeを要求せず結果を待つ。OKを自動クリックしない。

公式資料 https://support.cookiebot.com/hc/en-us/articles/26407083994524-Configuration-of-the-Swift-banner-in-the-Cookiebot-Manager はElementalをclassic templateと区別し、Multilevelの1ボタンOKは選択されたカテゴリを送信すると説明する。今回のElemental構成へ機械的に適用はせず、実checkbox/labelとAPI状態で判定する。説明展開がカテゴリ選択画面を意味するとは限らない。

選択/拒否UIが本当にない場合の代案（まだ未実施）: 公式SDK https://www.cookiebot.com/en/developer/ のsubmitCustomConsent(false,false,false)で必要カテゴリのみ、submitCustomConsent(false,false,true)でmarketingのみを、隔離検証用の明示ボタンから呼ぶ方式が候補。renew()は設定ダイアログ再表示、withdraw()は撤回の公式メソッド。Cookiebotプロパティ直接代入と異なるが、これはSDK経路の検証であり公開バナーに拒否UIが存在する証明ではない。実イベント/hasResponse/marketing/method・保存再読込・要求数で結果を確認する必要がある。現行公開UIに拒否導線がなければ別の設定/UX課題として親へ報告し、勝手にバナー設定変更しない。

追記: Windowsのもっと見る中心y974は900px viewport外でhit=false。非表示の選択・拒否controlはDOMに存在するが未操作。設定機能欠如と結論しない。Chrome実ウィンドウ/エミュレーションを1280x1400へ一致させ、layout/window/visualViewportとスクリーンショット、祖先overflowを同時記録する診断を準備。CSSや非表示controlを変更せず、hit検査を維持。

ハング診断: bounded CDP導入後、クラウドの実Chrome可視mockでPage.captureScreenshotが8秒無応答になることを再現し、timeoutと直前の初期DOM/layoutを保存できた。遮断用追加タブを閉じ、対象ページを前面に戻して再検証した結果、初回/直前撮影、座標hit、祖先走査、実クリック1回が完了。無限祖先ループは再現せず（最大7段、実例4段）。Windowsの過去ハング操作は未記録なので同一原因との断定は避ける。実CMP再実行時は8秒CDP上限、3秒同期evaluate上限、逐次JSONL+JSON証拠を使う。

## 実イベント先行の初期化競合（Windows head8541a0c）

親報告: DialogDisplay924ms時点adapterPresent=false、adapter出現948ms/state unknown、TagsExecuted971msでもunknown。イベント前後のAPIはhasResponse=false/marketing=false/method=null。画像・要求0で停止。これはloadedフラグや待機時間では解決しない。

修正はVCページ限定のvaluecommerce-ready.jsをCMP外部script直前へ配置し、公式の準備完了イベントでCMPオブジェクト参照だけをメモリーに保持する。通信・保存・描画・同意判断は行わず、controllerはCMP後のまま現在のhasResponse/marketing/methodを厳格判定する。イベントの有無とオブジェクト同一性を確認し、古い許可値のスナップショットを再生しない。pagehideで参照を破棄。GA4の順序/条件は維持。

公式 https://support.cookiebot.com/hc/en-us/articles/10714664673564-Manually-implementing-Cookiebot-CMP-Cookiebot-Admin はCookiebotをheadの最初のscriptにすることを推奨する。今回の記録専用inlineだけがその前に置かれる限定例外で、Cookiebotは最初の外部scriptとして維持。公式にこの例外の承認を得たとは主張しない。CSPは既存のハッシュ生成を使い許可先を拡張しない。ignore属性やカテゴリ変更はない。draftで実CMPの自動ブロックと拒否保護を検証し、公開前レビュー対象として残す。

DialogDisplayがcontroller前/後、保存済み拒否、イベント重複、撤回、controller前に拒否へ変化、loadedだけではunknownを検証。任意時間のdelay/pollを許可判断に使わない。生成fixtureもこの順序へ更新する。

head59d093dのWindows実証: 全18ハッシュ・ガード6成功、CMP GET5のみ続行、unselectedで正式画像2件要求を遮断。実text-toggleの展開成功後も拒否/カテゴリUIなし、OK未操作。通常UIテストはここで停止。親承認により実SDKの必要Cookieのみ→保存拒否reload→marketingのみexplicit許可→withdrawの独立検証を準備。実SDK成功は公開UIのアクセス可能性を証明しない。passive recorderの先行は公式first-script文言への限定技術的逸脱として保持し、別途ベンダー承認が必須だとは扱わない。公開の工学的条件は実状態・要求・拒否/撤回の保護確認である。

実SDK head43ff36f: reject成功、reloadで未回答へ戻り失敗。親保管vc-sdk-checkpoint.json SHA256=329a28fd36ea019d403ae6e409e23b9c469cb99a4b624fc991bc62b3dfea996b。allow/withdraw未実施。logconsent GET遮断の因果不明。metadataのみのreject/reload限定診断を追加。保存Cookie属性とブラウザ除外理由、同一context/origin/portを比較する。生Cookie値/headersの記録・Cookie注入・許可先変更はしない。
