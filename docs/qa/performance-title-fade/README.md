# Performance title fade: rendered QA

Base: `56b6f4f` (includes PR #114 / `b2f276c`). Chromium 154.0.8037.57, Linux, 1280×900 / 390×900 / 320×900, device scale 1.

## Cause and scope

Both `/events/*.html` (upcoming, past, Hiroshima preparation variant) and `/regular/*.html` use the same `hero()` h1. The inconsistency was in `vt.js`: card entry extracted the card heading and destination h1 into an `ev-title` View Transition. That snapshot interpolated position/size and cross-faded with browser-default title keyframes, outside the existing root fade. A plain link could produce only a destination title snapshot; direct navigation used `pagein`. Long wrapped titles could move over the tags during the transition.

The title now stays in the normal page snapshot: 900ms, zero delay, `cubic-bezier(.22,.61,.36,1)`, opacity 0→1, translate 8px→0. The existing header transition and 350ms outgoing page fade remain. The `.vt` guard prevents simultaneous pagein and navigation fades, and remains on restored documents to avoid restarting pagein. No templates, typography, spacing, analytics, or reservation logic changed.

## Before / after evidence

These are real, unmodified browser screenshots, taken about 220ms after link navigation. Capture timing is approximate, not a frame-perfect animation comparison. Both revisions served the same generated data locally; all external requests were blocked to avoid analytics/ad traffic. They use identical installed Japanese fallback fonts rather than downloaded production webfonts.

| Variant | Before | After |
|---|---|---|
| Event, desktop 1280 | [before](before-event-1280-during.png) | [after](after-event-1280-during.png) |
| Event, mobile 390 | [before](before-event-390-during.png) | [after](after-event-390-during.png) |
| Event, narrow 320 | [before](before-event-320-during.png) | [after](after-event-320-during.png) |
| Regular performance, 390 | [before](before-regular-390-during.png) | [after](after-regular-390-during.png) |
| Long Japanese title, 320 | — | [settled title](after-long-320.png) |

The event is 庄内神楽祭り(由布市庄内町ふるさと祭り), reached from its November month-list card. The regular performance is 高千穂神楽(高千穂神社 神楽殿), also reached from that list. The long-title case is 相模里神楽 垣澤社中 プラネタリウム公演「星降る神楽～道開き之章～」.

## Validation

- `npm test`: **10,204 passed, 0 failed**. Motion regression checks include direct/unsupported navigation, transition suppression, repeat reveal/back restoration, and both detail URL families (with and without `.html`). Existing reduced-motion, no-IntersectionObserver, print, and JS-free CSS checks pass.
- `npm run build`: **73 events, 6 regular performances, 142 reported pages**. All 146 emitted HTML files have identical markup after removing scripts, styles, and the generated CSP hash meta.
- Playwright with installed system Chromium: **37 rendered scenarios**; details in [results.json](results.json). Six before cases and 31 after cases.
- Both detail families: card entry, back/forward, 1280/390/320. Long Japanese title: direct entry and ordinary text-link entry at all three widths. Ordinary link was inserted into the local calendar page to isolate non-card behavior.
- Upcoming Hiroshima and past event pages: direct entry at all three widths.
- Reduced motion, JavaScript disabled, and IntersectionObserver unavailable: event and regular detail at 320. Additional simulated failure of the `pagereveal` handler after head JS runs: content still settles visibly.
- All after cases settle at opacity 1, no title transition name, no horizontal page overflow, no running animation. All instrumented navigation cases report CLS 0. Back/forward was exercised in Chromium; persisted-document guard behavior is also covered by the unit test.
- The six settled event/regular screenshot pairs (both variants × all three widths) are **pixel-identical** before/after. No final-layout change.
- `git diff --check`: clean.

Reproduce with separate base/fix builds served by `node scripts/serve.mjs <dist> <port>`, open `/month/2026-11.html`, click the event/regular cards, inspect their h1 and `document.getAnimations()` during transition, then navigate back/forward. After the fix the browser records only the existing root/header transitions; `ev-title` is absent. Test direct URLs and ordinary links as well. Wait >900ms before checking final visibility/layout; emulate reduced motion and disable JS separately.

Limitations: Chromium only; Firefox/Safari and downloaded production webfonts were not visually tested. No production deployment was performed.
