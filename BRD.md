# Business Requirements Document (BRD)

## Sales Reimbursement System

| Item | Detail |
| --- | --- |
| Document status | Consolidated baseline for the current product and production target |
| Version | 1.0 |
| Prepared | 16 September 2026 |
| Product state | Functional demonstration/pilot; not approved for real employee, client, or financial data |
| Currency | Philippine pesos (PHP) |

## 1. Purpose

The Sales Reimbursement System provides one controlled workspace for sales-related business expenses, from the supporting client interaction through approval, disbursement, receipt confirmation, reporting, and audit history. It replaces fragmented tracking by giving Requestors, Approvers, Custodians, Finance, and Administrators role-appropriate views of the same business process.

The system must support reimbursements (including transport), cash advances, liquidations, Minutes of Meeting (MOM), and Letters of Agreement (LOA). It must make both the financial amount and the responsible person visible at each stage without allowing a user to bypass workflow controls.

## 2. Business objectives and success measures

| Objective | Success measure |
| --- | --- |
| Standardize filing | A Requestor can file a complete expense request with supporting meeting, line-item, receipt, client, and configurable field data. |
| Enforce accountable approvals | Requests route to the requester’s reporting-line approver or an active delegate; self-approval is prohibited. |
| Make disbursement traceable | Approved amounts, payment/release details, and requestor receipt confirmation are recorded separately. |
| Settle advances accurately | Advance liquidation identifies settled, refund-due, and reimbursement-due outcomes. |
| Improve financial visibility | Finance and Admin reports distinguish claimed, approved, paid, outstanding, and receipt-supported amounts. |
| Preserve operational evidence | Status history, support discussions, reference data, and authorized attachments are available to eligible users. |

## 3. Scope

### In scope

- Role-based workspaces for Requestor, Approver, Custodian, Finance, and Administrator.
- Reimbursement and transport-expense filing, approval, release, and receipt confirmation.
- Cash-advance request, approval, release, liquidation, refund collection, and shortfall reimbursement handling.
- MOM/LOA authoring, supporting-document upload, client-contact management, export/preview, and client-CC awareness.
- Approval delegation, review meetings, stale-approver transfer and escalation.
- Receipt archive, global search, dashboards, analytics, transaction history, notifications, support requests, and audit/activity views.
- Administration of users, reporting relationships, companies, master data, dynamic fields, system settings, reporting, and controlled historical imports.

### Out of scope for the current pilot

- Real employee authentication and directory synchronization.
- Delivery of external email or Microsoft Teams notifications.
- Durable production object storage for uploaded files.
- Server-side/indexed search and reporting designed for high-volume scale.
- Production go-live until the controls in section 10 are met.

## 4. Stakeholders and roles

| Role | Business responsibility | Required access boundary |
| --- | --- | --- |
| Requestor | Submit and track own claims, advances, liquidations, MOMs/LOAs; confirm payment receipt. | Own records and permitted linked records only. |
| Approver | Review direct-report or delegated work; manage approval coverage. | Eligible team/delegated records; never approve own claim. |
| Custodian | Process approved disbursements and collect liquidation refunds. | Disbursement queues, ready-for-claim records, and payout history. |
| Finance | Monitor approved-and-later financial activity. | Read-only access from the financial-decision boundary onward. |
| Administrator | Govern users, hierarchy, configuration, reference data, reporting, and oversight. | System-wide administration, subject to production audit controls. |
| IT / Security | Provide identity, hosting, secrets, storage, monitoring, and integration services. | Production platform and security controls. |
| Finance-control owner | Own reimbursement, cash-advance, payment, retention, and UAT policies. | Business-rule approval and launch sign-off. |

## 5. Functional requirements

### 5.1 Core records

| ID | Requirement |
| --- | --- |
| FR-01 | The system shall let Requestors create, save, edit where permitted, submit, and track reimbursement claims. |
| FR-02 | A reimbursement shall support expense line items with vendor, category, date, amount, payment method, business purpose, receipt, and official receipt number. |
| FR-03 | Transport reimbursement shall use the reimbursement lifecycle while retaining its transport category/type. |
| FR-04 | The system shall support MOM and LOA records with document type, content, client data, source file, dynamic fields, multiple contacts/designations, and multiple client-copy recipients. |
| FR-05 | A claim may link to its MOM/LOA and supporting receipts; client-CC requires at least one recipient email. |
| FR-06 | Client-facing MOM/LOA exports shall omit internal-only fields; internal and client copies shall use the correct visibility rules. |
| FR-07 | The system shall retain a searchable history of material workflow changes and reasons. |

### 5.2 Reimbursement workflow

| ID | Requirement |
| --- | --- |
| FR-08 | The reimbursement lifecycle shall be Draft → Pending Approval → Processing → Ready for Claim → Completed, with Returned for Revision and Rejected outcomes. |
| FR-09 | On submission, the system shall route the claim using the Requestor’s `reports_to` relationship and any active approved delegation. A company default approver must not be used for routing. |
| FR-10 | An Approver shall be able to approve, return with a reason, reject, and where applicable schedule/respond to a review meeting. Workflow transitions must reject out-of-order or replayed actions. |
| FR-11 | A user shall not approve their own claim. |
| FR-12 | After approval, a Custodian shall record the release/payment method and reference, generate a release code, and set the claim Ready for Claim. |
| FR-13 | Only the Requestor shall complete a Ready-for-Claim reimbursement by providing the valid release code. |
| FR-14 | Release codes shall use cryptographically secure generation, a 14-day validity period, five-attempt lockout protection, and timing-safe comparison. They remain readable to Custodians so a code can be relayed to a Requestor. |

### 5.3 Cash advances and liquidations

| ID | Requirement |
| --- | --- |
| FR-15 | The system shall support cash advances through Draft → Submitted → Approved → Released → Liquidated, with rejection where applicable. |
| FR-16 | A Requestor shall be able to submit a liquidation with actual-expense line items against a released cash advance. |
| FR-17 | Liquidations shall support Draft → Submitted → Reviewed → Closed and Returned for Revision. |
| FR-18 | The system shall calculate the variance between released advance and reported expenses and classify the result as settled, Refund Due, or Reimbursement Due. |
| FR-19 | A Refund Due outcome shall require Custodian collection before closure. A Reimbursement Due outcome may create a follow-up reimbursement that owns its own approval and payment lifecycle. |

### 5.4 Organizational workflow

| ID | Requirement |
| --- | --- |
| FR-20 | Approvers shall be able to request a date-bounded delegation; the delegate shall accept or decline before it is active. |
| FR-21 | If a Requestor’s manager changes while a claim is Pending Approval, the claim shall remain with its original approver, be marked stale, and show the suggested new approver. |
| FR-22 | The original approver or an Administrator shall be able to transfer/reassign a stale claim. A stale untransferred claim shall become eligible for escalation after seven days. |
| FR-23 | A user already assigned to a claim may finish that assigned review even if their current role or headcount-derived approval authority later changes; reassignment must be explicit. |
| FR-24 | Administrators shall manage reporting relationships and approval eligibility. Approval authority is derived from direct-report headcount for Approvers, with the documented administrative override behavior. |

### 5.5 Information, support, and administration

| ID | Requirement |
| --- | --- |
| FR-25 | The system shall provide role-scoped dashboards, queues, receipt archive, calendars, transaction history, notifications, and support tickets. |
| FR-26 | Receipt Archive shall support authorized search/filtering; Approvers shall additionally be able to group eligible records by team member or client. |
| FR-27 | Global search shall return only records the current user may open and support claims, MOMs/LOAs, receipt items, and support tickets. |
| FR-28 | Administrators shall manage companies, departments, cost centers, business units, branches, project codes, vendors, configurable fields, payment methods, users, and system settings. Inactive master data must remain on historical records but not be selectable for new records. |
| FR-29 | New unmatched companies may be created without blocking a Requestor, must be deduplicated where possible, and shall be flagged for Administrator review. |
| FR-30 | Historical CSV import shall validate the batch and persist the batch, claims, line items, and history atomically; a failed import must not partially commit. |
| FR-31 | Users shall be able to raise and reply to support tickets. Administrators may view and respond to all tickets; other users may view only their own. |

## 6. Reporting and analytics requirements

| ID | Requirement |
| --- | --- |
| AR-01 | Dashboards and exports shall distinguish claimed, approved, paid, and outstanding amounts; claimed money must never be labelled paid spend or expenditure. |
| AR-02 | Liquidation expense totals shall not be added to cash-advance paid amounts because this double-counts the same funds. |
| AR-03 | A liquidation shortfall reimbursement shall be reported as its own reimbursement. |
| AR-04 | Finance aggregation shall exclude drafts, submissions, pending approvals, rejections, and pre-review returned records; it begins with approved reimbursements/cash advances and reviewed liquidations. |
| AR-05 | Cycle-time measures shall use the relevant immutable status-history endpoints. Missing endpoints shall display `No data`, not zero or a created-date substitute. |
| AR-06 | Every date filter shall identify whether it uses filed, expense, approved, paid, or completed date; records without that date are excluded. |
| AR-07 | Receipt reporting shall provide receipt-supported amount, receipt coverage, average receipt value, and searchable official receipt number. |
| AR-08 | Role visibility and current reporting/delegation scope shall be applied before aggregation. |

## 7. Data, security, and non-functional requirements

| ID | Requirement |
| --- | --- |
| NFR-01 | Production identity shall use Microsoft Entra OIDC authorization-code flow with PKCE, state, nonce, issuer/audience/signature/tenant validation, server-side sessions, and secure HttpOnly/Secure/SameSite cookies. |
| NFR-02 | Production authorization shall be enforced server-side and resource-by-resource. UI visibility is not an authorization boundary. |
| NFR-03 | A validated Entra `oid` shall map to an internal user. Application roles remain application-managed until a group/app-role policy is approved. |
| NFR-04 | Attachments shall use private durable object storage with record-level access checks, metadata, retention, and cleanup. Local-disk storage is acceptable only for the prototype. |
| NFR-05 | Production shall use a persistent-process host. The current in-memory read-cache/write-through design must not run on Vercel serverless. |
| NFR-06 | Data writes shall persist to Supabase Postgres through the approved migration and repository pattern. Production boot shall load persisted data with `DEMO_MODE=false`. |
| NFR-07 | The solution shall provide rate limiting, CSP/security headers, structured request logs, liveness/readiness checks, persistence-health visibility, backup/restore processes, monitoring, error tracking, and incident ownership. |
| NFR-08 | Search and reporting shall be moved server-side/indexed before data volumes exceed practical browser-side loading limits. |
| NFR-09 | The product shall undergo accessibility, responsive-design, policy, privacy, retention, financial-control, and user-acceptance review before launch. |

## 8. Business rules and controls

- Financial amounts use PHP.
- Finance is read-only and sees records only from the approved/reviewed financial boundary onward.
- Payment/release is distinct from Requestor confirmation; the latter closes a reimbursement.
- The current reporting line decides initial routing; a manager change does not silently reroute an active claim.
- Notifications respect the user’s configured notification categories. The current outbox is a demonstration record, not proof of external delivery.
- Attachments must be authorized by the owning claim, MOM/LOA, or liquidation item.
- Demo users, seed data, and demo controls must remain available until the authorized production cutover.

## 9. Dependencies and assumptions

| Dependency / decision | Owner | Needed for |
| --- | --- | --- |
| Entra tenant, application ID, secret/certificate, approved redirect URLs, assignment policy | IT / Entra administrator | Real sign-in and internal Teams integration |
| Google Workspace/Gmail sending decision and sender mailbox/domain configuration | IT / business owner | Client email delivery and PDF attachments |
| Private object-storage provider and credentials | Infrastructure owner | Durable attachments |
| Live-database migration baseline and duplicate `claim_number` remediation | Database owner | Applying migrations 0004–0006 and reliable DB-mode claim creation |
| Production reference/master data | Admin / finance-control owner | Useful non-demo forms when `DEMO_MODE=false` |
| Role-mapping, retention, reimbursement, advance, and payment policies | Product and finance-control owners | Production authorization and acceptance |

## 10. Constraints, risks, and release gates

The current system is suitable for demonstration/pilot use only. It must not process real employee, client, or financial data until all of the following are completed:

1. Replace the client-controlled `X-User-Id` mechanism and demo login with validated Entra identity and server-side sessions.
2. Set production configuration: `DEMO_MODE=false`, `AUTH_MODE=microsoft`, demo login disabled, and automatic seed disabled.
3. Baseline the migration ledger, resolve duplicate claim numbers, and apply the pending reviewed database migrations with the database owner’s authorization.
4. Move uploads from local disk to private durable object storage.
5. Implement real client-email and internal-notification delivery, including retries, delivery status, and an audit trail.
6. Resolve or formally accept the remaining `react-router` high-severity advisory; schedule the dev-toolchain advisory remediation.
7. Complete authorization, accessibility, privacy/retention, financial-control, backup/restore, monitoring, incident-response, and UAT sign-offs.

## 11. Acceptance criteria

The business solution is accepted for pilot when each role can complete its documented workflow with role-appropriate data visibility, workflow guards prevent invalid transitions/self-approval, analytics follow section 6, and the test/build baseline passes.

It is accepted for production only when the release gates in section 10 are evidenced, the configured production environment runs without demo identity/data, a real end-to-end workflow persists and reloads correctly, attachments are durable and authorized, and named business, technical, security, database, infrastructure, and finance-control owners sign off.

## 12. Source and document-control notes

This BRD consolidates the current documents in `docs/project-handoff/`: product README, user manual, production punch-list, handoff/remaining-gap records, database migration status, Microsoft authentication handoff, hierarchy-sync design, and analytics metric contract. The archived documents under `docs/archive/` were reviewed as historical evidence only; where they conflict with the curated handoff pack, the current handoff pack and current implementation take precedence. The User Manual PDF is a rendered form of the current operational guidance and does not introduce different business requirements.
