# Sales Reimbursement System

A role-based reimbursement application for requests, approvals, cash advances, liquidations, meetings, release processing, receipts, and support. It still uses demo identity and is not safe for real employee or financial use; see `docs/project-handoff/PRODUCTION-PUNCHLIST.md`.

## Architecture

The target deployment is one Next.js 16 application on Vercel:

```text
Browser
  |
  | same-origin HTTPS
  v
Vercel: Next.js pages + Route Handlers + hourly cron
  |
  | Prisma 7 through the Supabase transaction pooler
  v
Supabase PostgreSQL + private Storage bucket
```

The persistent Express service under `backend/` remains buildable on Render as a temporary rollback path. Do not retire it until the unified Vercel deployment and critical workflows are verified.

- `src/app/` contains App Router pages and Route Handlers.
- `src/features/` contains feature UI, browser services, types, and server registration boundaries.
- `src/components/` contains genuinely shared UI.
- `src/config/` validates public and server environment values.
- `src/lib/api/` is the same-origin browser API adapter.
- `src/lib/prisma.ts` owns the only Prisma client and PostgreSQL pool.
- `backend/src/server/` contains retained controllers and business logic used by both the Route Handler adapter and legacy Render service.
- `backend/src/db/` contains Prisma repositories.
- `prisma/` contains the live schema representation and migration history.
- `public/` contains static Next.js assets.
- `test/` contains integration and regression tests; frontend unit tests are colocated under `src/`.

UI code must never import Prisma. The current compatibility flow is `component -> src/lib/api -> Next.js Route Handler -> retained controller/service -> repository -> Prisma -> Supabase`.

## Local development

Requirements: Node.js 20 or newer, npm, and PostgreSQL client tools only when making or validating backups.

```bash
npm ci
copy .env.example .env
npm run dev
```

The unified application runs at `http://localhost:3000`. It serves both browser pages and `/api/*` from the same origin.

Useful commands:

```bash
npm run dev
npm run dev:legacy-backend
npm run lint
npm test
npm run build
npm run build:legacy-backend
npm run db:generate
npm run db:status
npm run db:migrate
npm run db:studio
```

`npm run db:migrate`, `db:status`, and `db:studio` require the administrative `DIRECT_URL`. `npm ci`, Prisma generation, normal builds, and application runtime do not. Never run a migration without explicit approval, backup/PITR confirmation, and SQL review.

## Database and demo behavior

Supabase contains live data and is the schema source of truth. `prisma/schema.prisma` is its checked-in representation. Production was recorded as baseline migration `20260918000000_baseline`; never edit that applied migration.

Runtime access uses the Supabase transaction-mode pooler in `DATABASE_URL`. Prisma CLI migration and introspection commands use the direct TLS connection in `DIRECT_URL`.

- `DEMO_MODE=true` generates presentation state in memory. Mutations may write through, but a later demo boot creates a fresh presentation dataset.
- `DEMO_MODE=false` loads persisted state from PostgreSQL and must never invoke demo seeding.

The demo login trusts an `X-User-Id` compatibility header. It is not authentication. Microsoft Entra configuration is scaffolded but incomplete.

`GET /readyz` checks database reachability and recent persistence failures. A successful mutation response alone is not proof a row persisted; production-sensitive checks must verify `/readyz` and the stored row.

## Environment variables

Use `.env.example` as the inventory. Secrets belong in the ignored root `.env` locally and in server-side deployment settings.

Browser-visible build variables:

| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_ENABLE_DEMO_LOGIN` | Exposes demo login and role deep links when `true` |
| `NEXT_PUBLIC_ENABLE_ALL_CLAIM_TYPES` | Exposes soft-launched claim types when `true` |

Unified Vercel server variables include `DATABASE_URL`, runtime/demo flags, `SUPABASE_*`, `UPSTASH_*`, `CRON_SECRET`, and future Microsoft identity settings. Never put database URLs, service-role keys, cron secrets, session secrets, Redis tokens, or Microsoft client secrets in `NEXT_PUBLIC_*` variables.

`DIRECT_URL` is administrative and should not be configured in normal Vercel runtime. Supply it only to a deliberate migration/introspection job. The retained Render service additionally uses `ALLOWED_ORIGINS` and optionally `UPLOAD_DIR` during cutover.

## Deployment

### Unified Vercel application

Import the repository root. The checked-in `vercel.json` runs `npm run build`, outputs `.next`, and invokes `/api/cron/hourly` every hour. Configure all required server variables in Vercel; the browser uses same-origin APIs and no longer needs `NEXT_PUBLIC_API_BASE_URL`.

Do not run migrations during Vercel builds, function startup, or requests.

### Temporary Render rollback service

Root `render.yaml` still builds and starts the `backend` workspace and checks `/readyz`. Keep it operational until Vercel is deployed and the browser, health, persistence, upload, authorization, and cron workflows are verified. Retirement is a separate approved deployment action.

## Safety and verification

Never run reset, force push, destructive SQL, table/column drops, truncation, or migration-history rewrites against Supabase without explicit confirmation.

Minimum application verification:

```bash
npm run lint
npm test
npm run build
npm run build:legacy-backend
npx prisma validate --config prisma.config.ts
```

Persistence changes additionally require backup/PITR confirmation, generated-SQL review, migration status, `/readyz`, and an end-to-end stored-row check.

## Documentation

- `AGENTS.md`: mandatory engineering workflow and guardrails.
- `MIGRATION_HANDOFF.md`: current unified-app migration checkpoint.
- `DEPLOY.md`: unified Vercel deployment, verification, and rollback runbook.
- `docs/BRD.md`: product requirements.
- `docs/project-handoff/00-START-HERE.md`: handoff index.
- `docs/project-handoff/PRODUCTION-PUNCHLIST.md`: current production blockers.
- `docs/project-handoff/MICROSOFT-AUTH-HANDOFF.md`: remaining identity work.
- `docs/archive/`: historical context only.
