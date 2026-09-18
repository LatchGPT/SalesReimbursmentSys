# Sales Reimbursement System

A role-based reimbursement application for requests, approvals, cash advances, liquidations, meetings, release processing, receipts, and support. It currently uses demo identity and is not yet safe for real employee or financial use; see `docs/project-handoff/PRODUCTION-PUNCHLIST.md`.

## Architecture

This repository is an npm-workspace monorepo with two deployables:

```text
Vercel
  frontend/  Next.js 16 + React 19
      |
      | HTTPS, NEXT_PUBLIC_API_BASE_URL
      v
Render
  backend/   Express 4 API and scheduled jobs
      |
      | Prisma 7, DATABASE_URL
      v
Supabase PostgreSQL
```

- `frontend/src/app/` is the Next.js App Router shell.
- `frontend/src/screens/` contains route-level screens; shared UI is under `frontend/src/components/`.
- `frontend/src/lib/api/` is the browser-to-API adapter.
- `backend/src/server/routes/` contains API handlers and `backend/src/server/services/` contains backend business logic.
- `backend/src/db/` contains the repositories being migrated into feature services. `src/lib/prisma.ts` owns the only Prisma client and PostgreSQL pool.
- `prisma/schema.prisma` is the checked-in representation of the live Supabase schema.
- `prisma/migrations/` contains Prisma migration history. The production database was baselined without recreating its existing tables.
- `test/` contains integration and regression tests. Frontend unit tests are colocated with their modules.
- `docs/` contains business and handoff documentation.

The frontend never connects to PostgreSQL. It calls the Render API, and Render is the only deployed service that uses database credentials.

## Local development

Requirements: Node.js 20 or newer, npm, and PostgreSQL client tools only when making or validating backups.

```bash
npm ci
copy .env.example .env
npm run dev
```

The frontend runs at `http://localhost:3001`; the API runs at `http://localhost:3000`. For a fully local pair, set `NEXT_PUBLIC_API_BASE_URL=http://localhost:3000` and include `http://localhost:3001` in `ALLOWED_ORIGINS`.

Useful commands:

```bash
npm run lint
npm test
npm run build
npm run dev:frontend
npm run dev:backend
npm run db:generate
npm run db:status
npm run db:migrate
npm run db:studio
```

`npm run db:migrate` targets the live database configured by `DIRECT_URL`. It is never a routine local command: obtain explicit approval, confirm a backup/PITR, and review the SQL first.

## Database and demo-mode behavior

Supabase contains live data and is the schema source of truth. Prisma replaced the previous ORM after introspecting the database. Production was recorded as the baseline migration `20260918000000_baseline`; the baseline did not recreate, drop, or rewrite application tables.

Runtime database access uses a Supabase session-pooler URL in `DATABASE_URL`. Prisma CLI operations use `DIRECT_URL`, the direct TLS connection. This keeps application connections pool-friendly while migration locks and introspection use the direct endpoint.

Persistence still has two operating modes:

- `DEMO_MODE=true`: the server generates presentation data in memory on startup. Mutations can be written through to PostgreSQL, but the next demo boot presents a newly generated dataset.
- `DEMO_MODE=false`: the server loads persisted state from PostgreSQL and never invokes the demo generator.

The demo login uses an untrusted `X-User-Id` request header. Do not treat it as authentication. Microsoft Entra configuration is scaffolded but incomplete.

`GET /readyz` checks database reachability and reports recent write-through failures. A successful mutation response alone is not proof that a record persisted; for production-sensitive work, inspect `/readyz` and verify the row.

## Environment variables

Use `.env.example` as the authoritative inventory. Secrets belong only in the ignored root `.env` locally and in deployment dashboards.

### Vercel only

| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_API_BASE_URL` | Public HTTPS origin of the Render API, with no trailing slash |
| `NEXT_PUBLIC_ENABLE_DEMO_LOGIN` | Exposes the demo account picker when `true` |

### Render only

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Supabase session-pooler connection used by the running API |
| `DIRECT_URL` | Direct Supabase connection used only for deliberate Prisma CLI steps |
| `ALLOWED_ORIGINS` | Comma-separated Vercel/local browser origins accepted by CORS |
| `DEMO_MODE`, `AUTH_MODE`, `ENABLE_DEMO_LOGIN`, `AUTO_SEED` | Demo/runtime behavior |
| `SESSION_SECRET` | Server-only session secret |
| `MICROSOFT_*`, `GRAPH_SCOPES` | Future Microsoft Entra integration |
| `UPLOAD_DIR` | Optional persistent upload directory |
| `PORT` | Supplied by Render automatically; defaults to 3000 locally |

Never place database, session, or Microsoft client secrets in a `NEXT_PUBLIC_*` variable.

## Deployment

### Vercel frontend

Import the repository as a Next.js project. The checked-in `vercel.json` builds the `frontend` workspace and uses `frontend/.next`. Set `NEXT_PUBLIC_API_BASE_URL=https://salesreimbursmentsystem.onrender.com` and the demo-login flag in the Vercel dashboard. No database variables belong in Vercel.

### Render API

Create or sync the Blueprint from root `render.yaml`. It builds and starts only the `backend` workspace and checks `/readyz`. Add the secret values marked `sync: false`, especially `DATABASE_URL` and `DIRECT_URL`, in Render. `ALLOWED_ORIGINS` is set to `https://sales-reimbursment-system.vercel.app`.

Schema migrations are intentionally not part of application startup or the Vercel build. After backup and SQL review, run them as a separately approved Render pre-deploy/CI action or manually with `npm run db:migrate`.

Uploads stored on Render's ephemeral filesystem will not survive replacement. Configure a persistent disk and `UPLOAD_DIR`, or migrate uploads to object storage before production use.

## Safety and verification

Never run reset, force-push, destructive SQL, table/column drops, or migration-history rewrites against Supabase without explicit confirmation. Do not edit the applied baseline.

Minimum verification for application changes:

```bash
npm run lint
npm test
npm run build
```

Database changes additionally require backup/PITR confirmation, generated-SQL review, migration-status verification, `/readyz`, and an end-to-end check of the affected workflow.

## Documentation

- `AGENTS.md`: mandatory engineering workflow and guardrails.
- `docs/BRD.md`: product requirements.
- `docs/project-handoff/00-START-HERE.md`: handoff index.
- `docs/project-handoff/PRODUCTION-PUNCHLIST.md`: current production blockers.
- `docs/project-handoff/MICROSOFT-AUTH-HANDOFF.md`: remaining identity work.
- `docs/archive/`: historical context only; never use it as architecture source of truth.
