# 神楽めぐり｜全国公演情報源の拡大（2026-10-21）

## 現状とこの変更の範囲
- 現在の定期収集は毎週月曜05:00 JST（`.github/workflows/collect.yml`）。自動掲載は検証済み収集元のみ。
- 既存の有効収集元は3件（安芸高田市観光協会、高千穂町観光協会、NPO広島神楽芸術研究所）。
- 今回、新たな公式情報源候補6件を `data/sources.json` に登録。**全件 `enabled: false`、`termsChecked: ""` のため、取得・公開処理にはまだ追加されない。**
- 候補の公開ページが見つかった事実と、robots/利用規約/抽出精度/自動掲載の適格性は別。未検証の状態で `termsChecked` に日付を記入しない。

## 候補（優先度）
| 優先 | source ID | 県 | URL | 初期の確認事項 |
| --- | --- | --- | --- | --- |
| 1 | kagura-kaikan-oita | 大分 | https://www.kagura-kaikan.jp/category/performance | 月例記事から開催日を正確に抽出し、記事投稿日を誤用しない |
| 2 | hanamaki-hayachine | 岩手 | https://www.kanko-hanamaki.ne.jp/event/ | カレンダーの月別ページ、神楽だけの抽出 |
| 3 | miyazaki-kanko-events | 宮崎 | https://www.kanko-miyazaki.jp/event | 一覧の複数ページ・複数日公演・高千穂の既存データとの重複 |
| 4 | okayama-kanko-kagura | 岡山 | https://www.okayama-kanko.jp/event/index.html | 備中神楽の日程・1日複数回・既存定期公演と重複 |
| 5 | hamada-yokagura | 島根 | https://hamada-yokagura.jp/ | 毎週公演を展開する専用アダプタ・既存の定期公演レコードとの二重登録 |
| 6 | shimane-kagura-calendar | 島根 | https://www.kankou-shimane.com/kaguraarizuki/archives/1237 | 単年度のキャンペーンページを最新年へ更新する方法・重複 |

## 有効化の工程（1情報源ごとに別PR）
1. 公式サイトの表示内容、主催者、URL、ページの更新性を確認。
2. 利用条件・機械取得に関する案内を確認し、`robots.txt` を実際のBot UAで確認。禁止なら収集せず候補として保留。画像・本文を転載しない。
3. 対象ページの実際のHTMLを読み、`selectors` または専用アダプタの抽出処理を実装。事前に固定したHTML見本でテスト。予想セレクタのまま有効化しない。
4. 0件／複数日／年跨ぎ／時刻未定／重複／突然の異常値／古い情報の誤公開を含むテストを行う。定期公演は既存 `data/regular.json` と重複しないこと。
5. 実際の収集を**公開なし（dry-run）**で確認し、URL・日時・地域・会場・出典が正しいことを照合。誤情報や権利リスクがあれば保留。
6. 情報源ごとに `termsChecked`、`notes`、確実な `adapter` 設定を加え、`enabled: true` にするPRを作成。全テスト・必須CI成功と費用0円の確認後にマージ可能。
7. 次の収集レポートで「収集件数／掲載／保留／重複／取り下げ」を確認し、本番サイトの反映と情報品質を別々に確認する。問題時は該当情報源のみ停止する。

## 連携
- GitHub: このファイルと `data/sources.json` が収集元の管理原本。
- Google Sheets: 「神楽めぐり｜統合管理台帳・チーム連携ダッシュボード」に候補名・状態・出典・担当・次作業を記録。
- チーム: 企画が採用候補を評価、改修がアダプタ・テスト・PR、マネジメントが費用リスクと公開成否を必要時に監査。
- 公演の時刻・料金・予約情報は公式一次情報を優先し、未確認項目は推定で補完しない。

この追加は収集対象の**候補登録**であり、自動取込や本番公演数の増加ではない。
