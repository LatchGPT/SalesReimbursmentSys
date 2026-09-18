# Unified Next.js migration handoff

Last updated: 2026-09-18  
Current checkpoint: Phase 3 complete; Phase 4 has not started.

This document is the continuation point for moving the work to another computer or coding-agent session. Read `AGENTS.md`, `README.md`, and `MIGRATION_PLAN.md` before making changes.

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
- Recorded the approved target and decisions in `MIGRATION_PLAN.md`.

### Phase 1 — Prisma migration

- Moved `backend/prisma/schema.prisma` to `prisma/schema.prisma`.
- Moved the applied baseline migration to `prisma/migrations/20260918000000_baseline/migration.sql` without changing its content.
- Added root `prisma.config.ts`.
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

The only file left under the old `frontend/src/screens/` tree is the apparently unused `shared/PlaceholderPage.tsx`. Do not delete it until it appears in the Phase 4 approval list and deletion is explicitly approved.

## Last successful verification

Run from the repository root:

```powershell
npm.cmd run lint
npm.cmd test
npm.cmd run build
npx.cmd prisma validate --config prisma.config.ts
git diff --check
```

Results at the Phase 3 checkpoint:

- TypeScript: passed.
- Vitest: 17 files, 113 tests passed.
- Production build: passed for the Next.js frontend and temporary legacy backend build.
- Prisma schema validation: passed.
- Diff whitespace check: passed.

On restricted Windows environments, `next build` may fail during worker startup with `spawn EPERM`. This is an execution-sandbox restriction when the TypeScript/page-data worker cannot spawn; rerun the same build with the required process permission. Do not treat it as a source failure if compilation succeeds and the only error is `spawn EPERM`.

Next.js may rewrite `frontend/next-env.d.ts` during a production build. Review that generated-only diff and avoid committing incidental path churn unless required by the checked-in project convention.

## Next checkpoint — Phase 4 cleanup inventory

Phase 4 is an **inventory and approval checkpoint first**. Do not delete or move anything during its discovery step.

### Required procedure

1. Read `AGENTS.md`, `README.md`, `MIGRATION_PLAN.md`, and this handoff.
2. Run `git status --short`; preserve all existing user and migration changes.
3. Use `rg --files` and targeted reads to locate obsolete or duplicated files.
4. Trace every candidate with `rg` before classifying it as redundant.
5. Produce a concise table containing:
   - exact path;
   - why it appears redundant;
   - replacement path or mechanism;
   - references that still block removal;
   - proposed action: delete, retain temporarily, or merge later;
   - risk and rollback note.
6. Stop and ask for explicit approval. Do not delete files in the same turn that creates the inventory.
7. After approval, remove only the approved paths, repair references, and run the complete verification suite.

### Items to investigate, not pre-approved deletions

- `backend/server.ts` and the persistent Express startup path.
- Express-only middleware and packages after confirming the Route Handler adapter no longer depends on them.
- `backend/package.json` and the backend workspace.
- `render.yaml` and Render-specific documentation or scripts.
- Duplicate root/frontend/backend package scripts and build configuration.
- The React Router compatibility shell: `frontend/src/App.tsx`, `frontend/src/routes/`, and `react-router-dom`.
- Compatibility re-exports in `frontend/src/lib/api/` and shared component wrappers.
- The remaining `frontend/src/screens/shared/PlaceholderPage.tsx`.
- Old environment files or variables that target Render or a separate frontend API origin.
- CI or documentation references to `backend/`, Render, port 3000/3001, or `NEXT_PUBLIC_API_BASE_URL`.
- Generated output such as `backend/dist/` or `frontend/.next/`; distinguish ignored generated files from tracked source.

Do not classify the following as cleanup candidates:

- `prisma/schema.prisma`;
- anything under `prisma/migrations/`;
- seed or baseline data assets;
- `src/lib/prisma.ts`;
- Route Handlers, storage compatibility, cron, health, or Upstash logic;
- tests that verify retained API contracts;
- any file still required by the current passing build.

### Important Phase 4 boundary

The current Route Handler compatibility dispatcher still imports feature server registrations that re-export existing backend routers. Therefore, the old backend route implementations and their Express types are **not automatically removable**. Trace and decouple these dependencies before proposing their deletion.

Phase 4 should end with either:

- an approval request listing exact deletion/merge targets, or
- after a later explicit approval, a verified cleanup diff and a request to begin Phase 5.

## Later phases

- Phase 5 consolidates package/configuration/environment ownership into the single Vercel application. It must add validated environment access and must never expose database, Supabase service-role, cron, Upstash, or identity secrets through `NEXT_PUBLIC_*` variables.
- Phase 6 performs final deployment-readiness verification and creates `DEPLOY.md`, including Vercel settings, required environment variables, the build command, Supabase transaction-pooler guidance, health checks, and manual browser workflows.

## Suggested continuation prompt

Use this after opening the repository on the new computer:

> Read `AGENTS.md`, `README.md`, `MIGRATION_PLAN.md`, and `MIGRATION_HANDOFF.md`. Phases 0–3 are complete. Verify the current checkpoint, then perform Phase 4 discovery only: identify redundant files and produce an exact approval list with references, replacements, risks, and rollback notes. Do not delete, move, migrate, deploy, or modify production data. Stop after showing the cleanup proposal.
