# Remaining backend gaps

Last reviewed: 2026-09-18.

## Security and identity

- Demo requests still identify a user through `X-User-Id`.
- Microsoft Entra routes are scaffolded, but verified OIDC, sessions, logout, CSRF/session hardening, and user mapping are incomplete.
- RLS is not enabled on the current public application tables. The backend is therefore the only intended database security boundary.
- A complete route-by-route server authorization audit is still required.

## Durability and operations

- Demo mode intentionally keeps generated in-process read state; real operation requires `DEMO_MODE=false`.
- Supabase Storage is implemented; deployed bucket privacy, signed-upload CORS, authorization, retention, and recovery still require verification.
- Email/Teams delivery remains simulated; durable provider delivery and retry ownership are required.
- External error tracking, alerting, retention, backup automation, and restore drills remain open.

## Scale and architecture

- Process-local compatibility state is rehydrated per serverless request; completing repository-native handlers remains preferable to relying on full-state hydration.
- Search and large reporting workloads are browser/process oriented and need server-side pagination/query plans at production volume.
- Cross-domain write sequences should be audited for transactions and idempotency.

## Already completed

- Root Next.js pages and Route Handlers are unified for Vercel; the Express/Render service is retained temporarily for rollback.
- Prisma is the sole ORM and production has a non-destructive baseline.
- One Prisma client/pool singleton is used by all repository modules.
- Core reimbursement, cash advance/liquidation, users, reference data, delegation, meetings, and support repositories persist through Prisma.
- `/readyz` reports database and write-through health.
