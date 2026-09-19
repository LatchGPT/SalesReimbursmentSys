# Production cutover punch-list

Last reviewed: 2026-09-19. The application is suitable for demo/pilot use only and is not approved for real employee, client, or financial data.

## Blockers

- Replace trusted `X-User-Id` headers and the demo account picker with Microsoft Entra OIDC and server-side sessions.
- Set `DEMO_MODE=false`, `AUTH_MODE=microsoft`, `ENABLE_DEMO_LOGIN=false`, `NEXT_PUBLIC_ENABLE_DEMO_LOGIN=false`, and `AUTO_SEED=false` at real-data cutover.
- Correct and verify the Supabase session-pooler `DATABASE_URL`; the supplied pooler credential currently fails authentication. Do not substitute the direct migration URL for normal production runtime traffic.
- Verify the private Supabase Storage `uploads` bucket, signed-upload CORS, object authorization, retention, and recovery behavior in the deployed environment.
- Configure real email/Teams delivery and durable outbox behavior.
- Define and test RLS or explicitly document why all database access remains backend-service-only. Introspection found RLS disabled and no policies on all application tables.
- Complete privacy, audit-retention, financial-control, UAT, incident ownership, and restore testing.

## Deployment checklist

- Vercel imports the repository root, runs `npm run build`, and outputs `.next`.
- Vercel has the server-only runtime values listed in root `.env.example`, while only approved feature flags use `NEXT_PUBLIC_*`.
- Vercel does not receive `DIRECT_URL`; administrative migration credentials are supplied only to a deliberate migration/introspection job.
- Vercel Cron invokes `/api/cron/hourly` with `CRON_SECRET`, and Upstash rate limiting is configured.
- Render remains healthy as a rollback service through cutover, then is retired only after explicit approval.
- Migrations are a deliberate approved deploy step, never a Vercel function or automatic application-start action.
- Supabase backup/PITR and restore procedure are tested.

## Engineering readiness

- Prisma is the only ORM; production is baselined as `20260918000000_baseline`.
- The target is one root Next.js deployable with same-origin Route Handlers; the legacy Render service is temporary.
- `/readyz` exposes database reachability and persistence health.
- Minimum gate is `npm run lint`, `npm test`, `npm run build`, and `npm run build:legacy-backend` while Render remains available.
- Before go-live, manually test login, submit claim, approval, processing, release code, payout, cash advance/liquidation, receipts/uploads, support, and restart persistence with `DEMO_MODE=false`.

Do not run `npm audit fix --force`; review dependency upgrades and regression-test them deliberately.
