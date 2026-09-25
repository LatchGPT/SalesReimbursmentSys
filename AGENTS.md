# Current Next MVC Migration Guide

## Architecture

- All active application code lives under `src/`; the `backend/` directory is removed.
- Model: `prisma/schema.prisma` and `src/lib/db/`.
- View: `src/app/`, feature UI, and shared components.
- Controller: thin `src/app/api/**/route.ts` Route Handlers.
- Business logic: framework-neutral modules in `src/services/`.
- `src/server/` is temporary Express compatibility code. Do not add endpoints there.

## Migration workflow

Track work in `docs/NEXT_MVC_MIGRATION_TRACKER.md`.

For each endpoint family:

1. Extract business logic into `src/services/`.
2. Add explicit Next Route Handlers.
3. Preserve authorization, validation, response contracts, audit history, storage access, and persistence behavior.
4. Remove the family from the Express dispatcher only after its handlers work.
5. Run `npm run lint` and `npm test`.
6. Update the tracker only after both commands pass.

Stop on a failure; report and fix it before another batch.

## Safety

- Supabase data is live: never reset, truncate, force-push schema, or run destructive SQL without explicit current-session approval.
- Never edit applied Prisma migrations. Do not change schema or data during controller/file migration unless explicitly approved.
- Keep secrets server-side. Never expose database URLs, service-role keys, cron secrets, Redis tokens, or identity secrets through `NEXT_PUBLIC_*` variables.
- Preserve demo identity and `DEMO_MODE` behavior unless explicitly asked to change it.

## Final gate

After all controller conversions: remove unused Express compatibility code and dependencies, configure Playwright, run `npx playwright test`, run `npm run build`, and manually verify auth, claims, uploads, `/healthz`, `/readyz`, and cron.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
