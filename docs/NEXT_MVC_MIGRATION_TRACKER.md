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
- [x] Relocated field-definitions and master-data routers to `src/services/admin/`.
- [x] Relocated users and delegations routers to `src/services/users/`.
- [x] Relocated companies router to `src/services/admin/`.
- [x] Relocated support, review-meetings, and activity routers to `src/services/`.

## Pending verification

- [x] Verified the master-data relocation: lint and 114 Vitest tests pass.

## Phase 1: router relocation

- [ ] Convert the remaining relocated routers into framework-neutral services plus explicit Route Handlers.

## Phase 2: explicit MVC controller conversion

- [x] Convert receipts into a service and explicit `/api/receipts` Route Handler.
- [ ] Convert field definitions: GET, POST, and PUT `/api/field-definitions` endpoints.
- [ ] Convert users, companies, and delegations.
- [ ] Convert support, review meetings, and activity.
- [ ] Convert analytics, cash advances, and liquidations.
- [ ] Convert auth, admin, and claims as isolated high-risk batches.

## Phase 3: compatibility cleanup

- [ ] Convert analytics, cash advances, and liquidations.
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
