# E-Z public brand reference

Reviewed 2026-10-28. Public read-only HTTPS evidence; no login, form submission, message or customer data access. Product code was not edited. `brand-provenance.json` records exact source URLs and snapshot hashes; downloaded source snapshots remain in the original review workspace and are not bundled in this package.

## Confirmed identity and copy

Primary source: https://afkcube.com/products/e-z (`afkcube-ez-product.html`).

- Name: **E-Z** (HTML title, brand lockup and SoftwareApplication structured data, lines 6,60,118).
- Hero tagline: **“Skip the basic.”** (line122). Owner's conversational form “Skip the basic” is consistent; punctuation is present on the public product page.
- Longform: **“Skip the basic choices.”** (structured data line62, visible subheading line124 and homepage product card).
- Additional evidenced phrasing: “Everything from E to Z, made easy.” (line123) and “Everything from E to Z.” (feature heading).
- Publisher: **AFK³ Solutions**. Product belongs to AFK³; parent logo/identity must not be mistaken for the E-Z product mark.
- Current public status: explicitly **“In development”** in the product lockup (line119) and parent homepage product card. CTAs say Get Early Access/Join Early Access; these are not proof that self-service paid SaaS onboarding is ready.
- Existing live app title is **“E-Z Project Manager”**, from https://ez.afkcube.com/ (`ez-current.html:10`). Meta description lists sprints, tasks, chat and AI weekly summaries. This differs from the old local ServiceBay naming and is the correct current brand evidence.

## Logo assets

Inspected visually using downloaded files (no reconstruction):

| Origin | Asset | Evidence |
|---|---|---|
| Parent product page | https://afkcube.com/assets/ez-logo.webp | 333×360 transparent WebP, used in public E-Z lockup. Local `ez-parent-logo.webp`. |
| Live E-Z app | https://ez.afkcube.com/brand/ez-logo-180.png | 180×180 transparent PNG. Local `ez-live-logo-180.png`. |
| Live app icons declared in HTML | `/brand/ez-logo-32.png`, `/brand/ez-logo-64.png`, `/brand/ez-logo-180.png` | `ez-current.html:5-7`. Only180px downloaded by this reviewer; do not claim32/64pixel image inspection. |

The mark is an isometric cubic **EZ**: orange/gold left E face, blue/cyan right Z face and cyan-to-blue top. Parent and live images represent the same mark, with different canvas proportions/padding. Use the original transparent asset at preserved aspect ratio; avoid recreating it as the generic layered-purple icon from the earlier tour. No source establishes official logo exclusion-zone/minimum-size rules; engineering clear-space recommendations must be labeled recommendations, not brand-manual facts.

The product structured-data image points to `/assets/ez-logo.png` while its actual hero uses `.webp`; this review downloaded and verified the visible hero asset, not that separate PNG.

## Evidenced palette and type

Source: https://afkcube.com/style.css (`afkcube-style.css:7-28`, E-Z rules around1332).

| Role | Exact declared value |
|---|---|
| Primary background | `#080B12` |
| Secondary background | `#0D121C` |
| Surface / raised | `#111824` / `#151E2C` |
| Primary / secondary / muted text | `#F5F7FA` / `#AAB5C4` / `#738094` |
| Parent cyan accent | `#36D7FF` |
| Blue accent | `#4D7CFE` |
| Violet supporting accent | `#8B6CFF` |
| Success | `#63E6BE` |
| Borders | White at8% /16% |
| E-Z-specific headline gradient | `linear-gradient(100deg, #F7A21B 0%, #4D7CFE 60%, #36D7FF 100%)` |
| Headline family | `Manrope`, then Segoe UI/system |
| Body family | `Inter`, then Segoe UI/system |
| Mono/eyebrow family | `JetBrains Mono`, then UI monospace |

Source CSS comment explicitly says orange is taken from the E-Z logo; other E-Z page colors use parent tokens. Font stylesheet requests Manrope500/600/700/800, Inter400/500/600 and JetBrains Mono400/500. Visible E-Z name uses Manrope800. Preserve one type/token system across landing, login and product UI; importing parent styles wholesale would also import unrelated layout/behavior, so map these values into the shared tokens deliberately.

**Current live app differs:** its delivered `/assets/index-BiEmkiyJ.css` still contains the existing light/dark violet/glass variables (light `--primary:245 75% 60%`, dark `245 85% 70%`; blob colors pink/blue/mint). The public parent brand is dark/cyan/blue with orange E-Z emphasis. This is evidence of brand drift, not two interchangeable “official” new design systems. Recommendation: use E-Z's actual mark and headline/brand emphasis, map the chosen public dark palette consistently, and retain accessible light mode intentionally if desired rather than infer it from the parent page. Accessibility of exact composed palette has not been measured in this review.

## Contact and login destinations

- Public product Get/Join Early Access links point to **`/contact` on afkcube.com**, i.e. https://afkcube.com/contact. This is the safest evidenced destination for the requested **“Talk to us”** link; no submission or mail-send was performed.
- Parent homepage Organization JSON-LD declares `contact@afkcube.com` and contact URL `https://afkcube.com/contact`. Contact page also offers telephone `+639913257591` (static evidence only; no call was made).
- Contact form's current intent options are workflow/otom/referral (`afkcube-contact.html:113`), **no E-Z-specific option**. Do not invent an unsupported `intent=ez` prefill or imply the form already has E-Z routing. A normal generic contact link works as navigation; form delivery/routing was not tested. Optional follow-up in the parent-site project: add explicit E-Z inquiry attribution.
- Live product home is https://ez.afkcube.com/. For the new public landing, **Log in** should route to a deliberate existing app/auth entry, not trigger Google OAuth merely because someone clicks a marketing CTA. The current local preserved Google entry is `/api/auth/google`; use it only as the sign-in provider action on the actual login screen. Final landing/login route ownership is parent integration's responsibility.

## Product claims and readiness

The parent product page markets task management (Kanban, due dates, priorities, subtasks), admin/manager analytics, team chat (channels, DMs, task-linked threads, mentions), and AI (drafting, thread summaries, risk flags, reports). These are **public marketing claims**, not verified implementation scope. Keep the site's explicit In development/early-access status and the SaaS audit's known gaps in view.

The parent page's `.ezapp` hero is a **CSS/HTML mockup**, including the AI suggestion about tasks at risk; its feature cards and mockup are not actual app screen captures. The previous generic tour's Northstar boards are also illustrations. Neither should be relabeled “our actual screens.”

For the requested carousel of actual E-Z screens:

1. Capture rendered components/pages from the actual E-Z code/runtime using a documented local or authorized staging build and synthetic data. Record route, repo/commit, viewport/theme, synthetic fixture identity, capture date and file hash for each image.
2. An unauthenticated screen may be captured from the public live E-Z app; authenticated screens require supported safe fixtures or authorized test accounts. Do not invent sessions, expose customer data, or claim a production capture from a fabricated mock component.
3. If an existing feature is genuine but shown with synthetic local data, label it “E-Z screen · demo data.” If a feature is only proposed, label it separately “Planned experience” and do not mix it into a claimed actual-screen carousel without disclosure.
4. Product claims and CTA text should reflect readiness. Do not claim isolation, entitlements, capped AI usage, paid onboarding or production availability based solely on these marketing pages. The existing SaaS audit still governs functional readiness.

## Browser/screenshot limitation

Chromium navigation to the public domain failed `ERR_CERT_AUTHORITY_INVALID` under the session proxy. Verification was **not** disabled. The authoritative HTML/CSS/images above were retrieved successfully using normal TLS-verified HTTPS. Optional public rendered-page screenshots were therefore not generated by this reviewer. Logo images were visually inspected locally; palette/type are exact source declarations rather than computed browser observations. Parent may configure supported Chromium CA trust for later public screenshots, but this does not block source-grounded brand integration.
