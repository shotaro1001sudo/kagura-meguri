# Native Cookiebot settings entry

Base: PR128 merge c474c98dcbaa8936cbda8e1fe6dd10557a774313.
The user changed the Cookiebot account configuration themselves; this PR does not.

## Prerequisite evidence supplied by parent/Windows

- Public popup screenshot shows 全て許可, カスタム化, 拒否, もっと見る.
  Checkpoint SHA-256: 9508efdcdd4a161942713fa11773ad09e8b3002de78e672cff87f9cee943b8fc.
- Hit-tested Customize opens native category controls: necessary ON/disabled,
  preferences/statistics/marketing OFF/selectable. 拒否, 選択中のCookieを許可,
  全て許可 remain available. No choice was toggled or saved.
- One actual Cookiebot.renew() while open returned to the native consent screen;
  hasResponse=false, method=null, marketing=false throughout; no consent logs.
  Checkpoint SHA-256: 3fb6eb2b859a02069a4488a9588127090de8731b33207f6d5fec64bd534b816c.
- Six interception guards passed; only public CMP GETs continued. Ad/GA/log
  requests were blocked. These hashes are reported by Windows, not recomputed here.
- Closed/post-consent actual reopening is NOT established by that run. Local mock
  tests cover it. No claim of native-button real consent submission is made.

## Change

Remove the large added header section and its direct necessary-only submission.
Keep one understated, native button labelled Cookie設定 below the footer. It calls
only the documented Cookiebot.renew() on activation. Native popup owns reject,
category selection and acceptance. Opening settings never submits consent.
The privacy page links to this entry. No vendor DOM is injected or styled, no
account/CSP/GA4/affiliate policy changes, and no dependency or paid service added.
Repeated actions are suppressed while opening and for one second, then reopening
remains possible. Display-event or visible native popup confirms opening; absent,
throwing or unresponsive SDK reports failure honestly. No consent success is shown.

Official API: https://www.cookiebot.com/en/developer/
Native configuration: https://support.cookiebot.com/hc/en-us/articles/26407083994524-Configuration-of-the-Swift-banner-in-the-Cookiebot-Manager

## Verification

Actual current generated homepage rendered locally before/after with all external
requests intercepted. At 390px the old header block displaced the search/hero;
the new first screen shows the original navigation/search/artwork. Desktop and
390/320px screens were visually inspected. Local Chrome checks native Tab,
Enter/Space, 44px target, focus outline, no horizontal overflow, no duplicate
entries, unavailable SDK, repeat suppression and reopening with mock CMP.
The mock bottom-left popup may cover the footer entry while open; its native
choices remain reachable. Once closed, the unobstructed entry reopens it. This is
not the old situation where refusal existed only behind the popup.

Use `npm test`, `npm run build`, and `node tests/cookie-controls-browser.mjs`.
The browser check defaults to generated dist and blocks external requests. Optional
COOKIE_QA_BASELINE=1 and COOKIE_QA_SITE_DIR point to a prior generated checkout for
visual comparison. Screenshots are written to the OS temp directory, not committed.

## Final Windows read-only handoff

Use the exact PR head and refreshed 31-file manifest. The generated Oasa fixture
contains the new footer entry. CLEAR all VC SDK/UI/withdrawal/button invocation
flags and VC_ALLOW_CONSENT_LOG. Only set VC_REAL_CMP=1 and VC_FIXTURE=generated
for the existing guard probe. Old VC_BUTTON_INVOCATION_CHECK tests the removed
custom refusal control and MUST NOT be used for this change.

Capture the native reject/customize controls, absence of the old header box and
the footer entry. If the entry is visible and hit-tested, activate Cookie設定 to
observe native popup opening; do not choose categories or save. If the already-open
popup covers the footer entry, record that and inspect native choices instead;
do not hide/mutate the popup to fabricate an actual closed-state pass. Mock tests
supply that bounded evidence. No additional live consent log is authorized: the
previous four-request budget remains exhausted.
