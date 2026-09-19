# Unified Next.js migration handoff

Last updated: 2026-09-19  
Current checkpoint: Phase 6 local deployment-readiness review complete; safe deployed-environment verification is pending.

This document is the continuation point for moving the work to another computer or coding-agent session. Read `AGENTS.md` and `README.md` before making changes.

## Transfer this work safely

The migration currently includes modified and untracked files. A fresh clone will **not** contain the work unless all intended changes are committed and pushed, or the complete working tree is transferred as an archive. Include untracked files such as root `prisma/`, root `src/`, new Route Handlers, feature folders, tests, and the migration documents.

On the new computer:

1. Check out the branch or extract the complete working tree.
2. Run `git status --short` and confirm the migration files are present.
3. Run `npm ci` from the repository root.
4. Supply a local ignored `.env`; never copy production secrets into source control.
5. Run the verification commands in this document before continuing.

Do not run a Prisma migration, `prisma db push`, reset, destructive SQL, or any production data operation as part of setup.

## Fixed migration decisions

- The final deployable is one Next.js App Router application on Vercel.
- Prisma remains at repository root in `prisma/`.
- Supabase PostgreSQL is accessed through its transaction-mode PgBouncer pooler; Prisma Accelerate is not used.
- Production uses `DEMO_MODE=false` and must never seed demo data during startup or a request.
- Backend HTTP behavior uses Next.js Route Handlers and preserves existing request/response contracts.
- Temporary `X-User-Id` compatibility remains until the replacement identity flow is verified.
- Uploads use a private Supabase Storage bucket named `uploads`.
- Old `/uploads/:filename` URLs remain available through an authorized compatibility Route Handler.
- The browser uses signed direct-to-Supabase uploads to avoid Vercel request-body limits.
- Hourly maintenance uses Vercel Cron.
- Rate limiting uses Upstash Redis.
- Existing tests move and adapt with the code they cover.
- Render is retired only after the Vercel deployment is verified.
- No production schema or data change is authorized by this migration.

## Completed checkpoints

### Phase 0 — Discovery and plan

- Inventoried the frontend, backend, Prisma layout, environment files, build tooling, tests, and deployment configuration.
- Recorded the approved target and decisions in this handoff's “Fixed migration decisions” section.

### Phase 1 — Prisma migration

- Moved `backend/prisma/schema.prisma` to `prisma/schema.prisma`.
- Moved the applied baseline migration to `prisma/migrations/20260918000000_baseline/migration.sql` without changing its content.
- Added `config/prisma.config.ts`.
- Added the sole Prisma client factory at `src/lib/prisma.ts`, using a development `globalThis` cache and a production module singleton.
- Configured Prisma for `native` and `rhel-openssl-3.0.x` binary targets.
- Added root `postinstall` Prisma generation.
- Kept `backend/src/db/index.ts` as a temporary compatibility re-export.

Never edit the applied `20260918000000_baseline` migration.

### Phase 2 — Next.js backend boundary

- Added the catch-all API Route Handler at `frontend/src/app/api/[[...path]]/route.ts`.
- Added the Web Request/Response compatibility dispatcher at `backend/src/server/http/routeHandlerAdapter.ts` so existing endpoint contracts remain stable during migration.
- Added per-request database state hydration for `DEMO_MODE=false` in `backend/src/server/stateLoader.ts`.
- Added health routes: `/api/health`, `/healthz`, and `/readyz`.
- Added Supabase Storage upload handlers, signed upload support, and `/uploads/[filename]` compatibility.
- Added hourly cron route `/api/cron/hourly` and its Vercel schedule.
- Added Upstash REST rate limiting.
- Added `AsyncLocalStorage` persistence tracking so formerly fire-and-forget writes are awaited by serverless requests.
- Adapted integration tests to invoke Route Handlers without starting Express.

### Phase 3 — Feature-based layering

- Moved route-level UI screens from `frontend/src/screens/` into domain folders under `frontend/src/features/*/screens/`.
- Added public screen entry points and changed route imports to use feature boundaries.
- Moved browser API implementations into feature-owned service folders for claims, MOMs, admin, cash advances, and liquidations.
- Kept temporary re-exports in `frontend/src/lib/api/` for compatibility.
- Added feature-owned type and validation surfaces where currently applicable.
- Changed feature-owned component imports to use local modules or public feature APIs instead of shared compatibility wrappers.
- Added server feature registration boundaries under root `src/features/*/server/`.
- Kept the existing React Router behavior behind the thin App Router catch-all page. Removing that compatibility layer requires a separate reviewed change.

At the Phase 3 checkpoint, the only file left under the old `frontend/src/screens/` tree was `shared/PlaceholderPage.tsx`; it was subsequently approved and removed in Phase 4.

### Phase 4 — Approved cleanup

- Inventoried the legacy Express/Render path, React Router shell, compatibility API and component surfaces, environment variables, documentation, and generated output before deleting anything.
- Removed the approved unused `frontend/src/screens/shared/PlaceholderPage.tsx` file.
- Removed twelve approved zero-consumer component forwarding files under `frontend/src/components/shared/`; their feature-owned implementations remain in place.
- Removed the unused Pino logging middleware, its three package dependencies, and the associated `LOG_LEVEL` configuration and test setup.
- Retained the persistent Express startup, backend workspace, Express domain routers, `render.yaml`, React Router compatibility shell, API facades, and active library forwarding files because they remain live or have verified consumers.
- No production schema, data, migration, repository query, or deployment action was performed.

### Phase 5 — Root package and environment consolidation

- Promoted the Next.js source tree, public assets, Next/PostCSS configuration, and generated type entry point from `frontend/` to the repository root.
- Merged feature server registrations and the Prisma singleton into the unified root `src/` tree without changing backend contracts.
- Made the root package the Next.js/Vercel application, retained only `backend` as a temporary workspace, and added explicit legacy Render commands.
- Changed browser API calls to same-origin URLs and removed the obsolete public Render API base variable.
- Added validated public and server environment access under `src/config/` and routed application environment reads through it.
- Made Prisma generation independent of `DIRECT_URL`; migration and introspection commands still require the administrative URL.
- Updated Vercel output ownership to root `.next`, refreshed current architecture and cutover documentation, and preserved the Render rollback path.
- No production schema, data, migration, or deployment action was performed.

## Last successful verification

Run from the repository root:

```powershell
npm.cmd run lint
npm.cmd test
npm.cmd run build
npm.cmd run build:legacy-backend
npx.cmd prisma validate --config config/prisma.config.ts
git diff --check
```

Results at the Phase 6 local-readiness checkpoint:

- TypeScript: passed.
- Vitest: 17 files, 113 tests passed.
- Production build: passed for the Next.js frontend and temporary legacy backend build.
- Prisma schema validation: passed.
- Diff whitespace check: passed.

On restricted Windows environments, `next build` may fail during worker startup with `spawn EPERM`. This is an execution-sandbox restriction when the TypeScript/page-data worker cannot spawn; rerun the same build with the required process permission. Do not treat it as a source failure if compilation succeeds and the only error is `spawn EPERM`.

Next.js owns root `next-env.d.ts` and may update root `tsconfig.json` with mandatory or suggested compiler settings during a production build. Review generated-only churn before committing.

## Phase 6 — Deployment readiness

Phase 6 completes deployment documentation and verifies the unified Vercel application in a safe deployed environment. Keep these boundaries explicit:

- Create and review `DEPLOY.md` with Vercel settings, environment ownership, Supabase pooler guidance, health checks, cron/upload requirements, rollback, and manual workflows.
- Verify `/healthz`, `/readyz`, browser API behavior, signed uploads, cron authorization, and a stored-row workflow against a safe environment. Do not use production data without explicit approval.
- Keep `render.yaml`, `backend/server.ts`, and the persistent Express startup until the unified Vercel deployment is verified. Render retirement is a later deployment action, not an automatic source cleanup.
- Preserve `DEMO_MODE=false` production behavior and the existing demo-only mode. Do not seed during production startup or requests.
- Do not modify production schema or data. Do not edit the applied baseline migration.
- Run targeted verification after each package/configuration batch and the complete suite before handoff.

Local readiness review on 2026-09-19:

- `DEPLOY.md` documents Vercel configuration, environment ownership, Supabase pooler and Storage requirements, verification, rollback, and deferred Render retirement.
- A production-mode local server returned HTTP 200 from `/healthz` and `/api/health`.
- `/readyz` reached the configured Supabase pooler but returned HTTP 503 because PostgreSQL rejected the configured credentials with `28P01`. No query succeeded and no data changed. Correct the safe-environment `DATABASE_URL` before repeating readiness or stored-row checks.
- Browser/API, signed-upload, cron, stored-row persistence, and full workflow checks still require an approved non-production Vercel environment. Production data was not used.
- The dependency review and remediation are recorded in `docs/project-handoff/DEPENDENCY-AUDIT-2026-09-19.md`. Multer, Express/qs, Vitest, and DOMPurify advisories were cleared; the residual audit findings belong to Prisma's CLI/configuration dependency chain.

## Suggested continuation prompt

Use this after opening the repository on the new computer:

> Read `AGENTS.md`, `README.md`, `MIGRATION_HANDOFF.md`, and the dated dependency audit. Phase 6 local readiness is complete. Configure an approved non-production Vercel environment, correct its Supabase pooler credential, and finish the deployed checks in `DEPLOY.md` without touching production data. Keep Render available until the unified Vercel deployment and rollback plan are verified.
