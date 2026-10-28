# One design system for the SaaS

2026-10-28 implementation: shared motion timing/easing tokens now live in client/src/index.css. The isolated /tour page uses the existing semantic palette and scoped Swiper styles. Reviewed guidance and provenance for Genjutsu, Taste, Hallmark, Brag and Swiper are in design-research/. Final product name/palette and the wider app rebrand remain pending; this page is a reviewed product-preview slice, not a completed redesign of every authenticated screen.

This is the proposed global UI specification. Existing CSS already has semantic light/dark tokens and shared glass surfaces; preserve useful foundations while replacing inconsistent feature-level controls. Authenticated screens have only been reviewed statically in this audit; do not claim their contrast or accessibility has been validated.

## Ownership and source of truth

One design-system owner maintains tokens, primitives, shell compositions and Storybook. Feature agents consume these components and submit shared changes to that owner rather than invent local variants. Use the existing Tailwind/Radix foundations and add semantic wrappers. Do not introduce a second component framework. Product identity, colors and wording are shared across login, app, settings, billing, email and public pages.

Until the owner chooses branding, use a neutral functional work surface with restrained existing accent colors. Animated glass/gradients belong mainly to optional chrome; task tables, forms and reports need stable opaque surfaces. Respect reduced motion and provide readable contrast regardless of backdrop.

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

Component stories cover light/dark, narrow/wide, long text, loading/error/empty, disabled and keyboard interaction. Enforce shared imports/tokens through lint rules with documented exceptions. Storybook and implementation tokens are the maintained source; a separate design mockup cannot silently drift.

## Product routes and flows

Public: product/pricing, sign-in/signup/recovery, legal/support. Account: identity/security, sessions and preferences. Workspace onboarding: create or join workspace, create first project, invite a teammate, create/complete first task. Workspace settings: profile, people/roles, integrations, plan/usage, export/deletion. App: project/task/sprint views followed by retained collaboration/reporting modules.

Use `/w/:workspaceSlug/...` or another single reviewed routing convention with immutable-ID resolution server-side. Slugs are navigation, not security boundaries. Workspace switching is visible and explicit; account settings and workspace settings cannot be confused. Preserve deep links across sign-in and browser back/forward without granting access from the URL.

For every query: loading, empty, error, denied and success are distinct. A network outage must not masquerade as sign-out or an empty dataset. For every mutation: pending, success and failure; preserve entered content on failure, prevent duplicates, provide retry, and roll back optimistic state correctly. Confirm irreversible operations with scope and effect; offer undo when safe. Avoid native blocking alert/confirm in product workflows.

## Accessibility and responsive acceptance

- Target WCAG 2.2 AA: text contrast 4.5:1 for ordinary text and 3:1 for large text; meaningful UI boundaries/focus indicators have appropriate non-text contrast. Validate actual composed colors, including translucent surfaces.
- Keyboard-only operation, visible unobscured focus, correct names/roles/state, field labels and error associations, screen-reader announcements, sensible heading order, and skip navigation. Meet applicable 24px minimum target requirements; prefer 44px touch targets in primary mobile interactions.
- Test at 360, 768 and 1440px, 200% zoom, long names, long translations, empty projects and dense data. Avoid viewport horizontal scrolling; intentional table/timeline scroll stays local and labeled.
- Do not rely on color alone for task status/progress or chart meaning. Chart-based workflows have a usable table/text alternative.
- Define timezone and date-only semantics centrally. Store instants in UTC; distinguish date-only deadlines from timed events; use a consistent locale/timezone formatter.
- Playwright + axe are automated gates, complemented by manual keyboard/screen-reader review. No automated tool alone certifies accessibility. Visual snapshots need human review for intended changes.

## Definition of visual consistency

A feature is not complete if it introduces a new modal, button language, status color, spacing pattern, error format or settings navigation without updating shared components and examples. Review representative task editing, chat retry, workspace settings and billing states before migrating every screen. Cosmetic polish cannot mask a broken save, lost draft or authorization error.
