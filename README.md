# Sales Reimbursement System

Sales Reimbursement System helps a sales organization file, review, pay, and track work-related expenses. It brings reimbursement claims, transport claims, cash advances, liquidations, receipts, and meeting records into one application. Requestors, approvers, custodians, finance staff, and administrators each have a role in the workflow.

**Current status:** This repository supports demos. Demo login trusts a caller-supplied `X-User-Id`, and Microsoft Entra sign-in is not complete. Do not use real employee, client, or financial data until the [release blockers](docs/03-STATUS-AND-NEXT-STEPS.md) are closed.

## How work moves through the system

1. A **requestor** creates a reimbursement or transport claim and attaches receipts. They can also request a cash advance, record its expenses in a liquidation, and create Minutes of Meeting or Letters of Agreement.
2. An **approver** reviews claims from their team. They can approve, reject, return, delegate, or transfer work when a reporting manager changes.
3. A **custodian** processes approved payouts. For reimbursements, the custodian issues a release code and pays cash. The requestor enters that code to confirm receipt and complete the claim.
4. **Finance** views approved financial records and reports. **Administrators** manage users, company and master data, configurable fields, imports, and activity records.

Reimbursement claims keep the full claimed amount, but the current payout cap is PHP 1,000 per claim. Cash advances and liquidations have their own approval and settlement steps. The [user manual](docs/05-USER-MANUAL.md) describes each role's screens and actions.

## Run locally

Use Node.js 20 or newer. Install dependencies, create local environment settings, and start the app:

```bash
npm ci
cp .env.example .env
npm run dev
```

On Windows PowerShell, use `Copy-Item .env.example .env` if needed. Open `http://localhost:3000`. The Next.js app serves both pages and `/api/*` routes from that origin. `.env.example` contains demo defaults; database and storage features need their server-side settings.

For verification, run `npm run lint`, `npm test`, `npx playwright test`, and `npm run build`. See [run and deploy](docs/01-RUN-AND-DEPLOY.md) for Docker, database, environment, and deployment instructions. Never run a migration against live Supabase without the approval and backup checks in [AGENTS.md](AGENTS.md).

## Where code lives

| Path | Responsibility |
| --- | --- |
| `src/app/` | Next.js pages and API Route Handlers |
| `src/features/` | Feature screens and browser behavior |
| `src/services/` | Business operations |
| `src/lib/db/` | Database access |
| `src/server/` | Remaining shared state and compatibility services |
| `prisma/` | Database schema and migration history |

The application uses Next.js, Prisma, PostgreSQL, and Supabase Storage. Start with [docs/00-START-HERE.md](docs/00-START-HERE.md) for the full documentation map. Read [architecture](docs/02-ARCHITECTURE.md) for design details and [requirements](docs/04-REQUIREMENTS.md) for the draft business scope.
