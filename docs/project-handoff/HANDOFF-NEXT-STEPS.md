# Handoff next steps

Last updated: 2026-09-19.

## Immediate operator actions

1. Rotate the Supabase database password because a credential was previously shared in chat, then update local and dashboard secrets.
2. Copy the exact Supabase transaction-pooler URI from **Connect → Transaction pooler** and verify it as Vercel `DATABASE_URL`. The previously supplied pooler credential failed authentication; `DIRECT_URL` worked.
3. Configure the root Vercel project from `vercel.json` and the server/public boundaries in `.env.example`. Never expose server secrets through `NEXT_PUBLIC_*`.
4. Keep Render healthy as a rollback service, deploy the unified Vercel application, confirm `/healthz` and `/readyz`, and verify same-origin browser/API behavior before considering Render retirement.
5. Run the complete manual workflow list in `PRODUCTION-PUNCHLIST.md` while still in demo mode.

## Product work still required for real data

- Microsoft Entra authentication and trusted server sessions.
- Deployed Supabase Storage bucket, CORS, authorization, retention, and recovery verification.
- Real messaging providers and durable delivery/outbox behavior.
- RLS/backend-boundary decision and formal authorization audit.
- Restore drill, monitoring, incident ownership, UAT, privacy, and financial controls.

The database baseline is complete. Future schema changes must follow `DATABASE-MIGRATION.md` and require explicit approval.
