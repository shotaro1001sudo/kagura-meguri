# Experience directory empty state

Base: d39a51cc912d562e13ff937489a36640104df201 (PR138).
The route and navigation exist. The user screenshot, inspected by the parent,
shows seven region headings but no prefecture cards. The user's actual CMP state
is unknown: do not infer rejection from that image.

All 47 names were inside inert advertising templates. The existing controller
hides the complete slots for unknown or denied states, so the page lost even its
geographic labels. Parent's Windows test with real CMP at this base saw 0 links
before readiness and 47 after approximately 1041ms in confirmed unselected state;
all advertising/analytics/consent-log traffic was intercepted. Thus the evidence
supports a missing empty-state presentation, not a universally broken URL.

This patch adds non-link prefecture labels adjacent to the unchanged issued tags.
CSS hides each label only while its corresponding ad slot is visible. No JS or
CMP readiness is needed for the labels, and no extra external resource is loaded.
One small page-level explanation links to existing Cookie settings. No ordinary
merchant search URL, fabricated affiliate URL, forced consent, or policy change.
No changes to controller, issued tags, account configuration, or Claude's layout.
A third-party blocker that independently hides arbitrary page elements cannot be
fully diagnosed or defeated by this patch.

Validation: full npm test (10667 passed), build (146 pages), mock CMP unknown,
unselected, allowed, repeated callbacks and denial/revocation. With controller
absent labels remain and there are no active images. Actual local Chromium with
pre-send external interception rendered generated experiences.html at 1280 and
390px: 47 labels, 0 active ad anchors, no horizontal overflow; screenshots visually
inspected. Native vendor consent persistence was not retested and no live consent
logs or advertising clicks were sent. Parent screenshot pixels were unavailable
through Library read on this executor; its observed content is parent evidence.

Keep draft pending parent concurrency/design review before merge.
