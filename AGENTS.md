# AGENTS.md

Project-specific operating guide for humans and coding agents. Read this file and `README.md` before non-trivial changes. The database contains live production data.

Last verified: 2026-09-18.

## 1. Prompt

Every task should state which deployable it affects:

- `frontend/`: Next.js 16 application deployed to Vercel.
- `backend/`: Express API deployed as a persistent Render web service.
- `docs/` or root infrastructure: shared documentation and deployment configuration.
- Database: Supabase PostgreSQL accessed through Prisma.

For database work, name the affected model in `prisma/schema.prisma`, the repository in `backend/src/db/`, and the API route or service that consumes it. State whether the work changes schema, data, or application queries. Do not infer permission to change the production schema from permission to edit application code.

For deployment work, state whether the change affects Vercel, Render, Supabase, or more than one target. Never copy backend secrets into a `NEXT_PUBLIC_*` variable.

## 2. Context

Supabase is the live schema and data source of truth. `prisma/schema.prisma` is its checked-in Prisma representation. The previous ORM schema and migration files are gone; never reconstruct schema from archived documentation. Prisma migrations live in `prisma/migrations/`. The existing database was baselined as `20260918000000_baseline`; do not edit that applied migration.

Directory responsibilities:

```text
frontend/
  src/app/                 Next.js App Router shell
  src/screens/             route-level UI screens
  src/components/          shared and presentational UI
  src/lib/                 browser-safe API adapter and UI utilities
backend/
  src/server/routes/       HTTP handlers
  src/server/services/     backend business logic
  src/db/                  Prisma repositories and the sole client singleton
  prisma/                  schema and migrations
docs/                      product, handoff, and operational documentation
test/                      cross-service and backend integration tests
render.yaml                Render service definition
vercel.json                Vercel Next.js build definition
```

Data flow is `screen/component -> frontend/src/lib/api -> Render route -> backend service/repository -> Prisma -> Supabase`. UI code must never import Prisma. `src/lib/prisma.ts` is the only place allowed to construct a Prisma client or PostgreSQL pool.

Read these before changing related areas:

- DB query/schema: `prisma/schema.prisma`, `src/lib/prisma.ts`, and the affected `*Repo.ts`.
- API behavior: the affected file in `backend/src/server/routes/`, its service, and `frontend/src/lib/api/`.
- Persistence semantics: the “Database and demo-mode behavior” section in `README.md`.
- Deployment: `render.yaml`, `vercel.json`, `.env.example`, and the “Deployment” section in `README.md`.
- Production readiness: `docs/project-handoff/PRODUCTION-PUNCHLIST.md`.

The app still has demo-only identity and an in-memory presentation mode. `DEMO_MODE=true` regenerates demonstration state on boot while writes may also persist. `DEMO_MODE=false` loads database state and must never invoke demo seeding. Do not remove demo accounts or seed behavior unless explicitly requested.

## 3. Harness

Run commands from the repository root unless noted:

```bash
npm ci                         # install both npm workspaces
npm run dev                    # Next.js :3001 + Express :3000
npm run dev:frontend           # Next.js only
npm run dev:backend            # Express only
npm run lint                   # strict TypeScript check
npm test                       # Vitest suite
npm run build                  # production builds for both deployables
npm run db:generate            # generate Prisma Client
npm run db:status              # inspect migration state via DIRECT_URL
npm run db:migrate             # deploy pending migrations; confirmation required
npm run db:studio              # Prisma Studio; treat production data as live
```

Environment boundaries:

- Vercel receives only `NEXT_PUBLIC_API_BASE_URL` and `NEXT_PUBLIC_ENABLE_DEMO_LOGIN` from this project.
- Render receives `DATABASE_URL`, `ALLOWED_ORIGINS`, runtime flags, identity secrets, and optionally `UPLOAD_DIR`.
- `DIRECT_URL` is an administrative migration/introspection credential. Keep it out of browser code. On Render it is only for an explicit migration step, never the running app.
- Runtime `DATABASE_URL` should use Supabase’s IPv4 session pooler. `DIRECT_URL` should use the direct database host with TLS.
- Local secrets belong in ignored `.env`; `.env.example` contains placeholders only.

Guardrails:

- The Supabase project has real data. Never run `prisma migrate reset`, a force reset/push, table/column drops, truncation, destructive SQL, or migration-history rewrites without explicit human confirmation in the current session.
- Before an approved schema change, confirm a current backup or PITR, review generated SQL, and report destructive statements before execution.
- Never edit an already-applied migration. Add a new reviewed migration.
- Never instantiate a second `PrismaClient` or `pg.Pool`; use `src/lib/prisma.ts`.
- Do not run migrations from Vercel functions or normal application startup. Use a deliberate deploy/CI step after approval.
- Preserve function signatures during repository changes when practical. Type-check and test after each small batch.
- Render is the API and scheduled-job host. Vercel is the frontend only.

## 4. Loop

Use this workflow:

1. Discover with `rg`, `rg --files`, and targeted file reads. Confirm which deployable and data path are affected.
2. Propose the smallest safe batch. Ask before any production schema/data or material deployment action.
3. Implement a few related files at a time. Preserve live data and existing demo behavior.
4. Verify the batch with targeted tests, then review `git diff` instead of rereading whole files.
5. Before handoff, run `npm run lint`, `npm test`, and `npm run build`. For persistence changes, also verify `/readyz` and the actual stored row against a safe environment or approved production check.
6. Report what changed, commands run, dashboard configuration still required, and any workflow that still needs manual browser testing.

Token and context discipline:

- Locate code with `rg`/`find`; do not read entire directories.
- Read only files being changed and their direct dependents.
- Summarize changes; do not paste large files into chat.
- Keep planning notes as a short checklist.
- Prefer small verified batches and `git diff` review over a large rewrite or full-file rereads.
