# Remaining backend gaps

Last reviewed: 2026-09-18.

## Security and identity

- Demo requests still identify a user through `X-User-Id`.
- Microsoft Entra routes are scaffolded, but verified OIDC, sessions, logout, CSRF/session hardening, and user mapping are incomplete.
- RLS is not enabled on the current public application tables. The backend is therefore the only intended database security boundary.
- A complete route-by-route server authorization audit is still required.

## Durability and operations

- Demo mode intentionally keeps generated in-process read state; real operation requires `DEMO_MODE=false`.
- Render filesystem uploads are ephemeral unless a disk is mounted. Object storage is preferred before real use.
- Email/Teams delivery remains simulated; durable provider delivery and retry ownership are required.
- External error tracking, alerting, retention, backup automation, and restore drills remain open.

## Scale and architecture

- Process-local caches and scheduled jobs assume a single Render instance. Horizontal scaling requires shared state, idempotent job ownership, and cache removal/invalidation.
- Search and large reporting workloads are browser/process oriented and need server-side pagination/query plans at production volume.
- Cross-domain write sequences should be audited for transactions and idempotency.

## Already completed

- Next.js frontend separated for Vercel; Express API separated for Render.
- Prisma is the sole ORM and production has a non-destructive baseline.
- One Prisma client/pool singleton is used by all repository modules.
- Core reimbursement, cash advance/liquidation, users, reference data, delegation, meetings, and support repositories persist through Prisma.
- `/readyz` reports database and write-through health.
