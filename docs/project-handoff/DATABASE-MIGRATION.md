# Prisma migration status

Last verified: 2026-09-18.

## Current state

- Supabase PostgreSQL is the live schema and data source of truth.
- Prisma 7 is the only ORM and query layer.
- `prisma/schema.prisma` was produced by introspecting production, not by transcribing the retired application schema.
- Repository modules under `backend/src/db/` use the singleton from `src/lib/prisma.ts` through a temporary compatibility export.
- The 25 existing application tables, 16 enums, and `claim_number_seq` are represented in `prisma/migrations/20260918000000_baseline/migration.sql`.
- The baseline is marked applied in production. Applying the baseline record did not recreate or alter existing application tables or rows.
- The legacy seven migrations were already present in their old ledger before the baseline. They are no longer part of the runnable codebase.
- Production had one claim before and after baselining.
- No public RLS policies, views, functions, or triggers were found during introspection. RLS was disabled on all 25 public application tables. Treat that as a production-hardening gap, not an ORM feature to emulate.

## Connection strategy

`DATABASE_URL` is the Render runtime connection. Use Supabase's IPv4 session pooler with TLS. The API uses a bounded `pg.Pool` through Prisma's PostgreSQL adapter.

`DIRECT_URL` is the administrative connection used by `prisma.config.ts` for introspection and Prisma Migrate. Do not use it in browser code or routine application traffic.

The current direct credential was sufficient for backup, introspection, and baseline verification. The separately supplied pooler credential was rejected during this migration and must be corrected before Render can persist data.

## Safe workflow for future schema changes

1. Obtain explicit approval for the proposed production schema action.
2. Confirm Supabase PITR or create and validate a fresh `pg_dump` backup.
3. Update `prisma/schema.prisma`.
4. Generate migration SQL in a safe development workflow; never use reset or forced push against production.
5. Review SQL for drops, truncation, narrowing conversions, rewritten columns, or locking risk and report them before execution.
6. Apply with `npm run db:migrate` as a deliberate CI/Render pre-deploy/manual step—not from Vercel, application startup, or a request handler.
7. Run `npm run db:status`, `/readyz`, automated tests, and an end-to-end persistence check.

Never edit the applied baseline or mark a future migration applied unless its SQL is already reflected in the database.

## Backup from this migration

The pre-migration custom-format backup is stored locally under `.local-backups/` (gitignored). Its path and checksum are reported in the migration handoff; it must not be committed or uploaded with application artifacts.
