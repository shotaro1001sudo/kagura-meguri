# 収益化(広告・アフィリエイト・アクセス解析)

サイトの仕組みは、できています。各サービスに登録して、得た ID を `config.json` に入れると、その部分だけが有効になります。
ID や承認済み広告が未設定の場合、おすすめ枠のリンクは表示しません。通常検索への代替リンクも出しません。公式公演情報・出典・サイト内ナビは維持します。

| 仕組み | 場所 | 有効にする設定(`config.json`) |
|---|---|---|
| 会場近くの宿(じゃらん) | これからの開催のページ(開催日の1泊・大人2名で検索) / 種類・都道府県・定期公演のページの「旅支度」 | `affiliate.valueCommerceSid` と `affiliate.jalanPid` |
| 公演前後の体験(じゃらん遊び・体験) | 開催・定期公演のページの「周辺体験」のカード / 都道府県のページの「周辺体験」の欄 / 周辺体験のページの47都道府県 | `affiliate.valueCommerceSid` と `affiliate.jalanActivityPid`(宿のpidとは別) |
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
3. 地域・日付を指定する宿泊リンクは、通常テキストではなく正式な **MyLink** 素材から発行します。発行タグ全体と、広告主のリンク先・画像使用条件を照合してください。
4. 確認した sid / MyLink pid を設定します。通常テキストPIDに独自の `vc_url` を付けないでください。

2026-10-25 12:50 UTCの本人管理画面確認: sid `3784232`、宿泊MyLink pid `892732997` / ad `2501119` / 名称 `261025_じゃらんnet_MyLink`。旧pid `892725735` はトップページ向け通常テキストで、地域MyLinkには使用しません。安芸高田市（11/3・1泊・大人2名）と高千穂町（日付なし）の発行原本と照合しています。Shift_JISの `%` を含む行き先文字列を `encodeURIComponent` した正式形式を保持します。宿泊素材はテキスト必須・広告主画像不可です。

体験は既存MyLink pid `892732911` / program `2139176` / ad `2720182` を維持。広島県・宮崎県の発行原本と照合し、既存の47県URL対応を使用します。宿泊・体験とも原本の `gifbanner`（height=1、width=0、border=0）を省略しません。原本の公開タグと出典は `tests/fixtures/valuecommerce-issued.json` に保存しています。報酬の発生を保証するものではありません。

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

開催ページ(2026-10-25から): バナーをやめ、会場の市区町村・開催日の1泊・大人2名の検索へ直接つなぐ文字リンクにしました。じゃらんはバリューコマースのじゃらんnet(pid `892732997`、正式MyLinkの `vc_url`)、楽天トラベルは楽天アフィリエイト(`hb.afl.rakuten.co.jp/hgc/<アフィリエイトID>/`)を経由します。どちらも転送後に同じ検索結果が開くことを確認済み。クリックは `stay-jalan/<開催ID>`・`stay-rakuten/<開催ID>`。

県・種類・今週末・今月の宿の帯に、画像バナーを出します。定期公演ページは地域指定のテキストリンクです。楽天は `scripts/lib/stay-banners.mjs` の既存発行ペアを維持します。

- じゃらんバナーは既存pid `892732859` の**公式非JS原本**を使用します。独自の `va`、直接JPEG、JS出力の手動再構築は使用しません。
- 原本内部はhref・画像URL・寸法・borderを保持し、許容されるrel/target/altのみ補います。広告の配置・GA4/GoatCounter情報は外側要素に置きます。GoatCounter titleは固定の既存クリック名とし、原本HTMLを送らないようにします。
- B案（ローカル検証中・未公開）: 全VC枠は不活性なtemplate内に保持。CookiebotのConsentReady/OnLoad/Accept/Decline通知後にAPI状態を読み、未選択（hasResponse=false / marketing=false / method=null）または許可（hasResponse=true / marketing=true / method=explicit）だけ原本を挿入します。保存済みmarketing=falseの拒否は旧形式も含め停止。API未準備・読取例外・不整合・判定不能な旧許可はunknownとして非表示。Cookiebotの分類・auto設定は変更しません。
- 同一文書で各枠の原本を生成するのは1回まで。拒否時はDOMから外し、再許可時は同じ要素を再利用してsrcの再設定を避けます。離脱時は状態を不明に戻して広告を外し、履歴復帰時はCMPから新たな状態通知があるまで停止します。各原本に付随する画像は省略せず、複数枠の同一URLが実通信で統合されるかはブラウザ/キャッシュに依存します。
- これは採用した実装方針であり、全地域・全利用者に同意ゲートが法的に必須と判定したものではありません。通常外部リンクと異なり、画像srcは表示時の外部通信を伴います。
- 現行本番の既存CSP `img-src https:` を使用し、許可を広げません。AdSense無効（厳格CSP）またはCookiebot未設定時はVC枠を生成しません。新たにホストを許可する変更は別判断です。
- 広告の注記(`.vc-disclosure`)は、ページの先頭ではなく、**最初の広告の枠(宿・本・体験など)のすぐ上**に1回だけ置く(2026-10-27 運営者の指定。先頭だと本文より前に毎回大きく出て、雰囲気を壊すため)。`build.mjs` の `withAdDisclosure()` が、広告の原本を作り直さず元の文字列の位置に差し込む。ページ末尾(`collectNotes()`)へは移さない(広告より後ろでは、広告と気づく前に見てしまうため)。GA4は引き続き統計同意・自己除外ゲートが独立して必要で、イベント名・公開ID・項目は維持します。

参照: https://help.valuecommerce.ne.jp/aff/ad/adlink/09/ 、https://help.valuecommerce.ne.jp/aff/ad/adlink/13/ 、https://www.valuecommerce.ne.jp/stepup/guide/tool/mylink/

## 本・グッズ(神楽の種類・歴史のページ)と、ふるさと納税(県のページ)

`data/more-offers.json` に、本人が楽天アフィリエイトで発行したリンクを登録すると表示されます。

**2026-10-30 運営者の判断で停止中:** 本・DVD(`more-offers.json` の `categories.learn.enabled: false`)と、観覧用品(`visitor-planning.json` の `categories.supplies.enabled: false`)は表示していません。来訪者の目的(公演を調べる)とずれ、購入が見込みにくいため。商品データは残してあるので、`enabled` を `true` に戻せば再開できます。ふるさと納税・宿・レンタカー・体験は続けています。

| カテゴリ | 表示する場所 | provider |
|---|---|---|
| `learn`(本・映像・グッズ) | 神楽の種類のページ(`kagura` に種類名)、神楽の歴史のトップ(`kagura: "*"` の全般向け) | `rakuten-books` / `rakuten-ichiba` |
| `furusato`(ふるさと納税) | 県のページ(`prefecture` と `city` が必要) | `rakuten-furusato` |

各項目に必要なもの: `id`・`category`・`provider`・`enabled:true`・`approved:true`・`verifiedAt`・`expiresAt`(確認から90日以内)・`approvalReference`・`url`(楽天の発行リンクをそのまま。`hb.afl.rakuten.co.jp/hgc/…` または `/ichiba/…` で `pc=` つき)・`title`・`note`(選ぶときの一言)。
リンク先は、本は楽天ブックス、グッズは楽天市場の商品・検索、ふるさと納税は楽天市場の自治体の商品・楽天ふるさと納税のページに限ります。各ページ最大3件。クリックは GoatCounter で `more-learn/<id>`・`more-furusato/<id>`、GA4 は配置 `kagura_learn`・`history_learn`・`pref_furusato` で数えます。

## 今週末・今月の宿

今週末・今月のページで、開催の一覧の後に、宿のバナー(楽天トラベル・じゃらんnet)を出します。開催がない週は出しません。クリックは `banner-*/weekend`・`banner-*/this-month` で数えます。

登録済み(2026-10-25、本人ログインの楽天アフィリエイト「商品リンク作成」で発行、再確認期限 2026-11-24): 本・映像3件(山陰の神楽写真集=石見・出雲・隠岐・伯耆、石見神楽DVD、広島神楽DVD)、ふるさと納税4件(美郷町・浜田市・北広島町・高千穂町)。商品画像は発行コードの画像URL(`hbb.afl.rakuten.co.jp/hgb/…`)をそのまま使い、画像のあるページだけ CSP で `thumbnail.image.rakuten.co.jp`(画像の転送先)を許可します。価格・ポイントの文字は転載しません。

## 自動公演の本・返礼品（2026-10-25）

自動取得・承認で events.json に掲載された公演にも、手動公演と同じ build の matcher を適用します。公演ごとの広告API呼出しや追跡URL生成はしません。地域・種類別の索引を1回作り、各枠最大3件。NFKC/空白を正規化し、都道府県は47件の一覧で確認、郡付き町村は曖昧でない省略名のみ一致させます。未知・不一致は非表示。全国の市町村マスターによる住所認証ではなく、確認済み商品データに対する照合です。

おすすめ枠には未収益化の通常検索fallbackを出しません。本・市町村の検索/一覧も、所有者が正式ツールで発行したURLをそのまま登録し、対象種類または都道府県+市町村、承認証跡、確認日・期限が揃った場合のみ広告として使います。自動ラッピングや楽天WebService APIは追加しません。公式公演情報・出典・施設公式案内・サイト内ナビは維持します。

共通の offerEligibility は未承認、revoked、期限切れ、90日超、URLなしを除外。撤回時は approved:false / revoked:true を登録してください。期限監査には visitor-planning と more-offers の両データを含め、未一致は learn_unmatched / furusato_unmatched で集約。週次レポートとsummaryの公演明細は50件までで、件数は全件です。掲載がない場合は広告の登録/再承認を行い、地域を拡大して代替しないでください。

旧実装のVC静的化/1px省略は、本節より上の正式原本・同意制御の修正対象です。[公式FAQ](https://help.valuecommerce.ne.jp/aff/ad/adlink/09/)と発行原本の照合が必要で、この変更はVCコードを再構築・拡張しません。全広告の成果保証や承認完了を意味しません。楽天ふるさと納税4件は所有者側の2026-10-25 12:12 UTC監査でhref/image一致と当時3%を確認（率の継続は保証しない）。一般楽天IDの直接照合は新規規約同意待ちで今回行いません。

### B案の検証境界（未公開）

`node tests/valuecommerce-browser.mjs` はローカルChromiumで全ての非localhost要求をCDPで捕捉・失敗させ、DNSもlocalhost以外を無効化します。正式タグの要求先と、状態別のDOM・要求件数を検査します。Cookiebotは状態スタブであり、実Cookiebotのauto分類や実VCサーバーのCookie・転送・取得情報は確認しません。実分類が表示を遮断してもignore属性/necessary化/auto無効化で回避せず、公開前に報告して止めます。

privacyの送信先表・本文は、画像表示時の通信（タグにサイトID/広告IDを含む）と、クリック先での紹介元記録を区別します。VCの一般方針は広告表示/クリック履歴やCookie等の利用を説明しますが、gifbannerで全項目・IP・完全URL・Cookieが必ず送られると実証したものではありません。法的適法性や報酬は保証しません。
