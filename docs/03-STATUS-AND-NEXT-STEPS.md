# Status and next steps

Code review date: 2026-09-29. This is a repository audit, not a deployed-system test. External deployment, credentials, backups, and production data state are unverified.

## Current state

All active application code is under `src/`. Explicit Next.js Route Handlers cover endpoint families; `backend/`, Express dispatcher, and Express dependencies are gone. The prior MVC tracker marks controller conversion, lint, tests, Playwright, build, and manual checks complete as of its last update. Those historical checks do not verify the current deployment. Prisma has baseline and workflow-index migrations. `src/server/` still contains compatibility state and shared services.

## Open release blockers

1. Replace demo `X-User-Id` identity with validated Microsoft Entra sign-in and server sessions. Provision real user mappings and remove demo login before real-data use.
2. Verify `DATABASE_URL` pooler credentials, remote migration status, backups, restore drill, and persisted-row behavior in the target environment. A 2026-09-19 handoff reported a rejected pooler credential; current status is unverified. Rotate any credential previously shared outside approved secret storage; current rotation state is unverified.
3. Verify private Supabase Storage bucket, upload CORS, resource authorization, retention, and recovery on the target deployment.
4. Replace simulated email and Teams delivery with approved providers, retry behavior, and durable outbox ownership. Current `sendEmail` records process-local notifications.
5. Review route authorization, RLS or backend-only database boundary, privacy, audit retention, financial controls, incident ownership, monitoring, and user acceptance testing. Earlier introspection reported RLS disabled; current remote state is unverified.
6. Audit multi-step writes for transactions and idempotency. Add server-side pagination/query plans where reporting volume requires them. Confirm responsive and accessibility behavior with actual browsers.
   Claim numbers use a database sequence when available, but `generateClaimNumber()` falls back to a process counter after a database error. Review that fallback before real-data use.
7. Review dependency advisories against the current lockfile. The 2026-09-19 audit included removed `backend/` packages, so its counts and exposure assessment are obsolete.

## Product decisions and current audit

`src/lib/reimbursement.ts` and the claim service enforce a PHP 1,000 reimbursement cap; claim release is cash-only. Claim and MOM PDF export code exists. Historical import now has transactional error handling in `src/services/admin/admin.ts`; the older claim that it is process-only is obsolete. Review meetings, returned-claim resubmission, stale approver transfer, and signed storage routes exist. These paths need end-to-end verification before release.

The prior requirements and audits disagree on deployment target, weekly approver KPI, external client CC policy, SAP Company Directory integration, and whether cash-only applies outside reimbursements. Product owner must confirm these decisions. Current code and deployment configuration take priority for operational instructions. Do not treat an old audit score as current test evidence.

## Migration record

The original MVC tracker recorded completed conversions for receipts, field definitions, master data, companies, users, delegations, support, review meetings, activity, analytics, cash advances, liquidations, auth, MOMs, admin/imports, and claims. It also recorded compatibility cleanup and release checks. Future endpoint work should follow `AGENTS.md`: service first, explicit Route Handler, preserve contracts, run lint and tests, then update this status. No endpoint family is currently listed as awaiting conversion.
