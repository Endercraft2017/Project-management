# Independent review: /tour

Reviewed 2026-10-28. Reviewer did not edit product code. Tested the real public frontend at local port 5176; no authenticated sessions or customer data used. Source review covered ProductTour.tsx/.css, lazy route/error fallback in main.tsx, and the sign-in discovery link.

## Retained evidence and portability

The `reviewer-tour-*.json` names below identify the original machine-local review artifacts; those raw matrices and all twelve captures are not bundled in this repository. Retained portable evidence includes [the final-stop check](../evidence/tour-finalstop.json), [desktop](../evidence/tour-desktop.png), [mobile dark](../evidence/tour-mobile-dark.png), and [four retained browser regression results](../evidence/tour-playwright.txt). The checked-in browser suite is the repeatable behavior evidence; original local review observations remain reviewer-reported where their raw artifacts were not retained.

## Disposition

No remaining blocking defect found in the reviewed public-tour behavior after the author corrected the final-slide playback bug. This is approval of the scoped public presentation/interaction work, **not** a finding that the broader SaaS/backend or all accessibility requirements are complete.

## Confirmed correction

Initial independent check found final slide index 3 left `autoplay.running=true`, “Pause tour” and live region off. Swiper14's stopOnLastSlide did not itself provide the desired application stop state. Reported directly to author and lead. Author added explicit last-slide stop in onSlideChange. Retested with the **real configured 6500ms delay**: index3/running=false/“Play tour”/live=polite. Explicit replay reset to index0/running=true/live=off. Evidence: reviewer-tour-finalstop.json.

## Browser checks that passed

- Viewport/theme matrix: 360, 768, 1440 × light/dark. No viewport horizontal overflow or page errors. Next advanced exactly one card, previous returned one card. Six full-page captures and structured data in reviewer-tour-initial.json.
- Reduced motion matrix: same widths and both themes. Effect slide, speed0, no rotation, disabled automatic-play control, no overflow, inactive slides inert/aria-hidden. Six captures and reviewer-tour-reduced.json. Runtime change to reduced motion preserved active index in separate behavior check.
- Actual keyboard: Enter activated Next, ArrowRight navigated within tour, Space activated picker. Tab traversal reached controls and exited the region with no focus inside inert slides. Evidence reviewer-tour-keyboard.json. This is browser automation of keyboard input, not a manual screen-reader test.
- Playback manual by default; explicit Play starts, focus entering carousel stops until explicit replay, hover entry stops, live region changes off/polite with playback state. Inactive aria-hidden/inert follows the active slide. Evidence reviewer-tour-behavior.json (initial run also contains the now-corrected final-stop failure; finalstop.json supersedes that entry).
- Visibility listener: simulated document.hidden + visibilitychange stopped the engine and changed controls/live region after React state flush. This is **simulated event coverage**, not proof of actual OS/browser-background-tab throttling. Source also removes listeners/observer on cleanup.
- Root sign-in remains `/api/auth/google`; discovery link is `/tour`. Return links go to `/`; no auth flow rewritten. Root link checks recorded in reviewer-tour-behavior.json.
- Computed meaningful body/caption/control/footer text now14px, preview disclaimer12px; decorative miniatures remain small and aria-hidden. Root typography changes are outside this reviewer ownership and were not edited.

## Visual inspection

Personally viewed screenshots: 360 light/dark, 768 light, 1440 dark. Layout and surface language are coherent, primary return action remains independent of slides, mobile shows one readable full card, desktop shows deliberate faded neighboring previews. Sample/illustrative disclaimer is visible; footer disclaims non-live workspace/configuration/staged rollout. No fabricated customer counts or production-security claims identified. Miniature representations are decorative and are not a demonstration that the planned SaaS workflows are implemented.

## Nonblocking refinement

Current Tab sequence encounters four slide picker buttons before Play. The reviewed WAI-ARIA APG/research guidance recommends placing the rotation control first inside the carousel's tab sequence. Manual-first playback plus focus-entry stopping prevents an observed unsafe rotation case; no high/critical issue is claimed. Prefer natural DOM/CSS reordering if adjusted; avoid positive tabindex hacks. Reported to author.

## Remaining limits

No axe scan, manual assistive-technology session, contrast measurement, OS-level background-tab test, 200% zoom matrix or paid/production/authenticated workflow validation performed by this independent reviewer. Author owns build/test execution and retained regression tests. The review did not execute external scripts or change dependencies, source, tests or docs under the repository.
