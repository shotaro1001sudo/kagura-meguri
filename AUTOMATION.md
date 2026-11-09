# 自動化の一覧

このサイトで、人の手を使わずに動いている仕組みの一覧です。時刻はすべて日本時間です。
GitHub Actions の画面: https://github.com/shotaro1001sudo/kagura-meguri/actions

## PDCA(週1回まわる)

自動化は、ばらばらに動くのではなく、**週次の振り返り**を中心に1週間で1周します。

```
Plan  計画     data/weekly-review.json の focus(掲載が少ない地方・時刻未定の開催)
  │            analytics/focus.json(このPC・非公開。検索で求められている題材・未掲載の開催)
  │              → note の題材選び・月次の調査の優先順位に使う
  │            data/social-performance.json(SNSのテーマ別の反応)→ SNSで出す順番に使う
  ▼
Do    実行     週次の自動収集(月 4:00)→ 公開(毎日 3:00)→ SNS予約(毎晩 21:15 に翌日分)→ note(2日に1回)
  │
  ▼
Check 点検     週次の振り返り(月、収集の直後。GitHub)
  │              掲載数(14/30/60日・地方別)、収集の結果、SNSの予約数・取りこぼし、読み物の残り、
  │              SNSの反応(テーマ別の倍率。実数は公開しない)、好み診断の根拠と対象(docs/quiz.md の「定期メンテ」)
  │            検索・アクセス分析(月 9:00。このPC)
  │              Search Console・GA4 の前週比、検索語ごとの改善の余地、流入元、前回の改善の効果
  ▼
Act   改善     振り返りの Issue に「今週やること」(担当: 人 / Claude)。先週の Issue は閉じ、手書きの未完了は持ち越す
                 SNS は反応のよいテーマを自動で先に出す
                 検索の改善案は ID(SEO-日付-番号)付きで analytics/ に。実施したかと効果を、翌週以降に自動で確かめる
```

**最終目標と KPI:** 売上(広告・アフィリエイトの報酬と、協賛・有料プランの収入)の月額の目標と期限、そこから作った KPI、収益化の案は、非公開の `analytics/plan.json` にあります。採用・見送り・目標の数・手入力の実績(楽天・AdSense・直接の契約)は、管理者用ページの **「目標・収益」** で決めます。月曜の検索・アクセス分析は、まず売上と KPI の実績を出して(バリューコマース・GA4 は自動。提案・契約の数は営業の台帳から)目標に対する遅れと営業の進み具合(1週の目安に対する提案の数・連絡の漏れ)を点検し、改善案を売上への効果の順に並べます。

**数字の置き場所:** 掲載数などサイトの数字は公開(GitHub)。アクセス数・検索の数字は公開しない(非公開スプレッドシートと、このPCの `analytics/`。git に入らない)。SNS は倍率だけ公開し、実数は Buffer の画面で見る。

**運営者が毎週すること(月曜)**

1. 9時すぎに届く通知のあと、管理者用ページ(デスクトップのショートカット、または `npm run admin`)の **「判断待ち」** を開く。人が決めることが、ここにまとまっている
   - 保留中の開催: 公式情報を確かめて「掲載」か「却下」(すぐにサイトに反映)
   - 振り返りの【人】の項目: 確認先のリンクから確かめ、終えたら Issue にチェック
   - 検索の改善案: やるものは「Claude に頼む文をコピー」して Claude に貼る(Claude はコミットのメッセージに ID を入れ、実施の確認に使う)。やらないものは「見送る」(同じ案が出なくなる)
   - 営業: 連絡する日が来た相手に連絡し、今週の提案が1週の目安に届くまで候補に送る。送ったら「送った」、返事が来たら「返信があった」を押す(非公開の `analytics/pipeline.json`。提案した数・契約数の KPI に自動で入る)
   - 目標・収益: 決めていない KPI・収益化の案を「採用」か「見送る」。先月の楽天・AdSense・直接の契約の実績を「実績を入れる」に入れる
2. 「週次の振り返り」Issue の【Claude】の項目は、Claude に「週次の振り返りの Claude の項目をやって」と頼む
3. 気づいたことは Issue にコメントするか、`- [ ] やること` を本文に書き足す(来週に持ち越される)


目安(今後30日の掲載30件、保留10件以下など)は [scripts/lib/weekly-review.mjs](scripts/lib/weekly-review.mjs) の `TARGETS` で変えられます。

## 1日の流れ

| 時刻 | 名前 | やること | 詳しく |
|---|---|---|---|
| 3:00(毎日) | build-and-deploy | サイトを組み立てて公開。終わった開催の整理、「今週末」「今月」ページの更新 | [deploy.yml](.github/workflows/deploy.yml) |
| 4:00(月曜) | weekly-collect | 開催情報を集め、検査に通ったものを掲載。怪しいものは保留にして Issue で確認依頼(先週の確認依頼は閉じる) | [COLLECT.md](COLLECT.md) |
| 収集の直後(月曜) | weekly-review | SNSの反応を集め(data/social-performance.json)、週次の振り返り。数字の点検と「今週やること」の Issue。data/weekly-review.json を更新 | [weekly-review.yml](.github/workflows/weekly-review.yml) / [SOCIAL.md](SOCIAL.md) |
| 7:31 ごろ(毎日) | Apps Script(Google 側) | GA4・Search Console の数字を、非公開スプレッドシート(統合管理台帳の 12〜14)に保存 | [docs/analytics-quality.md](docs/analytics-quality.md) |
| 21:15(毎晩)・5:15(毎朝) | post-social | 晩に、翌日のX投稿6本(7時から4時間ごと)を Buffer に予約(GitHub の起動が遅れても朝の枠が飛ばない)。朝は空いた枠だけ埋める | [SOCIAL.md](SOCIAL.md) |

## Claude の定期タスク(このPC)

Claude デスクトップアプリの「定期タスク」で動きます。**このPCが起動していて、Claude アプリが開いているときだけ**動きます。設定は `C:\Users\shota\.claude\scheduled-tasks\` にあります。
どれも、始めに `git fetch` で GitHub 上の最新データ(週次収集の結果と data/weekly-review.json)を読みます(作業中のファイルは書き換えません。書くのは `analytics/` と NOTE-LOG.md だけ)。

| 名前 | いつ | やること | 状態(2026-11-07) |
|---|---|---|---|
| kagurameguri-weekly-analytics | 毎週月曜 9:00 | Chrome で非公開スプレッドシートの売上(11)・GA4・Search Console を読み、目標(analytics/goal.json)に対する売上の進み具合、前週比・改善案(SEO-ID 付き)・前回の改善の効果を `analytics/weekly-<日付>.md` に。`analytics/state.json`(提案の追跡)と `analytics/focus.json`(次の計画)も更新。Claude が進められること(営業・掲載・KPI・記事など)は「Claude に頼めること」(ADV-…、週5件まで)として「判断待ち」に、未送信の営業の候補が足りなければ新しい候補を `scripts/admin/propose-lead.mjs` で台帳に(週3件まで)足す。データが足りず判断できなかったことは、計測の改善案(MEAS-…、週2件まで)として「判断待ち」に出す。根拠のある新しい収益化の案は、`scripts/admin/propose-mon.mjs` で「検討中」として plan.json に足す(週2件まで。採用・見送りは運営者)。要約を通知 | 有効(2026-11-07 登録)。初回は手動の「Run now」で、Chrome の操作を許可しておくとよい |
| kagura-meguri-daily-note | 2日に1回 18:00 | note 記事を書き、神楽日和(kagurabi_info)で公開。振り返りの focus の地方を優先して題材にする。時刻の判明・データの食い違いを NOTE-LOG.md に記録 | 有効。ただし最後に動いたのは 10/21(PCやアプリが閉じていると動かない) |
| kagurameguri-monthly-research-2 | 毎月1日 9:00 | 振り返りの focus の地方を優先して掲載候補を調べ、提案する(読むだけ)。自動収集に回せる「収集元の候補」も挙げる | 有効(2026-11-07 登録。初回は 12/1)。番号なしの kagurameguri-monthly-research は、登録前の古い設定フォルダ |

## 外部サービス

| サービス | やること |
|---|---|
| Buffer | post-social が予約した投稿を、時刻どおりに X へ出す。予約の確認・修正もここで |
| ChatGPT | 以前の X 投稿タスクと「統合運営」(スプレッドシートの分析・SNS記録・社内指示)。**Claude の仕組みに一本化したので止める**(運営者が ChatGPT 側で停止)。ChatGPT が書いていたシート(00〜10・15〜19)は、2026-11-07 に削除した(必要ならスプレッドシートの「変更履歴」から戻せる)。統合管理台帳に残るのは、Apps Script が書く 11(バリューコマース)・12〜14(GA4/GSC)だけ |
| Google Apps Script | GA4・Search Console の数字を毎朝、非公開スプレッドシートに保存。検索・アクセス分析の材料。これは止めない |

## きっかけがあると動くもの

| きっかけ | 名前 | やること |
|---|---|---|
| main へのプッシュ | build-and-deploy | サイトを公開し直す |
| サイトの公開が終わったとき | team-handoff-after-publish | 公開が失敗したときだけ、「【公開処理エラー】」の Issue を立てる(成功時の引継ぎ Issue は 2026-11-07 に廃止。開いていれば自動で閉じる) |
| プルリクエスト | PR checks / Source validation | テスト・ビルド、情報源リストの検査 |

## やめたもの(2026-11-07)

| 名前 | 理由・戻し方 |
|---|---|
| post-x(X API への直接投稿) | Buffer 経由(post-social)に置き換え |
| 公開成功の引継ぎ Issue(【集客引継ぎ・公開処理成功】) | ChatGPT への受け渡し用で、閉じられずにたまっていたため |
| valuecommerce-private-sheets-sync / valuecommerce-readonly-check | 手動専用で使っていなかったため。スクリプトは残してあり、使うときは git の履歴からワークフローを戻す |

## 失敗したとき

ほとんどの仕組みは、失敗すると GitHub に Issue を立てます(メールでも届きます)。Issue に書かれたログのリンクから原因を確かめてください。

| Issue の題 | 意味 |
|---|---|
| 週次の振り返り(日付) | 失敗ではなく、毎週の点検結果。「今週やること」を進める |
| 週次の振り返りが、失敗しました | 振り返りの作成に失敗。ログを確認 |
| 週次の自動収集: 確認が必要な項目があります | 保留の開催がある。管理ページで確認する(新しいものが立つと、古いものは閉じる) |
| SNSの予約投稿(Buffer)が失敗しました | Buffer への予約に失敗。キーの期限・Buffer の予約上限を確認(続けて失敗したら、同じ Issue に追記) |
| 【公開処理エラー】GitHub Actions #… | サイトの公開に失敗。ログを確認 |
| BufferのAPIキーを更新してください | キーの期限が14日以内。[SOCIAL.md](SOCIAL.md) の手順で更新 |

## 秘密情報(GitHub の Secrets)

値はリポジトリに書きません。GitHub → Settings → Secrets and variables → Actions で管理します。

| 名前 | 使う仕組み |
|---|---|
| `BUFFER_API_KEY` | post-social(期限 2027-11-07) |
| `MAIL_TO` ほか、メール送信用 | weekly-collect の通知 |
