# Next MVC Migration Tracker

## Verification gate

- [x] Run `npm run lint` after every batch.
- [x] Run `npm test` after every batch.
- [x] Stop and fix failures before another batch.
- [x] Configure Playwright and run `npx playwright test` after all batches.

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
- [x] Converted cash advances to a framework-neutral service and explicit Next Route Handlers.
- [x] Converted liquidations to a framework-neutral service and explicit Next Route Handlers.
- [x] Converted auth to a framework-neutral service and explicit Next Route Handlers.
- [x] Converted MOMs to a framework-neutral service and explicit Next Route Handlers.
- [x] Converted admin and imports to a framework-neutral service and explicit Next Route Handlers.
- [x] Converted claims to a framework-neutral service and explicit Next Route Handlers.
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
- [x] Verified the cash-advances and liquidations conversion: lint and 115 Vitest tests pass.
- [x] Verified the auth and MOMs conversion: lint and 115 Vitest tests pass.
- [x] Verified the admin and imports conversion: lint and 115 Vitest tests pass.
- [x] Verified the claims conversion: lint and 115 Vitest tests pass.
- [x] Verified release verification: lint, 118 Vitest tests, and Playwright E2E pass.

## Phase 1: router relocation

- [x] Convert the remaining relocated routers into framework-neutral services plus explicit Route Handlers.

## Phase 2: explicit MVC controller conversion

- [x] Convert receipts into a service and explicit `/api/receipts` Route Handler.
- [x] Convert field definitions: GET, POST, and PUT `/api/field-definitions` endpoints.
- [x] Convert users, companies, and delegations.
- [x] Convert support, review meetings, and activity.
- [x] Convert analytics, cash advances, and liquidations.
- [x] Convert auth, admin, and claims as isolated high-risk batches.

## Phase 3: compatibility cleanup

- [x] Convert analytics, cash advances, and liquidations.
- [x] Remove Express router barrels and the catch-all dispatcher.
- [x] Remove unused Express dependencies and `src/server/` compatibility code.

## Phase 4: release verification

- [x] Add Playwright configuration and browser coverage.
- [x] Run production build after all controller conversions.
- [x] Manually verify auth, claims, uploads, `/healthz`, `/readyz`, and cron.
- [x] Confirm Vercel environment configuration and decide whether Render remains needed.

## High-risk checks

- [x] Demo authentication and future Entra/OIDC boundaries.
- [x] Signed storage upload/download authorization.
- [x] Persistence readiness and a safe stored-row check.
- [x] Cron authorization and hourly maintenance.
- [x] Vercel environment settings and Render retirement decision.
