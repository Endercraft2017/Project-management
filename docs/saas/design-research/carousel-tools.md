# Public product-tour carousel: reviewed tools and integration recommendation

Reviewed 2026-10-28 over public HTTPS with normal TLS verification. This is design/research guidance, not a product implementation or proof that SaaS workflows already work. No third-party installer, plugin, script, render service, or downloaded JavaScript was executed. Source packages were inspected as text only. No video was made.

## Provenance and trust boundary

- **Brag**: https://github.com/latent-spaces/brag pinned to `669ab9286aa28b6c3ee30e75f181ee74319d012a` (HEAD observed during review). Read README, LICENSE, `skills/brag/SKILL.md`, and inspection/planning/composition/delivery references. [Pinned skill](https://github.com/latent-spaces/brag/blob/669ab9286aa28b6c3ee30e75f181ee74319d012a/skills/brag/SKILL.md). MIT license. The skill describes making launch videos with Hyperframes; it is **not a carousel library**. Its model-specific dispatch, video tooling and installation instructions are third-party content and were not adopted as instructions for this task.
- **Swiper**: repository HEAD observed `92342323cc69dc9f6d4af219b3774de14fdfa7da`; npm `latest` returned stable **14.3.0**, released September 28, 2026, with registry `gitHead` **`e043db5462adc8cae0751ec148f5cd5cfb92f098`**. Recommend exact `swiper: "14.3.0"` if selected, not a moving Git HEAD or CDN script. [Release source](https://github.com/nolimits4web/swiper/tree/e043db5462adc8cae0751ec148f5cd5cfb92f098), [npm metadata](https://registry.npmjs.org/swiper/14.3.0). MIT license, no hosted service/key needed. No dependency change was made during this review.
- Swiper registry tarball downloaded from https://registry.npmjs.org/swiper/-/swiper-14.3.0.tgz and SHA512 verified against registry metadata: `sha512-qw0Xv1+sylM8KCQxWxV2iYAK2G6XjFGPZ/8F1baEsY8DK4A3sTnLx6jUJ0G71rDbVQ05JHMWkcWmJ5NvlxZO0w==`. Read packaged React adapter, exports, module JS/types/styles and pinned TypeScript source for Coverflow, Autoplay, Navigation, Pagination and A11y. Registry integrity confirms transfer consistency; it is not an independent security certification.
- Current official docs inspected: [React](https://swiperjs.com/react), [API](https://swiperjs.com/swiper-api), [WAI-ARIA APG carousel pattern](https://www.w3.org/WAI/ARIA/apg/patterns/carousel/). Public docs are mutable; `carousel-provenance.json` records the SHA256 hashes of snapshots retained in the original review workspace; those downloaded source snapshots are not bundled here. Package source and exact release pin resolve API/default discrepancies.

## What to reuse from Brag

Use its **source-grounded storytelling**, not its complete video workflow:

1. Lead with one concrete customer problem, then show entry → key action → result in two or three beats. Suggested theme: “See the plan. Know the next task.” Final product name/copy remains the owner's choice.
2. Each card should show meaningful product material: project/sprint overview → assign an actionable task → inspect progress. A useful fourth card may show team discussion only if chat stays in the MVP. A tour is clearer than rotating unrelated feature slogans.
3. Prefer concise headings, one sentence of context and a stable visual over dense screenshots rendered too small to read. Do not use generic claims such as “10× faster,” “enterprise-ready,” “secure multi-tenant,” customer counts or fabricated testimonials without evidence.
4. Use existing global typography, semantic colors and components. Coverflow is a restrained framing effect; it should not introduce a new design language.
5. Label nonfunctional demonstration data as **“Product preview — sample data”** and any not-yet-implemented flows as **“Planned experience”**. Do not stage a successful production sign-up, billing or isolation demonstration while those capabilities remain unaudited/unimplemented. Real screenshots must use synthetic data and no names, emails or tokens from customers.

Brag's recommendation to keep video timing to 15–25 seconds does not govern an interactive webpage. Web content must remain readable indefinitely through manual controls. Audio, Hyperframes, launch-video render and sharing are out of scope; their costs/availability were not assessed.

## Placement and conversion recommendation

Use one clearly labeled “Explore the product” section on the **public SaaS landing page**, ideally after a short value proposition and before detailed features. Leave the main headline and primary action visible outside the carousel. Exact route/location is pending the owner's answer; do not replace an authenticated workspace/dashboard, onboarding form, or sign-in requirement with a marketing carousel.

Do not hide essential pricing, limitations, accessibility information, privacy, product availability or the only sign-in/interest action inside rotating slides. Provide a static brief description or ordered list below the tour so product value is discoverable without interacting or running motion. If the app is not publicly usable yet, use an honest “Request early access”/“View preview” action and preserve the existing sign-in path separately.

## Swiper integration in existing React/Vite

Swiper 14.3.0 still exports `Swiper` / `SwiperSlide` from `swiper/react` and individual modules from `swiper/modules`. The package React adapter imports normal React hooks and contains no framework migration requirement. Existing React 18/Vite 5 can consume these ESM exports in principle; **actual compatibility is not claimed until frozen install, TypeScript/build and browser tests pass in this repository**.

When chosen, one dependency owner runs the repository's npm workspace install with an exact version (for example `npm install --workspace=client --save-exact swiper@14.3.0 --cache /workspace/.npm-cache`), reviews the manifest/lock diff, then verifies with `npm ci`, typecheck/build and relevant tests. Do not copy an unknown online starter, use a global installer or load a moving CDN bundle. Preserve license notices if source is copied; prefer normal package imports.

Required imports for the requested module set:

```tsx
import { Swiper, SwiperSlide } from 'swiper/react';
import { EffectCoverflow, Autoplay, Navigation, Pagination, A11y } from 'swiper/modules';
import type { Swiper as SwiperInstance } from 'swiper';
import 'swiper/css';
import 'swiper/css/effect-coverflow';
import 'swiper/css/navigation';
import 'swiper/css/pagination';
import 'swiper/css/a11y';
```

These are core + selected module styles, **not** `swiper/css/bundle`. `swiper/css/autoplay` exists but its 14.3.0 file is empty; it is unnecessary for this implementation. If custom controls fully replace a module's default styling, reassess whether that CSS import is still needed. Keep component-specific overrides under a scoped `.product-tour` class and map module CSS variables/control styles to the global tokens; do not globally override every `.swiper` instance.

Baseline config (integration intent, not a drop-in completed component):

```tsx
modules={[EffectCoverflow, Autoplay, Navigation, Pagination, A11y]}
effect={reducedMotion ? 'slide' : 'coverflow'}
speed={reducedMotion ? 0 : 450}
slidesPerView={1}
centeredSlides
spaceBetween={20}
loop={false}
watchOverflow
breakpoints={{
  768: { slidesPerView: 1.35, spaceBetween: 24 },
  1024: { slidesPerView: 1.65, spaceBetween: 32 },
}}
coverflowEffect={{ rotate: 8, stretch: 0, depth: 90, scale: 0.96, modifier: 1, slideShadows: false }}
autoplay={false}
pagination={{ clickable: true, bulletElement: 'button' }}
a11y={{
  enabled: true,
  containerRole: 'region',
  containerMessage: 'Product tour',
  containerRoleDescriptionMessage: 'carousel',
  itemRoleDescriptionMessage: 'slide',
  slideLabelMessage: '{{index}} of {{slidesLength}}',
  prevSlideMessage: 'Previous product preview',
  nextSlideMessage: 'Next product preview',
  paginationBulletMessage: 'Show product preview {{index}}',
  wrapperLiveRegion: false,
}}
```

`navigation` must be connected to instance-local native previous/next buttons using refs or Swiper slot children, styled with shared IconButton/Button. Do not use unscoped global selectors that bind two carousels to each other's buttons. Initialize refs before the module initializes or explicitly re-init navigation once refs exist; test initial render under React StrictMode. The default React-created navigation elements in this release are divs; A11y adds roles/key handling, but native buttons are preferable.

The example `effect` requires a **keyed Swiper remount or deliberate reinitialization** when reduced-motion changes: Swiper docs explicitly say `effect` and `loop` cannot be switched through ordinary responsive breakpoints. Preserve active index if remounting. Read `matchMedia('(prefers-reduced-motion: reduce)')` before starting any rotation and listen for runtime preference changes. At 360px show one full slide and clip transformed neighboring slides inside the carousel viewport; desktop can show restrained visual previews. Do not set `overflow:visible` on the mobile outer viewport or shrink meaningful text to expose more cards.

Keep slide media aspect ratio and height reserved to prevent layout shift. Use local optimized images, useful alt text, lazy-load noninitial images and keep textual meaning outside decorative mock screenshots. Do not initialize authenticated data fetching for landing-page demonstration cards. A static first card/text fallback must survive a failed lazy-loaded tour chunk through an error boundary.

## Autoplay, focus and keyboard contract

**Recommended default: manual navigation**, with optional explicit “Play tour” initiation. This is more readable and avoids motion competing with the primary action. If the owner chooses automatic rotation, the following are required, not optional polish:

- Persistent native rotation control appears before slide-navigation controls in tab order and changes accessible name “Pause tour” / “Resume tour.” Keep controls visible at mobile widths; do not rely on hover, swipe or pagination dots alone.
- Explicit autoplay options: `delay: 6500`, `disableOnInteraction: true`, `pauseOnMouseEnter: true`, `stopOnLastSlide: true`, `waitForTransition: true`; no loop. `disableOnInteraction` must be specified because the inspected runtime default is false while docs/type comments say true.
- WAI-ARIA APG requires rotation to stop when keyboard focus enters and **not restart unless the user explicitly requests it**; Swiper's `pauseOnMouseEnter` does not implement this. Application state must own rotation intent and reasons for being stopped (user pause/focus entry/reduced motion/visibility/intersection). Pointer leave or document visibility restoration must never restart after a durable user/focus stop.
- Swiper exposes `autoplay.pause()`, `resume()`, `start()`, `stop()` plus `running`, `paused`, `timeLeft` and related events. For durable user/focus stop, `stop()` + state and an explicit `start()` on Resume is safer than relying on `pause()` alone: module transition/pointer/visibility handlers may resume paused playback. Temporary hover can pause/resume only if there is no durable stop, no focus-triggered stop and no reduced-motion preference. Ensure the “Resume” control is not immediately canceled by a generic focus handler; distinguish focus entering the region from focus moving between its controls.
- When the tab is hidden or tour is outside the viewport, stop work. On return, respect the prior durable intent; no autoplay under reduced motion. Reduced-motion uses immediate manual changes with no 3D movement. A policy that never auto-resumes after focus/interaction is acceptable and easier to test.
- Keep active focus on the invoked previous/next/pagination control; do not send it into a slide after every change. Native buttons give Enter/Space behavior. A dedicated region-level ArrowLeft/ArrowRight handler can optionally navigate only while focus is in the tour and never intercept input/textarea/contenteditable or page scrolling. The A11y module does not by itself install global arrow-key navigation; import Keyboard only if its behavior is deliberately chosen and scoped. It is not needed for native-button keyboard access.
- Inactive slides must not expose hidden actionable controls to Tab. Prefer noninteractive preview cards with the primary CTA outside the slide deck; otherwise manage inactive-slide `inert`/hidden semantics and remove them for the active slide. Swiper A11y supplies slide labels/roles and focus scrolling but does not guarantee inactive-card interactivity is safe. Do not apply aria-hidden to a focused element.
- Set wrapper/slide announcement policy explicitly: `aria-live="off"` during rotation, `polite` for user-controlled changes. Swiper sets wrapper live mode at init from autoplay configuration; it does not automatically track every application pause/resume. With `wrapperLiveRegion:false`, own a concise active-slide status or update the wrapper live attribute in the controller; avoid duplicate or continuous announcements.

The A11y module is a useful building block, not evidence of WCAG conformance. Custom `renderBullet` bypasses some default labeling behavior; if used, include safe fixed labels/types yourself. Avoid interpolating user HTML into pagination render strings.

## Acceptance checks before merging

1. Real 360px, 768px and 1440px screenshots: one full readable slide on mobile, no page overflow, no clipped controls, stable aspect ratio, global light/dark token appearance, visible primary CTA independent of active slide.
2. Manual keyboard: Tab reaches rotation/previous/next/slide picker/CTA in sensible order; Enter/Space works; focus never disappears into an offscreen card or gets trapped; active slide and position announced once. Test manual screen-reader behavior as well as axe.
3. Autoplay behavior with fake timers and real browser: default manual, explicit play, pause remains paused after hover leave/tab-return, focus entry stops until explicit resume, touch/manual navigation stops, hidden/offscreen stops, final slide stops, reduced motion never starts and turns an active tour off when preference changes.
4. A11y labels/roles and current pagination state pass automated checks; contrast/touch targets meet the global design specification. No false assertion that axe alone proves accessibility.
5. React StrictMode mount/unmount/remount creates one functioning instance, correct local controls, no timer/listener leaks or console errors; preference changes preserve sane active index.
6. Vite production build/typecheck and browser smoke pass with exact dependency/lock changes. Record chunk size before/after, reserve first-render layout, ensure a carousel-load failure shows readable static content and does not block sign-in.
7. Every marketing claim/card is traceable to verified functionality or visibly labeled preview/planned. No live user data, account identities, credentials, fabricated metrics, unverified pricing/free-tier promises or fake production flow.

## Free/options assessment

Brag guidance and Swiper are MIT open-source; manual source review and this frontend carousel need no third-party paid account or runtime API. Playwright and axe-core are open-source testing choices; CI/browser compute still consumes resources. Videos and hosted render providers are neither required nor evaluated here. This proposal adds one focused frontend package rather than multiple slider/motion frameworks. If the final interaction only needs a manual two/three-card sequence with no Coverflow requirement, native CSS scroll-snap + accessible controls can reduce dependencies; do not replace an explicitly desired Coverflow with a weaker look without explaining that tradeoff.
