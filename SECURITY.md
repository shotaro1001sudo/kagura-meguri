# セキュリティ対策(神楽めぐり)

このサイトは、サーバーの処理を持たない静的サイトです。そのため、データベースの不正操作やサーバーへの侵入といった、よくある攻撃の面はほとんどありません。
その代わりに、次の4点を守ります。**画面に悪意のあるコードが混ざらないこと / 通信が暗号化されていること / 投稿フォームが悪用されないこと / 運営者のアカウントが乗っ取られないこと。**

## すでに入れてある対策

| 対策 | 内容 | 確認するテスト |
|---|---|---|
| **HTTPS** | 常時HTTPS(HTTPは自動で転送) | 公開後に `curl -I` で確認 |
| **CSP(コンテンツの許可リスト)** | 各ページの `<meta>` で、読み込める出どころを限定。インラインのスクリプト・スタイルは、中身の**ハッシュ**でだけ許可し、`unsafe-inline` / `unsafe-eval` を使わない。外部への通信・画像・埋め込みは、地図・Webフォント・フォーム送信先だけ許可 | `tests/extra.mjs`「セキュリティ」 |
| **XSS対策** | 表示するデータは、すべてエスケープして出力。構造化データの `</script>` も無害化。URLは `http(s)://` だけ許可し、`javascript:` などは**ビルドを止めて拒否** | 悪意のある文字列を含むテストデータ |
| **外部ライブラリの改ざん検知** | 地図(Leaflet)は、バージョンを固定し、SRI(ハッシュ検証)を付与 | `tests/run.mjs` |
| **クリックジャッキング対策** | 他サイトの `<iframe>` に埋め込まれると、ページを隠して最上位へ移動 | `tests/extra.mjs` |
| **リンクの安全** | 外部リンクは `rel="noopener"`、広告は `rel="sponsored"`。リファラは必要最小限(`strict-origin-when-cross-origin`) | `tests/run.mjs` |
| **メールアドレスの隠蔽** | 運営者のメールアドレスをHTMLに書かない。表示時にだけ、スクリプトが組み立てる(収集ボット対策) | `tests/extra.mjs` |
| **フォームの悪用対策** | ハニーポット(ボットだけが埋める隠し欄)、送信までの時間チェック、30秒の連続送信制限、文字数の上限、入力検査、同意の確認。送信にCookie・リファラを付けない | jsdomと実ブラウザで操作して確認 |
| **データの検査** | 不正なデータ(id重複、日付の形式、範囲外の座標、危険なURL)があると、**公開前にビルドが止まる** | `tests/fixtures/*.invalid.json` |
| **公開前のテスト** | GitHub Actions が、テストに失敗すると公開しない | `.github/workflows/deploy.yml` |
| **依存パッケージの更新** | Dependabot が、毎週、更新の提案を出す(提案もテストを通る) | `.github/dependabot.yml` |
| **セキュリティ連絡先** | `/.well-known/security.txt`(RFC 9116) | `tests/extra.mjs` |

## 限界(GitHub Pages のため)

GitHub Pages は、**任意のHTTPヘッダーを付けられません**。公開サイトを確認したところ、次のヘッダーは付いていません。
`Strict-Transport-Security`(HSTS) / `X-Frame-Options` / `X-Content-Type-Options` / `Permissions-Policy` / `Content-Security-Policy`(ヘッダー版)

- CSPと埋め込み防止は、`<meta>` とスクリプトで補っています。ただし、`<meta>` のCSPでは `frame-ancestors` が使えず、HSTSの代わりにもなりません。
- **より強くしたい場合は、Cloudflare(無料)をドメインの前に置く**のが、最も効果があります。
  1. Cloudflareに `kagurameguri.jp` を登録し、お名前.comのネームサーバーを、Cloudflareのものに変更する(DNSレコードは、Cloudflareに移す)。
  2. SSL/TLSを「Full (strict)」にし、「Always Use HTTPS」と HSTS を有効にする。
  3. 「Transform Rules → Modify Response Header」で、[`dist/_headers`](scripts/build.mjs) と同じヘッダー(`X-Content-Type-Options`、`X-Frame-Options`、`Referrer-Policy`、`Permissions-Policy`)を付ける。
  4. ボット対策として、フォームに Cloudflare Turnstile を足すこともできる。
  これは、運営者の判断で行う設定変更です。必要なら、手順を一緒に進めます。
- 別の方法として、**Cloudflare Pages** や **Netlify** に引っ越すと、`_headers` ファイルがそのまま効きます(ビルドは、すでに出力しています)。

## あなたの作業(運営者のアカウントを守る)

サイトのコードよりも、**アカウントの乗っ取り**のほうが、現実的なリスクです。

- [ ] **GitHub**: 二要素認証(2FA)を有効にする(Settings → Password and authentication)。パスキーが最も安全。
- [ ] **お名前.com**: 二段階認証を有効にする。ドメインの**ロック(移管ロック)**を確認する。**WHOIS情報公開代行**が有効であることを確認する。
- [ ] **ドメインの自動更新**をオンにし、支払い用のカードの期限を確認する(ドメインが切れると、他人に取られる恐れがある)。
- [ ] **メール**(運営に使うGmail): 二段階認証を有効にする。ここが破られると、GitHubもお名前.comも、パスワードの再設定で奪われる。
- [ ] **フォームの送信先**(Web3Forms / Formspree)のアカウントにも、強いパスワードを設定する。
- [ ] **リポジトリの保護**: Settings → Rules(または Branches)で、`main` への**強制プッシュと削除を禁止**する。
- [ ] **シークレットを置かない**: パスワード・APIキー・秘密のトークンは、リポジトリに入れない(`.env` は、`.gitignore` で除外済み。AdSenseのIDやフォームのアクセスキーは、公開されても問題ない種類のもの)。
- [ ] DNSSEC は、お名前.com では有料のため、必要になってから検討する。

## フォームの送信先を設定する(未設定の間は、メールの作成画面が開く)

投稿フォームは、`config.json` の `form` が空の間、**入力内容を入れたメールの作成画面を開く**方式で動きます。受け取ることはできますが、投稿者が、メールアプリを持っていないと使えません。外部のフォーム送信サービスを設定すると、サイト上で送信が完結します。

**Web3Forms(無料)の場合**
1. https://web3forms.com で、受け取りたいメールアドレスを入れて、アクセスキーを受け取る(メールで届く)。
2. `config.json` を、次のように編集する。
   ```json
   "form": {
     "endpoint": "https://api.web3forms.com/submit",
     "accessKey": "メールで届いたキー",
     "providerName": "Web3Forms"
   }
   ```
3. `npm test` が通ることを確認して、`git push` する。
4. サイトのフォームから、実際に1通、試し送信して届くことを確認する。

アクセスキーは、サイトのHTMLに載る前提のもの(公開されても、送信先のメールアドレスは見えない)です。**Formspree** を使う場合は、`endpoint` に、`https://formspree.io/f/XXXXXXXX` を入れます(`accessKey` は不要)。
設定すると、CSPの `connect-src` に、その送信先だけが自動で加わります。プライバシーポリシーにも、`providerName` が表示されます。

## AdSense を設定するときの注意

広告(AdSense)は、動的にスクリプトやiframeを読み込むため、`config.json` の `adsense.client` を設定すると、CSPが自動で**緩くなります**(`script-src` に `unsafe-inline` / `unsafe-eval` と、Googleのドメインを追加)。これは、広告を出す場合の標準的な妥協です。広告を入れない間は、厳しい設定のままです。

## 問題を見つけたら

`/.well-known/security.txt` に、連絡先を載せています。脆弱性の報告は、[お問い合わせ](https://kagurameguri.jp/contact.html)から受け付けます。
