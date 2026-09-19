# Unified Next.js migration plan

## Decisions

- The repository root will be the single Next.js project; Prisma stays in root `prisma/`.
- Existing HTTP contracts move to Next.js Route Handlers and keep temporary `X-User-Id` compatibility.
- Production runs with `DEMO_MODE=false` and uses Supabase PostgreSQL through its transaction-mode pooler.
- Uploads use a private Supabase Storage `uploads` bucket. `/uploads/:filename` remains as an authorized compatibility route.
- Hourly maintenance uses Vercel Cron; rate limiting uses Upstash Redis.
- Existing tests move and adapt in place. Render retires after the Vercel deployment is verified.

## Target

```text
src/
  app/                  # thin pages and app/api Route Handlers
  features/             # feature components, server logic, services, schemas, types
  components/           # genuinely shared UI and layout
  lib/prisma.ts         # only Prisma client singleton
  config/env.ts         # validated public/server environment access
prisma/
  schema.prisma
  migrations/
public/
test/
```

## Checkpoints

1. Move Prisma to root, establish the singleton, and preserve the current build.
2. Extract Express handlers into framework-neutral feature logic and expose the same paths through Route Handlers.
3. Move frontend screens and backend services into feature-owned layers; replace React Router with App Router pages.
4. Present obsolete Express/workspace/Render files for approval before deleting any of them.
5. Consolidate packages, configuration, and environment validation for one Vercel application.
6. Verify type-checks, tests, production build, Prisma validation, health checks, and critical stored-row workflows; document deployment in `DEPLOY.md`.

No checkpoint authorizes production schema/data changes. The applied `20260918000000_baseline` migration remains unchanged.

## Progress

- Phase 0: discovery and decisions complete.
- Phase 1: root Prisma layout and singleton complete.
- Phase 2: Next.js Route Handler boundary, serverless state hydration, Supabase Storage, Upstash rate limiting, health routes, and hourly Vercel Cron complete.
- Phase 3: route screens, feature UI, browser API services, public feature types/schemas, and server route registration are organized by feature. Thin App Router catch-all pages retain the existing browser URL behavior while the temporary React Router compatibility layer remains in place for later migration.
- Phase 4: approved dead-code cleanup is complete. The unused placeholder, twelve zero-consumer component forwarding files, and unused Pino logging path were removed. The live Render/Express path, React Router shell, API facades, and backend workspace remain until their verified consumers or deployment obligations are removed in later phases.
- Phase 5: the Next.js source, public assets, configuration, dependencies, scripts, tests, and Vercel output are owned by the repository root. Environment reads are centralized and validated, browser API calls are same-origin, Prisma generation no longer needs `DIRECT_URL`, and the Render workspace remains available for rollback.
- Phase 6: local deployment readiness and the deployment runbook are complete. Local production health routes pass; database readiness is blocked by rejected Supabase pooler credentials. Safe deployed-environment checks, signed uploads, cron authorization, and stored-row persistence remain pending and do not authorize production access.

The legacy multipart upload route remains available for contract compatibility. The browser uses a signed direct-to-Supabase upload because Vercel Functions cannot proxy the application's full 10 MB upload allowance.
