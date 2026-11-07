# 自動化の一覧

このサイトで、人の手を使わずに動いている仕組みの一覧です。時刻はすべて日本時間です。
GitHub Actions の画面: https://github.com/shotaro1001sudo/kagura-meguri/actions

## 1日の流れ

| 時刻 | 名前 | やること | 詳しく |
|---|---|---|---|
| 3:00(毎日) | build-and-deploy | サイトを組み立てて公開。終わった開催の整理、「今週末」「今月」ページの更新 | [deploy.yml](.github/workflows/deploy.yml) |
| 5:00(月曜) | weekly-collect | 開催情報を集め、検査に通ったものを掲載。怪しいものは保留にして Issue で確認依頼 | [COLLECT.md](COLLECT.md) |
| 5:15(毎日) | post-social | その日のX投稿6本(7時から4時間ごと)を Buffer に予約 | [SOCIAL.md](SOCIAL.md) |

## Claude の定期タスク(このPC)

Claude デスクトップアプリの「定期タスク」で動きます。**このPCが起動していて、Claude アプリが開いているときだけ**動きます。設定は `C:\Users\shota\.claude\scheduled-tasks\` にあります。

| 名前 | いつ | やること | 状態(2026-11-07) |
|---|---|---|---|
| kagura-meguri-daily-note | 2日に1回 18:00 | サイトの情報と公式情報から note 記事を書き、神楽日和(kagurabi_info)で公開。NOTE-LOG.md に記録 | 有効。ただし最後に動いたのは 10/21(PCやアプリが閉じていると動かない) |
| kagurameguri-monthly-research | (毎月1日 9:00 の予定) | 九州・中国・四国・近畿の掲載候補を調べて提案(読むだけ) | **未登録**。設定ファイルだけ残っていて、動いていない |

## 外部サービス

| サービス | やること |
|---|---|
| Buffer | post-social が予約した投稿を、時刻どおりに X へ出す。予約の確認・修正もここで |
| ChatGPT | 以前の X 投稿タスク。post-social と二重投稿になるので止める |

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
| 週次の自動収集: 確認が必要な項目があります | 保留の開催がある。管理ページで確認する |
| SNSの予約投稿(Buffer)が失敗しました | Buffer への予約に失敗。キーの期限・Buffer の予約上限を確認 |
| 【公開処理エラー】GitHub Actions #… | サイトの公開に失敗。ログを確認 |
| BufferのAPIキーを更新してください | キーの期限が14日以内。[SOCIAL.md](SOCIAL.md) の手順で更新 |

## 秘密情報(GitHub の Secrets)

値はリポジトリに書きません。GitHub → Settings → Secrets and variables → Actions で管理します。

| 名前 | 使う仕組み |
|---|---|
| `BUFFER_API_KEY` | post-social(期限 2027-11-07) |
| `MAIL_TO` ほか、メール送信用 | weekly-collect の通知 |
