# Project handoff — start here

This is the current handoff index. Read root `README.md` and `AGENTS.md` first; documents under `docs/archive/` are historical only.

## Five-minute orientation

1. Root `src/` is the unified Next.js 16 application targeted for Vercel; it serves pages, same-origin APIs, uploads, health checks, and scheduled maintenance.
2. `backend/` contains retained controllers/services plus a temporary Express/Render rollback service. Do not retire Render until Vercel is verified.
3. Supabase PostgreSQL is accessed through Prisma. The schema is in `prisma/schema.prisma`; one client singleton lives in `src/lib/prisma.ts`.
4. The browser calls same-origin Route Handlers. No public backend-origin variable is required.
5. Demo identity still trusts `X-User-Id`; Microsoft Entra authentication is not complete.
6. `DEMO_MODE=true` preserves presentation data behavior. `DEMO_MODE=false` loads persisted database state and disables seeding.
7. Uploaded files use the private Supabase Storage `uploads` bucket and require deployment-time bucket and authorization verification.

## Reading order

| Order | Document | Purpose |
|---:|---|---|
| 1 | Root `README.md` | Current architecture, commands, environment, deployment, and safety rules |
| 2 | `PRODUCTION-PUNCHLIST.md` | Remaining blockers before real data |
| 3 | `DATABASE-MIGRATION.md` | Prisma baseline and database operating rules |
| 4 | `MICROSOFT-AUTH-HANDOFF.md` | Identity inputs and remaining implementation |
| 5 | `REMAINING-BACKEND-GAPS.md` | Domain-specific durability and provider gaps; verify old paths against README |
| 6 | `USER-MANUAL.md` | Role-by-role product operation |

Also use `HIERARCHY-SYNC-DESIGN.md` for reporting-line changes and `ANALYTICS-METRIC-CONTRACT.md` for financial metric definitions.

## Local verification

```bash
npm ci
npm run dev
npm run lint
npm test
npm run build
npm run build:legacy-backend
```

Unified pages and API: `http://localhost:3000`.

Database work also requires a backup/PITR confirmation, reviewed migration SQL, explicit approval for production changes, `/readyz`, and verification of the stored row.
