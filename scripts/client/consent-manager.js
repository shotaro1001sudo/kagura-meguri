// Self-hosted CookieConsent. A new cookie name deliberately does not inherit Cookiebot grants.
(() => {
  if (window.kaguraConsent) return;
  const denied = () => ({ ready: false, statistics: false, marketing: false });
  let ready = false, initialized = false;
  const cmp = window.CookieConsent;
  window.kaguraConsent = {
    snapshot() {
      try {
        if (!ready || !cmp || cmp !== window.CookieConsent || !cmp.validConsent()) return denied();
        // Re-read the persisted choice as well: another tab may have revoked consent.
        const saved = cmp.getCookie();
        if (saved.revision !== 1 || !Array.isArray(saved.categories)) return denied();
        return { ready: true,
          statistics: cmp.acceptedCategory('analytics') === true && saved.categories.includes('analytics'),
          marketing: cmp.acceptedCategory('marketing') === true && saved.categories.includes('marketing') };
      } catch (_) { return denied(); }
    },
    open() { if (!ready || !cmp) throw Error('Consent settings unavailable'); cmp.showPreferences(); }
  };
  const sync = () => window.dispatchEvent(new Event('kagura:consent'));
  if (!cmp || !document.querySelector('link[href="/vendor/cookieconsent-3.2.1/cookieconsent.css"]')?.sheet?.cssRules?.length) return;
  try {
    cmp.run({
      mode: 'opt-in', revision: 1, hideFromBots: false, manageScriptTags: false,
      cookie: { name: 'kagura_consent_v1', expiresAfterDays: 182, sameSite: 'Lax' },
      guiOptions: {
        consentModal: { layout: 'box inline', position: 'bottom right', equalWeightButtons: true },
        preferencesModal: { layout: 'box', equalWeightButtons: true }
      },
      onConsent: () => { initialized = ready = true; sync(); },
      onChange: () => { initialized = ready = true; sync(); },
      onModalShow: () => window.dispatchEvent(new Event('kagura:consent-dialog')),
      categories: {
        necessary: { enabled: true, readOnly: true },
        analytics: { autoClear: { cookies: [{ name: /^_ga/ }, { name: '_gid' }] } },
        marketing: {}
      },
      language: { default: 'ja', translations: { ja: {
        consentModal: {
          title: 'Cookieの設定',
          description: 'アクセス解析と一部の広告画像は、許可した場合だけ読み込みます。選択はいつでもページ末尾の「Cookie設定」から変更できます。',
          acceptAllBtn: 'すべて許可', acceptNecessaryBtn: '任意Cookieを拒否', showPreferencesBtn: '項目ごとに設定',
          footer: '<a href="/privacy.html">プライバシーポリシー</a>'
        },
        preferencesModal: {
          title: 'Cookieの設定', acceptAllBtn: 'すべて許可', acceptNecessaryBtn: '任意Cookieを拒否',
          savePreferencesBtn: '選択を保存', closeIconLabel: '設定を閉じる', serviceCounterLabel: 'サービス',
          sections: [
            { title: '必要な保存', description: 'この設定を端末のCookieに182日間保存します。同意管理のための外部サービスへの送信はありません。', linkedCategory: 'necessary' },
            { title: 'アクセス解析', description: 'Googleアナリティクス（GA4）による閲覧・操作の集計を許可します。許可前は読み込みません。GoatCounterは停止中です。', linkedCategory: 'analytics' },
            { title: '広告画像', description: 'バリューコマースの広告・計測画像の読み込みを許可します。Google AdSenseは停止中です。楽天の既存のリンク・画像と、リンク先での情報の扱いはプライバシーポリシーをご確認ください。', linkedCategory: 'marketing' },
            { title: '設定の変更・取り消し', description: '「任意Cookieを拒否」で取り消せます。解析を開始済みの場合は、停止のためページを再読み込みします。すでに送信された情報は取り消せません。<a href="/privacy.html">プライバシーポリシー</a>' }
          ]
        }
      } } }
    }).then(() => { initialized = ready = true; sync(); }).catch(() => { ready = false; sync(); });
  } catch (_) { ready = false; sync(); }
  window.addEventListener('pagehide', () => { ready = false; });
  window.addEventListener('pageshow', () => { ready = initialized; sync(); });
  window.addEventListener('focus', sync);
})();
