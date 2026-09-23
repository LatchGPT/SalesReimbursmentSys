# Next MVC Migration Tracker

## Verification gate

- [ ] Run `npm run lint` after every batch.
- [ ] Run `npm test` after every batch.
- [ ] Stop and fix failures before another batch.
- [ ] Configure Playwright and run `npx playwright test` after all batches.

## Completed

- [x] Removed `backend/`; active code is under `src/`.
- [x] Moved repositories and persistence support to `src/lib/db/`.
- [x] Moved server types to `src/lib/db/serverTypes.ts`.
- [x] Moved health, storage, cron, and dispatcher code to `src/services/`.
- [x] Converted receipts to `src/services/claims/receipts.ts` and `/api/receipts`.
- [x] Receipts is framework-neutral and removed from the Express dispatcher.
- [x] Converted field definitions to a framework-neutral service and explicit Next Route Handlers.
- [x] Converted master data to a framework-neutral service and explicit Next Route Handlers.
- [x] Converted companies to a framework-neutral service and explicit Next Route Handlers.
- [x] Converted users to a framework-neutral service and explicit Next Route Handlers.
- [x] Converted delegations to a framework-neutral service and explicit Next Route Handlers.
- [x] Converted support to a framework-neutral service and explicit Next Route Handlers.
- [x] Converted review meetings to a framework-neutral service and explicit Next Route Handlers.
- [x] Converted activity to a framework-neutral service and explicit Next Route Handlers.
- [x] Converted analytics to a framework-neutral service and explicit Next Route Handler.
- [x] Converted MOMs to a framework-neutral service and explicit Next Route Handlers.
- [x] Relocated field-definitions and master-data routers to `src/services/admin/`.
- [x] Relocated users and delegations routers to `src/services/users/`.
- [x] Relocated companies router to `src/services/admin/`.
- [x] Relocated support, review-meetings, and activity routers to `src/services/`.

## Pending verification

- [x] Verified the master-data relocation: lint and 114 Vitest tests pass.
- [x] Verified the users conversion: lint and 114 Vitest tests pass.
- [x] Verified the delegations conversion: lint and 114 Vitest tests pass.
- [x] Verified the support conversion: lint and 114 Vitest tests pass.
- [x] Verified the review-meetings conversion: lint and 114 Vitest tests pass.
- [x] Verified the activity conversion: lint and 114 Vitest tests pass.
- [x] Verified the analytics conversion: lint and 114 Vitest tests pass.

## Phase 1: router relocation

- [x] Relocate MOMs business logic into `src/services/moms/` and remove MOMs from the compatibility dispatcher.
- [x] Relocate Cash Advances business logic into `src/services/cash-advances/` and remove Cash Advances from the compatibility dispatcher.
- [x] Relocate Liquidations business logic into `src/services/liquidations/` and remove Liquidations from the compatibility dispatcher.
- [x] Relocate Auth business logic into `src/services/auth/` and remove Auth from the compatibility dispatcher.
- [x] Relocate Admin business logic into `src/services/admin/` and remove Admin from the compatibility dispatcher.
- [ ] Convert the remaining relocated routers into framework-neutral services plus explicit Route Handlers.

## Phase 2: explicit MVC controller conversion

- [x] Convert receipts into a service and explicit `/api/receipts` Route Handler.
- [x] Convert field definitions: GET, POST, and PUT `/api/field-definitions` endpoints.
- [x] Convert users, companies, and delegations.
- [x] Convert support, review meetings, and activity.
- [x] Convert MOMs: list, detail, create, update, and send endpoints.
- [x] Convert analytics to an explicit Route Handler and remove its compatibility dispatcher route.
- [ ] Convert Liquidations.
- [x] Convert Liquidations: list, detail, create, line items, submit, review, and refund collection endpoints.
- [x] Convert Cash Advances: list, detail, create, update, submit, approve/reject, and release endpoints.
- [ ] Convert auth, admin, and claims as isolated high-risk batches.
- [x] Convert Auth as an isolated high-risk batch with demo and Microsoft/OIDC boundaries preserved.
- [x] Convert Admin as an isolated high-risk batch, including non-destructive in-memory demo reset behavior.

## Phase 3: compatibility cleanup

- [x] Remove the legacy analytics Express route and compatibility dispatcher branch.
- [ ] Remove the Liquidations compatibility dispatcher route.
- [x] Remove the Liquidations compatibility dispatcher route.
- [ ] Remove Express router barrels and the catch-all dispatcher.
- [ ] Remove unused Express dependencies and `src/server/` compatibility code.

## Phase 4: release verification

- [ ] Add Playwright configuration and browser coverage.
- [ ] Run production build after all controller conversions.
- [ ] Manually verify auth, claims, uploads, `/healthz`, `/readyz`, and cron.
- [ ] Confirm Vercel environment configuration and decide whether Render remains needed.

## High-risk checks

- [ ] Demo authentication and future Entra/OIDC boundaries.
- [ ] Signed storage upload/download authorization.
- [ ] Persistence readiness and a safe stored-row check.
- [ ] Cron authorization and hourly maintenance.
- [ ] Vercel environment settings and Render retirement decision.
