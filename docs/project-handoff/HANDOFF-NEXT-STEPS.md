# Handoff next steps

Last updated: 2026-09-18.

## Immediate operator actions

1. Rotate the Supabase database password because a credential was shared in chat, then update both local and dashboard secrets.
2. Copy the exact Supabase IPv4 session-pooler URI from **Connect → Session pooler** and verify it with the Render runtime. The supplied pooler URL failed authentication; `DIRECT_URL` worked.
3. Configure Vercel and Render using root `vercel.json` and `render.yaml`; do not place database secrets in Vercel.
4. Deploy Render first, confirm `/healthz` and `/readyz`, then deploy Vercel and test browser CORS/API calls.
5. Run the complete manual workflow list in `PRODUCTION-PUNCHLIST.md` while still in demo mode.

## Product work still required for real data

- Microsoft Entra authentication and trusted server sessions.
- Persistent private upload storage.
- Real messaging providers and durable delivery/outbox behavior.
- RLS/backend-boundary decision and formal authorization audit.
- Restore drill, monitoring, incident ownership, UAT, privacy, and financial controls.

The database baseline is complete. Future schema changes must follow `DATABASE-MIGRATION.md` and require explicit approval.
