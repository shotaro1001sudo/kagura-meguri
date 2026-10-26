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
