# 収益化(広告・アフィリエイト・アクセス解析)

サイトの仕組みは、できています。各サービスに登録して、得た ID を `config.json` に入れると、その部分だけが有効になります。
ID が空の間は、報酬のない、ふつうのリンクとして動きます(「PR」の表示も出ません)。

| 仕組み | 場所 | 有効にする設定(`config.json`) |
|---|---|---|
| 会場近くの宿(じゃらん) | これからの開催のページ(開催日の1泊・大人2名で検索) / 種類・都道府県・定期公演のページの「旅支度」 | `affiliate.valueCommerceSid` と `affiliate.jalanPid` |
| 公演前後の体験(じゃらん遊び・体験) | 開催・定期公演・都道府県のページの「公演の前後も楽しむ」 / 周辺体験のページの47都道府県 | `affiliate.valueCommerceSid` と `affiliate.jalanActivityPid`(宿のpidとは別) |
| 会場近くの宿(楽天トラベル) | 同上 | `affiliate.rakutenAffiliateId` |
| 神楽の本・グッズ(Amazon) | 「旅支度」(設定したときだけ表示) | `affiliate.amazonTag` |
| ディスプレイ広告(AdSense) | 一覧・開催ページなどの決めた場所(手動)+ 画面下の固定広告(自動広告のアンカー) | `adsense.client`、`adsense.slotList`、`adsense.slotDetail` |
| アクセス解析(GoatCounter) | すべてのページ(Cookie なし)。宿のリンクのクリック数も数える | `goatcounter` |

ID を設定すると、プライバシーポリシー・免責事項・運営者情報の記載も、自動で切り替わります。広告とアフィリエイトのリンクには「広告」「PR」と表示します(ステルスマーケティング規制への対応)。

## 1. 楽天アフィリエイト(楽天トラベル)

1. https://affiliate.rakuten.co.jp/ に楽天会員でログインし、利用を開始します(審査なし)。
2. 「サイト情報の登録」で、サイトURL `https://kagurameguri.jp/` を登録します。
3. 「楽天アフィリエイトID」(例: `1a2b3c4d.5e6f7a8b.1a2b3c4e.5f6a7b8c`)を控え、`affiliate.rakutenAffiliateId` に入れます。

## 2. バリューコマース(じゃらん)

1. https://www.valuecommerce.ne.jp/ にログインし、サイト `https://kagurameguri.jp/` を登録します。サイトID(**sid**、数字)を控えます。
2. 「広告 → プログラム検索」で「じゃらん」を探し、「★ホテル・宿予約サイト「じゃらんnet」」(プログラムID 2021810)に**提携を申請**します(即時提携。審査なし)。
3. じゃらんnet の「自由テキスト」の広告で「広告作成」を押し、できたコードの `pid=`(数字)を控えます。これがリンク用の **pid** です(プログラムIDとは別の番号)。
4. `affiliate.valueCommerceSid` に sid、`affiliate.jalanPid` に pid を入れます。

設定済み(2026-10-13): sid `3784232` / pid `892725735`。リンクは `ck.jp.ap.valuecommerce.com/servlet/referral?sid=…&pid=…&vc_url=(じゃらんの検索URL)` の形で、行き先がじゃらんの市町村の宿の検索になることを確認済み。

体験(2026-10-25): じゃらん 遊び・体験予約(プログラムID 2139176、即時提携、予約完了3.3%・利用確認後に成果)と提携。MyLinkで発行した pid `892732911` を `affiliate.jalanActivityPid` に設定。発行コードの1px計測画像は使わない。クリックは GoatCounter の `experience-jalan/<地域コード>`。

## 3. Google AdSense

1. https://adsense.google.com/ で、サイト `kagurameguri.jp` を登録し、審査を申し込みます。
2. 審査用のコードの設置を求められたら、サイト運営者ID(`ca-pub-` で始まる値)を `adsense.client` に入れて公開します(このとき `ads.txt` も自動で作られます)。
3. 審査に通ったら、AdSense で「広告ユニット(ディスプレイ広告)」を2つ作り、それぞれの「data-ad-slot」の数字を `adsense.slotList`(一覧ページ用)と `adsense.slotDetail`(開催ページ用)に入れます。
4. 自動広告は、AdSense の「広告 → サイトごと → 自動広告」で、**アンカー広告だけ**を有効にし、ほかの形式(記事内・サイドレールなど)はオフにします。

## 4. GoatCounter(アクセス解析)

1. https://www.goatcounter.com/signup で無料のアカウントを作り、コード(例: `kagurameguri`)を決めます。サイトの URL は `https://<コード>.goatcounter.com` になります。
2. コードを `goatcounter` に入れます。
3. 宿のリンクのクリック数は、GoatCounter の画面で `stay-jalan/<開催のID>`、`stay-rakuten/<開催のID>` という名前で見られます。

## 設定のしかた

ID がそろったら、Claude に「config.json に ◯◯ の ID を入れて」と、値を伝えてください。これらの ID は、もともとページに公開される値なので、伝えても問題ありません(パスワードとは違います)。
各サービスのパスワードやログイン情報は、伝えないでください。

## 宿の画像バナー(楽天トラベル・じゃらんnet)

開催・定期公演のページ(要点の下)と、県・種類のページの宿の帯に、画像バナーを出します。発行コードのリンクと画像の組は `scripts/lib/stay-banners.mjs` に、そのまま登録しています(リンクは1文字も変えない)。

- 出すのは、楽天・バリューコマースの提携IDが設定されているときだけです(ID が空なら、バナーも出ません)。
- じゃらんの発行コードは JavaScript だったため、その出力(リンクと画像)を静的に書き直しています。見えない計測画像(1px)は、使いません。
- クリックは、GoatCounter で `banner-rakuten/<ID>`・`banner-jalan/<ID>` として見られます。GA4(同意した人だけ)は、配置 `stay_banner` で、クリックと表示を送ります。
- バナーを差し替えるときは、新しい発行コードの URL と画像を `STAY_BANNERS` に入れ替えてください。
