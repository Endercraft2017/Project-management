# Design tool review for the existing SaaS interface

Reviewed 2026-10-28. Public repository metadata and source files were fetched over HTTPS with TLS verification. These are real skill repositories, not merely gallery sites. No install command, remote agent, package hook or fetched JavaScript/Python script was executed. This is a source/guidance review; it is **not** a claim that their full build pipelines or proprietary visual scores ran.

## Sources and exact pins

| Repository | Actual fetched HEAD | Relevant guidance inspected | Cost/license |
|---|---|---|---|
| [AThevon/genjutsu](https://github.com/AThevon/genjutsu) | `1f518a71378b15d423389e546e767cffc86e14c3` | README; `skills/paint/SKILL.md` existing-project/thesis/token/audit sections; full `motion-principles/SKILL.md`, easing guide, `css-native/SKILL.md`, `design-audit/SKILL.md` | MIT; vendored ui-ux-pro-max dataset has a separate upstream MIT notice. OSS license does not make agent inference free. |
| [Leonxlnx/taste-skill](https://github.com/Leonxlnx/taste-skill) | `12af471f627f866411b4bd785b19646d3672784c` | README; actual skill is named `design-taste-frontend`; main SKILL; selected app-screen/motion/critique sections | MIT; Node22+ and installed Chromium/Chrome/Edge for its inspector; no API key required for those scripts. Optional desktop products/sponsors are not prerequisites. |
| [Nutlope/hallmark](https://github.com/Nutlope/hallmark) | `6033bab2a8051b5454552d2e8e6cb8f27c483a42` | README; full `skills/hallmark/SKILL.md`; redesign/polish, app-screen/harness branches, finish/hero review; selected microinteraction guidance | MIT; its own render script needs Node18+, Puppeteer Core and Chromium/Chrome. No need to install it globally to review guidance. Photo licenses are separate if assets are later used. |

Machine-readable provenance includes exact raw-file URLs, SHA-256 digests and honest read coverage: [provenance.json](provenance.json). Downloaded-but-unread supporting files are labeled as such. Vendor sources live under `vendor/` outside the application checkout. Nothing was copied into product code during this review.

## How to use them together

Use Genjutsu's interaction-thesis and motion foundations to specify behavior once. Use Taste's **app-screen** review to inspect density, hierarchy, real data, states and phone behavior. Use Hallmark's existing-design polish and fresh-context review to check that improvements preserve the application and its wiring. One global project design contract must remain authoritative; do not let three skills generate three competing themes or token systems.

The current React/Vite/Tailwind/Radix stack and established indigo/purple palette with pink/blue/mint accents are the starting constraints. No framework migration, new animation dependency, carousel or asset collection is justified merely by these tools. A named skill is reviewed as third-party guidance; the user's existing instructions and chosen palette override its subjective defaults.

### Guidance conflicts resolved explicitly

1. **Palette.** Taste's default rules ban violet/indigo; its app-screen guide expressly says that ban is the author's taste, despite 10 of its 23 studied screens using those colors. Its existing-brand path supports `--keep palette,type` and an explicit per-rule inspector allowance. Hallmark defaults ban purple-to-blue gradients and normally deals a theme, but also recognizes existing brand values and a locked design system. Preserve the user's palette; map it to semantic roles and document a brand exception rather than silently replacing it or reporting a known-brand rule as a defect.
2. **Marketing versus application.** Taste's landing-page motion/image floors and Hallmark's hero/word-budget/layout rules do not apply to the authenticated SaaS work screens. Taste says app screens have **no motion floor**; Hallmark app scope removes hero, fold, section rhythm, stand-in photographs and load reveals. Do not add eight animations, four photographs, cinematic scrolling or oversized headlines to satisfy a marketing rubric.
3. **Depth.** Hallmark defines full redesign, restyle and polish separately. Polish preserves system/layout and fixes named defects; restyle preserves layout; full redesign recomposes while retaining content/wiring. For a user request to keep the palette and improve interactions, scoped polish/restyle is the appropriate default; structural SaaS flows remain a separately planned product change.
4. **Approval-heavy pipelines.** Genjutsu full paint asks for many explicit visual/token/dependency approvals and can escalate to a costly bunshin multiagent pipeline. Existing task authorization and the user's requested decision process take precedence; reading/applying the technical guidance is not a claim that those full workflows ran. No extra approval flow was introduced by this review.
5. **Tool assumptions.** Hallmark's harness table says Codex has no subagents and network is off by default; this session has both capabilities. Use the actual runtime/tools, not those stale assumptions. Genjutsu's browser support claims are dated2026-09-08; check current compatibility before adopting newer CSS APIs.

## Proposed global interaction contract

These values are an implementation recommendation synthesized from the reviewed guidance, not values that already exist in the app:

| Interaction | Proposed token/behavior | Rationale/source |
|---|---|---|
| Focus | Immediate visible ring, no delayed focus animation | All three require visible focus; keyboard users should never wait for it. |
| Press | `--motion-press:120ms`; optional subtle `scale(.98)` on a discrete button, never the entire form/layout | Genjutsu microinteractions100–150ms; Taste press100–160ms. Do not scale disabled/loading controls or move hit targets. |
| Hover | `--motion-fast:150ms`; contrast/border/tint response on fine pointers; no ubiquitous card lifting | Genjutsu frequency rule; Taste press/hover recipe scopes hover to `(hover:hover) and (pointer:fine)`. |
| Menu/popover | `--motion-standard:200ms`; opacity plus6px translation or scale(.98) from trigger origin | Reviewed sources converge on150–300ms; preserve positioning, keyboard navigation and dismissal. |
| Dialog/drawer | `--motion-overlay:250ms`; short translation/opacity, exit150–180ms | Genjutsu UI transitions200–300ms; exit shorter than entry. Modal focus/inert semantics belong to existing Radix wrappers, not animation code. |
| Easing | One entry/snappy curve, e.g. `cubic-bezier(.2,0,0,1)`; one short exit curve; state changes can use ease-in-out | Genjutsu easing reference. Taste also provides `.22,1,.36,1` entry and shorter exit; choose one system once instead of mixing per feature. |
| Lists/task updates | Instant data feedback with concise transition only when spatial change helps; no load stagger on every row | Taste app-screen route: motion is feedback, no required entrance choreography. Keep frequent actions fast. |
| Reduced motion | Remove translation, scaling, parallax, autoplay and decorative loops; show final content immediately; gentle color/opacity can remain only if helpful | Both motion references; every feature must have an actual reduced path rather than an empty media query. |

Prefer native CSS for this scope. `transform` and `opacity` avoid layout animation; use explicit transition properties rather than `transition:all`. Do not introduce GSAP/Motion/Three.js for a button, sidebar or simple card treatment. Do not assume clip-path/filter/backdrop effects are free: profile real devices before using them extensively.

**Depth should communicate hierarchy.** Use surface tone, border contrast and existing elevation tokens for canvas/panels; reserve stronger shadow for floating dialogs/popovers. Keep the same elevation/radius rules everywhere. A slight card translation should not turn every static task into a draggable-looking object. Perspective/3D tilt or parallax is a special treatment needing a concrete target and accessible static path, not a global dashboard default.

**Carousel status:** no carousel was established in the current app. Do not invent a target. Once a real screen/location is chosen, specify its job and data first. If a carousel is appropriate, require keyboard Previous/Next, accessible names/current-position information, touch and non-drag alternatives, stable focus, no essential content hidden exclusively behind motion, and no autoplay by default. A restrained CSS scroll-snap list may serve better than a new 3D carousel dependency. This is a recommended accessibility contract, not a claim that these repositories audited a carousel here.

## Existing-design preservation and review

Hallmark redesign guidance inventories links, forms, names/IDs, handlers, routes and test hooks before changes, then compares what survived. Taste's existing-page branch says to keep stack/content/functionality, inspect before and after and click through previously working links/forms/menus. Adopt that principle with the project's existing tests and browser tooling:

1. Record a clean baseline of changed screens and interaction wiring. Preserve the app's routes, API calls, form semantics, authorization checks, component props and test hooks. A styling change must not clear drafts, reset filters or hide error states.
2. Lock one palette/type/spacing/radius/elevation/motion contract using current semantic tokens. Render all controls in default, hover, focus, active, disabled, loading, success and error states. Not every state is meaningful for every control; distinguish them rather than forcing fake success behavior.
3. Build one representative task/list/detail and settings flow against shared components. Reuse its primitives across screens; no per-agent palettes or one-off shadow/radius systems.
4. Capture before/after at desktop, tablet and phone widths. Taste's inspector uses1440/768/390; the project can also keep its existing360px mobile fixture. Test200% zoom, long names, empty/large data, loading, failure, keyboard navigation, reduced motion and light/dark contrast.
5. Use a fresh reviewer who sees screenshots before implementation rationale. Hallmark finish review asks explicitly: **what did the old page do better?** Fix at most the top few concrete problems per round; do not keep cycling through subjective themes.
6. Run typecheck/build and relevant behavior tests. Browser/axe checks are evidence for detected cases, not a WCAG certification. Profile before claiming60fps; a static motion guard cannot establish performance.

The session already has browser capability from the earlier audit; reuse it where available. We have not vetted or run the fetched skills' inspector/linter scripts here, so do not report `0 FAIL` from them. To execute one later, fetch its exact transitive files at the same pinned commit, inspect its local/network/process behavior, adapt brand allowances explicitly, then run on local/staging routes only. Existing Playwright/axe plus screenshots can deliver the relevant browser evidence without installing a new agent/plugin.

## What is and is not verified by this review

Verified: named repositories exist; actual pinned commits/skill sources/licenses were retrieved; motion/app/polish/preserve-functionality guidance was read and relevant contradictions were identified. Unverified: their full pipelines, scripts, rendered scores, plugin installations, new application interactions, actual carousel, authenticated visual flows, new palette contrast and runtime animation performance. No product files changed.
