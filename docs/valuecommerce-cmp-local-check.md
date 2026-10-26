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
