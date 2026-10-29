# Hosting and provider review

Checked 2026-10-29 (Asia/Manila). This records observed configuration and primary-source research, not merchant approval, legal advice or a production-readiness certificate. No paid resource, provider account or customer credential was created during this review.

## Observed E-Z deployment

Railway project **E-Z**, environment **production**, service **server** uses `Endercraft2017/Project-management`, branch `production`, repository root, Railpack and `npm run build`. The API has one replica in `sfo` (San Francisco). This US location requires a deliberate cross-border data assessment for the Philippines business and its intended international customers; it does not establish EU residency.

The last verified successful release before this patch was `a8157a85e229a3750f08bda63f15283b94cb76c8`, deployment `eb919723-f2d6-4425-bb72-b6678325606e`. Separate tenant and operator session secrets are configured. Native-origin readiness returned 200, operator access 401 (sign-in required), and password login was enabled while Google/AI were disabled. An initial operator account has not been created or its existence verified by this review. Never invent default credentials or clear the operators table.

The custom domain is `https://ez.afkcube.com`; its WAF returns 403 to automated requests from this environment. Read-only checks used the Railway origin. They do not establish successful authenticated flows on the custom domain. Production credentials must be entered on the approved custom origin, not a different Railway origin whose writes may fail trusted-origin checks.

Dashboard overrides used the legacy public-schema migration/start command and `/health` at inspection. They were updated through Railway's environment configuration command to `npm start` and `/health/ready`. The repository now explicitly selects the existing Railpack builder. Verify the effective deployment manifest after release; an accepted configuration edit alone is not a healthy deployment.

The PostgreSQL service has a volume; the **API service has no persistent upload volume**, and `UPLOAD_DIR` is unset. PostgreSQL persistence does not persist API files. This patch blocks new production uploads until the operator verifies an actual mount, configures its absolute private upload path, and sets `STORAGE_PERSISTENCE_CONFIRMED=true`. Existing authorized reads remain available. Do not set the flag to silence the guard. Preserve old files before rebuilding an ephemeral instance; a successful deployment is not file recovery.

A bucket exists, but private access policy, credentials, region, lifecycle and recoverable contents have not been verified. There is no observed dedicated worker service, off-site backup schedule or continuous uptime monitor. Adding a worker or volume can consume usage even if its software is free.

## Research findings and recommendations

| Area | Verified source finding | E-Z consequence |
|---|---|---|
| Railway cost | [Plans](https://docs.railway.com/pricing/plans): Free includes $1/month resource credit; Hobby is $5/month. Resource consumption is metered. | App, PostgreSQL and worker are not established as a sustainable $0 stack. Bound the pilot; do not upgrade or add services on the assumption that advertised allowances cover them. |
| Spending controls | [Cost control](https://docs.railway.com/pricing/cost-control): a soft limit sends email; a hard limit takes workloads offline when reached. | Verify actual workspace plan, credits and hard limit. This project token cannot read billing controls. An alert alone is not a spending stop. |
| File persistence | [Volumes](https://docs.railway.com/volumes): attach a volume to the writing service and use its real mount path. | Do not reuse the PostgreSQL data mount for app files. Verify a separate durable private location, quota accounting and restore within the approved budget. |
| Availability | [Healthchecks](https://docs.railway.com/deployments/healthchecks): deployment-start checks are not continuous monitoring. | Use `/health/ready` for admission; separately arrange a monitor, alert recipient and incident procedure. No uptime SLA follows from a passing deploy check. |
| International payments | [Paddle countries](https://www.paddle.com/help/start/intro-to-paddle/which-countries-are-supported-by-paddle): supports software businesses except listed excluded jurisdictions; Philippines is not excluded. [Pricing](https://www.paddle.com/pricing): advertised standard rate 5% + 50¢ per checkout, no monthly fee. | Recommended first candidate for international SaaS and merchant-of-record operations. Eligibility is not approval. Check settlement, tax, currency, refunds and low-price unit economics. Transactions are not free. |
| AI data | [OpenAI API data controls](https://developers.openai.com/api/docs/guides/your-data): no model training by default; abuse-monitoring logs can retain content up to 30 days, subject to documented exceptions. Zero Data Retention needs approval. | Existing adapter is not a free-inference or zero-retention promise. Keep disabled until provider/model/budget and disclosures are approved. A key alone does not authorize sending private content. |

Fresh retrieval of PayMongo developer docs, Cloudflare R2 pricing, OpenAI pricing and the OWASP authentication cheat sheet returned HTTP 403. No proxy bypass was attempted. Earlier research remains in its ledger, but current numeric allowances or claims from those blocked pages were not revalidated. No free AI provider/model was selected on that evidence.

## What the product should say now

- Landing: “E-Z — Skip the basic,” actual-screen attribution, clear company login/contact, and staged-rollout description. No unlimited AI/storage, free-forever hosting, automatic onboarding, available paid-plan or verified recovery-SLA claims.
- Company access: company code, email and password. Customers do not supply Google credentials. Share invitations/recovery links privately until email delivery is verified.
- Console: distinguish account slots from billable active members, explain pending accounts count, display storage units and cumulative AI limits, and explain fresh sign-in for owner recovery.
- Account security: password change verifies the current password and revokes other sessions. Private initial activation and optional enforced authenticator MFA with recovery codes are now in source. Forgotten-password recovery and additional-operator lifecycle remain separate work.
- Privacy/support: real support/security contact, vendor/data-location disclosures and implemented retention policy before customers. Seven daily backups do not establish 30-day deleted-item recovery.

## Ordered next work and consolidated owner inputs

1. Establish the first operator privately and verify company creation → owner setup → company login on the custom domain. Owner input: operator email/name and secure credential delivery; never paste a password in chat.
2. Verify Railway plan, allowance and hard stop. Owner chooses strictly $0 with constrained availability or a separately approved future hosting budget. No increase is assumed.
3. Verify durable private uploads/off-site backup and rehearse restore before enabling uploads. Owner confirms data region and backup/support responsibility. Preserve existing files first.
4. Enroll the intended operator in implemented authenticator MFA and save recovery codes/key independently. Complete a separately reviewed forgotten-password procedure. Keep operator security separate from company-admin access.
5. Exercise the implemented bounded JSON workspace export. Complete full personal-data portability/deletion, compatible 30-day recovery, versioned tenant migrations, measured admission limits and alerts.
6. Select AI model/provider and numeric allowance after free terms/privacy verification; activate worker only within measured resources. Owner approves data disclosure. Zero remains the allowance.
7. Finalize active-member definition, prices/currencies, caps, grace/cancellation/refunds and provider approval. Build hosted checkout and signed, deduplicated, reorder-safe webhooks in test mode before taking money.

Brand, tenant-code login, standalone console, Philippines business, international markets and exclusion of Google integrations are settled. See [DECISIONS.md](DECISIONS.md) for accepted choices.
