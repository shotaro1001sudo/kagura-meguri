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
