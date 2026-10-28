# Ordered implementation and release plan

Follow [ROLLOUT-CHECKLIST.md](ROLLOUT-CHECKLIST.md) in sequence. Each phase has an owner, concrete checks and an exit condition. The current implementation and test scope are recorded in [VERIFICATION.md](VERIFICATION.md).

1. Review the implementation, tenant/session boundaries and retained tests on `production`.
2. Reproduce local setup and bootstrap the first operator without provider credentials.
3. Select and measure hosting, database connections, region and admitted pilot capacity.
4. Rehearse worker execution, hard quotas, encrypted off-site backup and empty-target recovery.
5. Activate only explicitly selected optional providers with a verified free allowance and cost stop.
6. Complete billing, privacy, lifecycle, operator security and support work before commercial promises.
7. Release the exact reviewed artifact through a separately approved deployment, then monitor the pilot.

The first two steps have local implementation/test evidence. Hosted provider activation and commercial launch remain incomplete. No merge to `main`, public deployment, paid service activation or ERP change is implied by pushing this branch. Historical phase plans and Arena options are preserved in [history](history/) and [arena](arena/).
