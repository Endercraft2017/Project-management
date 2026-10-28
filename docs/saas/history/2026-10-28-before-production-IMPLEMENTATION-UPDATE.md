> Historical snapshot before the standalone production implementation. Superseded by [ADR-001](../ADR-001-PRODUCTION-TENANCY.md) and the [current rollout checklist](../ROLLOUT-CHECKLIST.md). This is retained evidence, not current setup guidance.

# First implementation slice — 2026-10-28

Owner choices are recorded in DECISIONS.md and override historical proposals. No data reset, purchase, provider account change, production deployment or main-branch merge occurred.

## Security

Commit `96dc1634de346c92ec95ff5388ccfca60c2cf4cf` fixes user-route ownership checks to authorize the handler's actual `:id`, and removes presentation-mode task access. Twenty focused regression tests pass; ten failed before the repair. The lead and a separate reviewer checked the diff and tests. Tests exercise actual middleware/controllers/schema with service mocks, not full Passport/HTTP/database integration. Evidence: evidence/phase0-auth-red.txt and evidence/phase0-auth-green.txt.

Nested task permissions, global broadcasts, socket revocation, optional-provider boot and CI remain open. These two repairs do not establish complete authorization or Phase 0 completion.

## Public product tour

`/tour` is an isolated, lazy-loaded product-preview page, linked from sign-in. It preserves the existing palette and app entry; final branding awaits the owner. Swiper supplies Coverflow, navigation, pagination, autoplay and A11y modules. Manual navigation is default, with explicit playback, durable focus/hover/visibility pause, reduced-motion handling, inactive-slide isolation, keyboard navigation and a readable chunk-failure fallback. Illustrations use sample data and are not live customer screens.

The retained browser suite is client/e2e/product-tour.pw.ts; its configuration launches the local Vite server. Run `npm run test:tour --workspace=client`. Install the pinned Playwright browser first, or set PLAYWRIGHT_CHROMIUM_EXECUTABLE to an installed compatible Chromium. The audit machine uses /usr/bin/chromium. No backend credentials are needed for these public-page tests.

Reviewed guidance/provenance for Genjutsu, Taste, Hallmark, Brag and Swiper is under design-research/. Palette/marketing/harness defaults that conflict with the owner's app were explicitly overridden. No video pipeline, hosted design account or full automatic skill scoring was run.

Independent visual/behavioral review covered 360/768/1440px, light/dark and reduced motion, controls, focus and preserved sign-in navigation. A final-slide autoplay-state bug found in review was corrected and retested. Hidden-tab handling was simulated through a visibility event; manual screen-reader, full contrast/axe and authenticated SaaS validation remain unverified. Build/test evidence is recorded with the final verification results in WORK-STATE.md.
