# Run and deploy

Verified against repository files on 2026-09-29. Deployment state outside this repository is unverified.

## Local setup

Use Node.js 20 or newer. Run `npm ci`, copy `.env.example` to a local `.env`, then run `npm run dev`. The Next.js application serves pages and `/api/*` at `http://localhost:3000`. Run `npm run lint`, `npm test`, `npx playwright test`, and `npm run build` for release checks. These commands exist in `package.json`; browser tests need their configured browser dependencies.

`.env.example` lists public feature flags and server settings. Keep `DATABASE_URL`, `DIRECT_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `UPSTASH_REDIS_REST_TOKEN`, `CRON_SECRET`, and identity secrets server-side. `NEXT_PUBLIC_*` values enter browser bundles. `DEMO_MODE=true`, `AUTH_MODE=demo`, and demo login flags are for demonstrations only. Set `DEMO_MODE=false` only after identity, storage, persistence, and operational checks are complete.

## Database

`DATABASE_URL` is the runtime PostgreSQL connection. For serverless use, configure the Supabase transaction pooler with TLS. `DIRECT_URL` is for deliberate Prisma administration through `config/prisma.config.ts`. The repository has an applied baseline migration and a later workflow-index migration. Never edit an applied migration or run a destructive schema command against live Supabase without current-session approval.

For an approved schema change, confirm a recoverable backup or PITR, review generated SQL, then run `npm run db:migrate` in an administrative environment. Check `npm run db:status`, `/readyz`, tests, and persistence afterward. Current remote migration status and backups are unverified.

## Docker

`npm run docker:dev` uses `docker-compose.dev.yml` and `Dockerfile.dev` for hot reload. `npm run docker:prod` uses `docker-compose.yml` and the production `Dockerfile`. Both Compose files define a local PostgreSQL 16 service and expose the app on port 3000. Both start commands apply Prisma migrations automatically **only when** `DATABASE_URL` contains `@db:`. This condition is intended for the local container. Verify the resolved Compose environment before starting containers.

The production Compose file persists PostgreSQL in `pgdata` and local uploads in `uploads_data`; development uses `pgdata_dev`. `npm run docker:down` stops containers. `npm run docker:clean` removes volumes and data; do not use it on data you need. `.env.docker` can override `.env` inside Compose. Do not point shared developer environments at live production data.

## Deployment checks

`vercel.json` configures Next.js install, build, and `.next` output. The hourly cron schedule claimed in older docs is absent from this file; configure and verify scheduling separately. The route `/api/cron/hourly` exists. Use `/healthz` for process health and `/readyz` for database readiness.

Before real-data cutover, verify authorization by role, claim and payout flows, cash advance and liquidation, upload signing and private object access, signed cron requests, rate limiting, and stored-row persistence after restart. Record deployment URL, environment, tester, time, and failures. Verify the private Supabase `uploads` bucket and CORS in the deployed environment. The repository cannot prove bucket, Vercel, or rollback-service state.

Older runbooks require keeping Render during Vercel cutover. `backend/`, `render.yaml`, and Express dependencies no longer exist, so that rollback instruction is obsolete. Establish a current rollback plan before changing production traffic.
