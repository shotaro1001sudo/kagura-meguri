# Local consent management (2026-11-02)

The site serves vanilla-cookieconsent **3.2.1** from `assets/vendor/cookieconsent-3.2.1/`. The unmodified UMD JS, CSS and MIT LICENSE come from the npm package `vanilla-cookieconsent@3.2.1` (package shasum `0f2e8124201d25a1b2604275d4989d8577f4a202`). Their SHA-256 hashes are regression-tested. Build copies them to the same local `/vendor/` path. No CDN, account or paid service is needed for the CMP. Updates require explicitly replacing the pinned assets and reviewing/testing the new release.

Official integration references:
- https://cookieconsent.orestbida.com/advanced/google-consent-mode.html
- https://cookieconsent.orestbida.com/reference/api-reference.html
- https://cookieconsent.orestbida.com/reference/configuration-reference.html

`consent-manager.js` exposes a fail-closed snapshot after the real CMP initializes. The new `kagura_consent_v1` cookie, revision 1, lasts 182 days. Old Cookiebot grants are not imported. Missing JS/configuration/CSS and unreadable, expired or removed consent grant no optional permissions. First consent and changes update the snapshot; focus/history restoration recheck the stored choice.

GA4 always requires an explicit analytics grant, even when the legacy configuration ID is absent. Before permission, only local denied Consent Mode commands are queued; gtag.js is not requested. Revocation disables the measurement ID, queues denied signals, and reloads after the choice is saved. Google ad storage/user-data/personalization signals remain denied, including when marketing images are allowed. AdSense (#173) and GoatCounter (#176) stay paused. Consent Mode support is **not** Google-certified AdSense CMP status; this change does not authorize restoring ads.

ValueCommerce issued tags remain inert templates until explicit marketing permission (stricter than the former confirmed-unselected state). Rejection removes the live nodes; regrant reuses the originals. The original affiliate URLs and Rakuten behavior are unchanged. Ordinary fallback links remain available. Requests already sent cannot be undone.

Cookiebot's runtime script, event handlers and readiness bridge have been replaced. The legacy `cookiebotId` remains solely for the existing CSP configuration, with no runtime permission effect. CSP/access settings are intentionally unchanged. The old Cookiebot browser/transfer diagnostic scripts and fixtures are historical; they do not validate the current CMP. Use the new offline browser suite below instead; do not use legacy live diagnostics as migration QA.

Validation:
- `npm test` includes real vendored-CMP offline DOM tests, asset/license hashes, GA4 consent, original affiliate tags, generated-page and pause regressions.
- `npm run build`
- `node tests/cookieconsent-browser.mjs` exercises generated pages in Chromium at 1280px and 390px: first visit, keyboard rejection and reopening, focus containment, granular analytics/marketing, persistence/navigation, repeated signals, withdrawal/reload, accept all and each CMP asset failing separately. Every external request is intercepted; the Google tag is fulfilled with inert local mock code. No real analytics or ad events are sent. Screenshots are written to `/tmp/cookieconsent-*.png`.

Public production HTML and browser verification must be reported separately if the execution environment cannot reach the site.
