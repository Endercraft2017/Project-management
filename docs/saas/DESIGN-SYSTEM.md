# One design system for the SaaS

Current brand clarification: E-Z, “Skip the basic” / “skip the basic choices,” using the official AFK³/E-Z logo, dark surfaces and orange→blue→cyan accent direction. The public root/landing uses these verified assets; shared BRAND constants also update app identity. The earlier provisional indigo/unnamed-tour notes below describe the first slice, not an outstanding owner branding decision. Authenticated surfaces now consume the shared global palette; legacy component consistency still requires review. See EZ-TENANT-AND-LANDING-PLAN.md and erp-reference/brand-review.md.

2026-10-28 implementation: official shared tokens now cover landing, company login, console and authenticated surfaces. Orange #F7A21B, blue #4D7CFE and cyan #36D7FF are the shared brand accents. Light app primary is a deeper orange with white text; dark app primary is official orange with dark text. Background/surface/text tokens and locally hosted Inter are shared in client/src/index.css. Public display typography uses Manrope. Access pages deliberately retain the dark brand surface in either system theme; project/task surfaces follow light/dark preference.

Shared motion tokens cover press120ms, fast150ms, standard200ms and overlay250ms. Carousel spatial movement has explicit timing, manual-first playback and reduced-motion support. Guidance/provenance is in design-research/. The confirmed identity is no longer an outstanding decision. Legacy component migration and complete accessibility validation remain work to review; shared tokens are not accessibility certification.

## Ownership and source of truth

One design-system owner maintains tokens, primitives and shell compositions. Storybook is a future documentation target, not an installed gate. Feature agents consume these components and submit shared changes to that owner rather than invent local variants. Use the existing Tailwind/Radix foundations and add semantic wrappers. Do not introduce a second component framework. Product identity, colors and wording are shared across login, app, settings, billing, email and public pages.

Use the confirmed shared semantic palette rather than feature-specific color definitions. Animated glass/gradients belong mainly to optional chrome; task tables, forms and reports need stable opaque surfaces. Respect reduced motion and provide readable contrast regardless of backdrop.

## Tokens and primitives

| Layer | Required standard |
|---|---|
| Color | Background, surface tiers, text/icon pairs, borders, focus, primary, destructive, success, warning, info; chart/status colors paired with text/icons/patterns. Light and dark map to the same semantic names. |
| Type/spacing | One typography hierarchy and spacing scale; documented heading/body/label/metadata usage, density, radius and shadow levels. Avoid per-screen arbitrary sizes and colors. |
| Inputs | Shared Button/IconButton, Link, Field, Input, Textarea, Select/Combobox, Checkbox; labels, help/errors, required state, pending/disabled behavior. |
| Overlays | Radix-based Dialog/AlertDialog/Sheet, Menu, Popover, Tooltip; keyboard focus trap/return, Escape, scroll lock and accessible names. No ad hoc div-based modal. |
| Feedback | InlineNotice, ErrorState, EmptyState, Skeleton, Toast and progress; consistent tone, retry and live-region announcements. |
| Data | Card, Table/Tree, filter/selection toolbar, pagination, detail panel and accessible chart alternatives. List density is consistent across modules. |
| Layout | Workspace AppShell, PageHeader, breadcrumbs/actions, settings layout and responsive sheet patterns; one navigation registry/routing policy. |

Component stories cover light/dark, narrow/wide, long text, loading/error/empty, disabled and keyboard interaction. Enforce shared imports/tokens through lint rules with documented exceptions. Implementation tokens are the maintained source; a separate design mockup cannot silently drift.

## Product routes and flows

Current routes: / and /tour are the public landing; /login is company login; /activate consumes a one-use setup link; /app is the company workspace; /console/login and /console/tenants are the separate operator interface. Provisioning returns a setup link for manual delivery and does not claim email delivery.

Company code selects a tenant at login; the server-bound session resolves the schema. Names, codes and navigation URLs do not grant access. Operator and company sessions remain separate. Legacy app hashes and query links remain supported.

For every query: loading, empty, error, denied and success are distinct. A network outage must not masquerade as sign-out or an empty dataset. For every mutation: pending, success and failure; preserve entered content on failure, prevent duplicates, provide retry, and roll back optimistic state correctly. Confirm irreversible operations with scope and effect; offer undo when safe. Avoid native blocking alert/confirm in product workflows.

## Accessibility and responsive acceptance

- Target WCAG 2.2 AA: text contrast 4.5:1 for ordinary text and 3:1 for large text; meaningful UI boundaries/focus indicators have appropriate non-text contrast. Validate actual composed colors, including translucent surfaces.
- Keyboard-only operation, visible unobscured focus, correct names/roles/state, field labels and error associations, screen-reader announcements, sensible heading order, and skip navigation. Meet applicable 24px minimum target requirements; prefer 44px touch targets in primary mobile interactions.
- Test at 360, 768 and 1440px, 200% zoom, long names, long translations, empty projects and dense data. Avoid viewport horizontal scrolling; intentional table/timeline scroll stays local and labeled.
- Do not rely on color alone for task status/progress or chart meaning. Chart-based workflows have a usable table/text alternative.
- Define timezone and date-only semantics centrally. Store instants in UTC; distinguish date-only deadlines from timed events; use a consistent locale/timezone formatter.
- Playwright browser regressions and manual visual/keyboard checks are maintained. Axe and screen-reader testing remain additional acceptance coverage. No automated tool alone certifies accessibility. Visual snapshots need human review for intended changes.

## Definition of visual consistency

A feature is not complete if it introduces a new modal, button language, status color, spacing pattern, error format or settings navigation without updating shared components and examples. Review representative task editing, chat retry, workspace settings and billing states before migrating every screen. Cosmetic polish cannot mask a broken save, lost draft or authorization error.
