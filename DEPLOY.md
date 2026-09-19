# Unified Vercel deployment runbook

This runbook prepares and verifies the unified Next.js application. It does not authorize production deployment, database migration, production data access, or Render retirement.

## 1. Preconditions

- Use Node.js 20 or newer.
- Confirm Supabase backup/PITR and restore ownership before any approved schema change.
- Keep the existing Render service healthy as the rollback target throughout initial Vercel verification.
- Do not edit `prisma/migrations/20260918000000_baseline/migration.sql`.
- Do not supply `DIRECT_URL` to the normal Vercel runtime or browser.

Local release gate:

```bash
npm ci
npm run lint
npm test
npm run build
npm run build:legacy-backend
npx prisma validate --config prisma.config.ts
```

## 2. Vercel project settings

Import the repository root with these settings:

| Setting | Value |
|---|---|
| Framework | Next.js |
| Root directory | Repository root |
| Install command | `npm ci --include=dev` |
| Build command | `npm run build` |
| Output directory | `.next` |
| Node.js | 20 or newer |

Root `vercel.json` also schedules `GET /api/cron/hourly` at `0 * * * *`.

## 3. Environment ownership

Public values are inlined into browser JavaScript at build time:

| Variable | Production expectation |
|---|---|
| `NEXT_PUBLIC_ENABLE_DEMO_LOGIN` | `false` before real-data use |
| `NEXT_PUBLIC_ENABLE_ALL_CLAIM_TYPES` | Product-approved value |

Server-only Vercel runtime values:

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Supabase transaction-pooler URI with TLS |
| `DATABASE_POOL_MAX` | Per-function Prisma/pg pool size; default `1` |
| `DEMO_MODE` | `false` before real-data use |
| `AUTH_MODE` | `microsoft` only after the OIDC/session adapter is complete |
| `ENABLE_DEMO_LOGIN` | `false` before real-data use |
| `AUTO_SEED` | `false` before real-data use |
| `ENABLE_ALL_CLAIM_TYPES` | Server-side claim-type gate |
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only Storage credential |
| `SUPABASE_STORAGE_BUCKET` | Private bucket name, normally `uploads` |
| `UPSTASH_REDIS_REST_URL` | Server-only Upstash REST endpoint |
| `UPSTASH_REDIS_REST_TOKEN` | Server-only Upstash token |
| `CRON_SECRET` | Vercel Cron bearer secret |
| `MICROSOFT_*`, `SESSION_SECRET`, `GRAPH_SCOPES` | Future identity/session integration |

Never use a `NEXT_PUBLIC_*` name for database URLs, Supabase service-role keys, Redis tokens, cron secrets, session secrets, or Microsoft client secrets.

`DIRECT_URL` is an administrative credential for deliberate Prisma status, migration, studio, backup, or introspection work. Prisma generation and application builds work without it. Supply it only to the approved administrative environment performing that operation.

## 4. Supabase runtime requirements

- Use the transaction-mode pooler for `DATABASE_URL`; do not use the direct database host for serverless runtime traffic.
- Require TLS in the connection string.
- Keep `DATABASE_POOL_MAX=1` unless load testing supports another value.
- Create a private Storage bucket named `uploads`.
- Configure bucket CORS for the deployed Vercel origin and verify signed `PUT` uploads.
- Keep the service-role key server-only. Browser uploads must use the signed-upload endpoint.

No migration runs during `npm ci`, `next build`, function startup, or a request. For an approved migration: confirm backup/PITR, review generated SQL, report destructive statements, then run `npm run db:migrate` with `DIRECT_URL` in the administrative environment.

## 5. Deployment verification

Run these checks against the candidate Vercel deployment before changing traffic or retiring Render:

1. `GET /healthz` returns HTTP 200 and `{ "status": "ok" }`.
2. `GET /readyz` returns HTTP 200 and reports healthy database/persistence state.
3. `/api/health` preserves its compatibility response.
4. The browser loads without cross-origin configuration and calls same-origin `/api/*` URLs.
5. Unauthorized and role-restricted API requests are rejected as expected.
6. Upstash rate limiting responds correctly without exposing tokens.
7. Vercel Cron sends the expected bearer credential; missing or incorrect credentials return 503/401.
8. A permitted file receives a signed upload URL, uploads directly to Supabase, and is downloadable only by an authorized user.
9. With `DEMO_MODE=false`, create a disposable test record in an approved non-production environment, verify the stored row directly, restart/redeploy, and verify it remains available.
10. Exercise login, claim submission, approval, custodian processing, release code, payout, cash advance/liquidation, receipt confirmation, review meetings, support, notifications, and admin reporting.

Record the deployment URL, timestamp, tester, environment, test record identifiers, `/readyz` response, and any deviations. Do not perform the stored-row check against production without explicit approval.

## 6. Rollback and Render retirement

If a critical verification fails:

1. Keep or restore browser traffic to the existing Render-backed release.
2. Preserve the failing Vercel deployment and logs for diagnosis.
3. Do not reset, truncate, or rewrite database state as a rollback mechanism.
4. Confirm `/readyz` on the rollback service and recheck the affected stored row.

Render retirement requires a separate explicit approval after all checks pass. Only then remove `render.yaml`, `backend/server.ts`, persistent Express-only middleware/packages, and the backend workspace scripts in a reviewed cleanup change.
