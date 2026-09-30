# Architecture and design

Verified against repository code on 2026-09-29. Sections describe current implementation unless marked as planned or unverified.

## Application and data

`src/app/` holds Next.js pages and explicit API Route Handlers. `src/features/` holds feature UI. `src/services/` holds business operations. `src/lib/db/` contains persistence modules, while `prisma/schema.prisma` and `prisma/migrations/` define the database model and migrations. `src/server/` still holds state and shared compatibility services, but no Express dispatcher remains.

The browser uses same-origin APIs. Prisma uses PostgreSQL through `src/lib/prisma.ts`. The baseline migration represents the previously live schema; the later migration adds workflow query indexes. Whether both migrations are applied remotely is unverified. Demo state is seeded when enabled; `DEMO_MODE=false` requires `DATABASE_URL` and loads persisted state. Some operations still keep process state and write through to repositories, so transactional durability needs review.

## Analytics contract

Claimed amount is the submitted amount. Approved amount is the amount accepted for payment, capped at PHP 1,000 for reimbursements. Paid amount is money released. Outstanding amount is approved minus paid, never below zero. Liquidation expenses are accounting of an advance, not another paid amount; count a later shortfall reimbursement separately. The analytics service computes these values by record type and applies role visibility before aggregation.

Use status history or stored lifecycle timestamps for submitted, approved, released, and completed dates. A missing endpoint means no cycle-time value. Date filters must name their date basis: filed, expense, approved, paid, or completed. Receipt coverage counts applicable line items with attachments; official receipt number is a business field, not a filename. These are metric definitions from the earlier contract; end-to-end dashboard conformance is unverified.

## Reporting hierarchy

Manager changes in User Accounts simulate an org-chart sync; no Microsoft Graph directory sync exists. `reports_to` and active delegations determine routing. The approver assigned at submission remains assigned after a manager change. `src/server/services/hierarchy.ts` marks affected pending claims stale, records a suggested new approver, and offers transfer. Admin fallback checks use a seven-day threshold. This is a manual/admin workflow, not proof of a scheduled directory sync. Approval authority recalculates from direct reports for approver roles; an admin may override it until a later headcount change. Claim-specific assignment can still authorize an existing approver after an org change. `Company.default_approver_id` is informational and must not route claims.

## Microsoft identity plan

Current demo requests trust `X-User-Id`. Microsoft start/config routes are scaffolding, not a validated sign-in flow. IT must supply tenant ID, client ID, secret or certificate, approved redirect URLs, and assignment policy. Minimum OIDC sign-in scopes are `openid profile email`; Graph permission is separate.

Before switching `AUTH_MODE`, implement authorization code with PKCE, state and nonce, validate issuer/audience/signature/expiry/tenant, map validated `oid` to `users.entra_object_id`, and use secure server sessions. Remove trust in caller-supplied identity headers, secure uploads by session and resource permission, and test disabled, unassigned, wrong-tenant, expired, and removed accounts. Keep role assignment in the application until a group mapping policy is approved. Profile photos require separate approved Graph access; current avatars are demo assets.
