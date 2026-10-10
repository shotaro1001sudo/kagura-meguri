# 収益化(広告・アフィリエイト・アクセス解析)

サイトの仕組みは、できています。各サービスに登録して、得た ID を `config.json` に入れると、その部分だけが有効になります。
ID が空の間は、報酬のない、ふつうのリンクとして動きます(「PR」の表示も出ません)。

| 仕組み | 場所 | 有効にする設定(`config.json`) |
|---|---|---|
| 会場近くの宿(じゃらん) | これからの開催のページ(開催日の1泊・大人2名で検索) / 種類・都道府県・定期公演のページの「旅支度」 | `affiliate.valueCommerceSid` と `affiliate.jalanPid` |
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
2. 「広告主を探す」で「じゃらんnet」を探し、**提携を申請**します(審査があります)。
3. 承認されたら、じゃらんnet の広告の「プログラムID(**pid**、数字)」を控えます。
4. `affiliate.valueCommerceSid` に sid、`affiliate.jalanPid` に pid を入れます。

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
