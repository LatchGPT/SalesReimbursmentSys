# Project handoff — start here

This is the current handoff index. Read root `README.md` and `AGENTS.md` first; documents under `docs/archive/` are historical only.

## Five-minute orientation

1. `frontend/` is a Next.js 16 application deployed to Vercel.
2. `backend/` is an Express service deployed to Render. It owns API routes, scheduled jobs, uploads, and database access.
3. Supabase PostgreSQL is accessed through Prisma. The schema is in `backend/prisma/schema.prisma`; one client singleton lives in `backend/src/db/index.ts`.
4. The Vercel browser app calls the public Render origin configured by `NEXT_PUBLIC_API_BASE_URL`.
5. Demo identity still trusts `X-User-Id`; Microsoft Entra authentication is not complete.
6. `DEMO_MODE=true` preserves presentation data behavior. `DEMO_MODE=false` loads persisted database state and disables seeding.
7. Uploaded files need persistent object/disk storage before production use.

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
```

Frontend: `http://localhost:3001`. API: `http://localhost:3000`.

Database work also requires a backup/PITR confirmation, reviewed migration SQL, explicit approval for production changes, `/readyz`, and verification of the stored row.
