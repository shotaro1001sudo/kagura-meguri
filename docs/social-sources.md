# 保存会・社中のSNS開催情報（2026-11-05）

## できること

X（Twitter）・Instagram・Facebookの**公開された一次投稿**を人が読み、主体・開催日・会場を確認して、既存の開催一覧・詳細・地図・カレンダーへ掲載できます。画像・投稿全文・外部埋め込みは追加しません。新規API、課金、認証情報、接続権限、巡回タスクは追加していません。

1. `/submit.html` の「公式情報のURL」で個別投稿リンクを受け付けます。従来どおりメールに届く下書きは `pending` です。依頼者による入力は確認済み根拠として扱いません。
2. 管理画面で投稿を開き、ログイン不要で全文の開催事実を読めることを確認します。検索要約、転載、プロフィールだけ、消えた投稿、ログイン要求、アクセス拒否では承認しません。アクセス制限を回避しません。
3. 団体サイト・自治体・観光協会から投稿元への公式リンクなどで主体を確認し、保存会・社中名、根拠URL、確認内容、確認日を記録します。一般観覧可能な公演であることも確認してください。
4. 開催年・日・市区町村・会場を確認し、時刻不明なら「時刻は未定・不明」を選びます（`timeUnknown: true` と `00:00`）。料金・終演時刻は分かる場合だけ入力します。別々の日程は別レコードにします。
5. 管理画面のSNS確認チェックを入れて保存します。確認した開催事実は `socialEvidence.facts` に記録されます。後から日時・会場・料金等を変更すると、そのままでは公開できません。根拠を読み直して再確認してください。
6. 従来のテスト・ビルド・本番公開手順を使います。SNSの出典リンク、保存会・社中名、確認日が詳細ページに表示されます。

同じ公演は既存レコードに統合します。名称の表記揺れに加え、同日・同会場・同市区町村・同時刻（または時刻不明）、同日の同じ投稿IDも重複候補として止めます。X/twitterのドメイン違い、追跡クエリ、Instagramのp/reelの違いは投稿IDで照合します。誤一致の可能性があるので、機械的な削除や上書きはしません。1投稿に同日複数公演がある場合も自動追加せず、内容を整理して確認します。

管理画面の保存、`review.mjs approve` / `approve all`、本番ビルドで根拠を検査します。`status: published` を直接書くだけでは通りません。既存の非SNS公演の検査は維持しています。

## ローカルファイルから保留へ受け入れる

```sh
node scripts/import-social.mjs /path/to/candidate.json
node scripts/review.mjs
```

候補JSONには通常の開催項目 `id/name/kagura/prefecture/city/venue/start/url` と任意の `address/end/timeUnknown/fee` を入れます。URLはXの `/名前/status/ID`、Instagramの `/p/ID`・`/reel/ID`、Facebookの `/ページ/posts/ID`・`/events/ID`・`permalink.php`・`story.php` の個別リンクに対応します。プロフィール、短縮URL、share、storiesは受け付けません。原投稿URLを確認してください。

このコマンドは通信せず、公開状態や確認済みフラグ、画像、本文を持ち込まずに**必ず保留**にします。重複時は書き込みません。管理画面で確認するのが基本です。リポジトリで直接編集する場合は、公開投稿を実際に確認した担当者が `socialEvidence` に `postUrl/organizer/authorityUrl/authorityNote/checked/publicAccess: true/facts` を記録します。`facts` は `socialFacts(event)` の形式で、名称・種類・所在地・日時・料金を含みます。`checked` は開催レコードの確認日と一致させます。記録は確認行為の証跡であり、プログラムが投稿の正しさを証明するものではありません。

投稿が削除・非公開・訂正されたと判明したら、再確認まで `pending` または `withdrawn` に戻します。SNSは自動巡回しないため削除の即時検知はできません。訂正依頼は既存の `/contact.html` を使います。

## 自動収集と公式資料の確認範囲

- X: [Developer Guidelines](https://docs.x.com/developer-guidelines) を2026-11-05に原文確認。非APIのスクレイピング・ブラウザ自動化は認められていません。[Pricing](https://docs.x.com/x-api/getting-started/pricing) は同日確認。従量課金・事前クレジット購入が必要です。今回は新規API・課金を使いません。
- Instagram: [Terms of Use](https://help.instagram.com/581066165581870/) は検索結果の公式抜粋に無許可の自動収集禁止が表示されましたが、直接取得は429でした。**原文確認済みとは扱いません**。[Instagram Platform overview](https://developers.facebook.com/documentation/instagram-platform/overview) も直接アクセスできませんでした。
- Facebook: [Automated Data Collection Terms](https://www.facebook.com/legal/automated_data_collection_terms) はログイン・一時ブロック画面になりました。**規約本文を確認できていません**。制限回避や追加接続は行っていません。
- 検索結果は投稿の発見候補に限ります。日時・会場・公式主体を公開一次情報で確認できなければ保留です。既存の無料接続で任意の保存会の投稿を網羅して取得できることは確認できていません。

`collect.mjs` はSNSドメインを通信前に除外し、アダプタがSNS URLを返しても取得しません。通常ページのリダイレクトは、各転送先を通信前に検査し、SNSなら停止します。通常サイトの転送はrobotsを確認し、間隔を空けて最大5回まで追跡します。全国拡張ソースは同一オリジン限定を維持します（拒否・失敗時は既存データを保持し、レポートで確認）。既存のtermsChecked・robots・件数上限・失敗時無変更の装置は維持します。通常アダプタがSNSリンクを候補として返した場合も自動公開せず保留にします。SNS用の `data/sources.json` 登録・termsCheckedの日付の追加はありません。

## 実データの扱い

新しいSNS公演は追加していません。既存の `ev-20261031`（三川内神楽・2026-10-31霜月祭）はInstagramのプロフィールURLしかなく、個別投稿による根拠が不足するため保留へ戻しました。元の開催情報・確認日は残し、2026-11-05の保留理由を追記しています。開催日はすでに過ぎており、今後の開催一覧の件数は変わりませんが、当該詳細ページは生成されなくなります。

今後の主体確認候補として、福岡県観光連盟の [京築神楽](https://www.crossroadfukuoka.jp/feature/keichiku-kagura) で団体SNS一覧を確認しました。SNS投稿自体の確認は未実施のため、公演データや検証済みアカウントとしては登録していません。

### 主体確認の入口（2026-11-05、公式リンク照合）

| 保存会・社中 | SNSアカウント | 主体確認の根拠 |
|---|---|---|
| 横瀬神楽講 | [Instagram](https://www.instagram.com/yokosekagurakou/) / [Facebook](https://www.facebook.com/yokosekagurakou/) | [福岡県観光連盟](https://www.crossroadfukuoka.jp/feature/keichiku-kagura) |
| 友枝神楽講 | [Instagram](https://www.instagram.com/tomoeda1927/?hl=ja) | [福岡県観光連盟](https://www.crossroadfukuoka.jp/feature/keichiku-kagura) |
| 相模里神楽 垣澤社中 | [X](https://x.com/kakizawa_kagura) / [Instagram](https://www.instagram.com/kakizawa_kagura/) / [Facebook](https://www.facebook.com/sagamisatokagura) | [社中公式サイト](https://www.sagami-satokagura.com/movie) |

これは主体確認の入口のみです。投稿の開催事実・公開可否は未確認で、巡回設定や掲載済み公演としては登録していません。

既存取得元の転送確認を2026-11-05に試みましたが、この実行環境では有効な15取得元のrobots.txtを取得できず、公開ページへの確認アクセスは行っていません。現地のHTTP転送状態は未確認です。ローカルテストでは通常の301転送、転送先robots拒否、SNSへの302転送、全国拡張ソースの別オリジン拒否を検証しています。
