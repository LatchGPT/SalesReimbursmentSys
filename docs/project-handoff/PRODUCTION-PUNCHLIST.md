# Production cutover punch-list

Last reviewed: 2026-09-18. The application is suitable for demo/pilot use only and is not approved for real employee, client, or financial data.

## Blockers

- Replace trusted `X-User-Id` headers and the demo account picker with Microsoft Entra OIDC and server-side sessions.
- Set `DEMO_MODE=false`, `AUTH_MODE=microsoft`, `ENABLE_DEMO_LOGIN=false`, `NEXT_PUBLIC_ENABLE_DEMO_LOGIN=false`, and `AUTO_SEED=false` at real-data cutover.
- Correct and verify the Supabase session-pooler `DATABASE_URL`; the supplied pooler credential currently fails authentication. Do not substitute the direct migration URL for normal production runtime traffic.
- Move uploads from ephemeral Render storage to a persistent disk or private object storage and retain per-object authorization.
- Configure real email/Teams delivery and durable outbox behavior.
- Define and test RLS or explicitly document why all database access remains backend-service-only. Introspection found RLS disabled and no policies on all application tables.
- Complete privacy, audit-retention, financial-control, UAT, incident ownership, and restore testing.

## Deployment checklist

- Vercel project builds only the Next.js `frontend` workspace.
- Vercel has `NEXT_PUBLIC_API_BASE_URL=https://salesreimbursmentsystem.onrender.com` and no database/server secrets.
- Render syncs root `render.yaml`, builds only `backend`, and checks `/readyz`.
- Render has `DATABASE_URL`, `DIRECT_URL`, and `SESSION_SECRET` set as secrets; `ALLOWED_ORIGINS` exactly includes the production Vercel origin without a trailing slash.
- Migrations are a deliberate approved deploy step, never a Vercel function or automatic application-start action.
- Supabase backup/PITR and restore procedure are tested.

## Engineering readiness

- Prisma is the only ORM; production is baselined as `20260918000000_baseline`.
- Frontend and backend are separate deployables connected by an explicit HTTPS API origin.
- `/readyz` exposes database reachability and persistence health.
- Minimum gate is `npm run lint`, `npm test`, and `npm run build`.
- Before go-live, manually test login, submit claim, approval, processing, release code, payout, cash advance/liquidation, receipts/uploads, support, and restart persistence with `DEMO_MODE=false`.

Do not run `npm audit fix --force`; review dependency upgrades and regression-test them deliberately.
