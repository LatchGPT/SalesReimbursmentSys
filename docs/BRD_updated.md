# Business Requirements Document (BRD) — verified implementation baseline

## Sales Reimbursement System

| Item | Detail |
| --- | --- |
| Document status | Rewritten, testable baseline; implementation verified against the repository on 17 September 2026 |
| Version | 1.1 |
| Product state | Demonstration/pilot only; not authorised for real employee, client, or financial data |
| Currency | Philippine pesos (PHP) |
| Requirement status legend | **Implemented** = found in current code; **Conflict** = BRD intent and current behaviour differ; **Unverified / target** = retained intent not found as an implemented control |

## 1. Purpose

The system is a role-based prototype for recording sales-related meetings, reimbursements, cash advances, liquidations, disbursement actions, support requests, and reporting. It uses a client-supplied demo identity (`X-User-Id`); it is therefore not an authenticated production system.

This document preserves the existing IDs. Each requirement states observable current behaviour. A **Conflict** or **Unverified / target** note is a decision item, not an approved substitute for the stated business intent.

## 2. Objectives and measurable pilot outcomes

| Objective | Pilot evidence |
| --- | --- |
| File expense requests consistently | A Requestor can create a MOM/LOA and a reimbursement or transport reimbursement; valid submission produces a claim number and a Pending Approval claim. |
| Route approvals accountably | The claim uses the requestor's `reports_to` manager at submission, or that manager's active accepted delegate. The server rejects self-approval. |
| Separate payment from receipt confirmation | A Custodian records payment before a Requestor can enter a release code to complete a reimbursement. |
| Settle advances | A released advance can be liquidated; the resulting variance determines closed, refund-collection, or shortfall behaviour. |
| Give scoped visibility | List/detail endpoints and analytics apply current role-specific scope; this is prototype authorization, not a production security certification. |

## 3. Scope

### In scope for the pilot

- Reimbursements and transport reimbursements; MOM/LOA records; cash advances and liquidations.
- Demo role workspaces for Requestor, Approver, Custodian, Finance, and Administrator.
- In-process workflow data with Postgres write-through when `DATABASE_URL` is configured; loading persisted data on boot only when `DEMO_MODE=false`.
- Local-file uploads, role-scoped search, reporting, notifications/outbox records, support requests, master data, and historical import.

### Explicitly out of scope / not implemented for the pilot

- Real Microsoft Entra authentication, directory synchronisation, server sessions, and external email/Teams delivery.
- Durable object storage, production backup/restore and monitoring operations, and server-side/indexed search at scale.
- Authorisation to use real employee, client, or financial data.

## 4. Roles and current access model

| Role | Observable current access |
| --- | --- |
| Requestor | Own claims, MOMs, cash advances, liquidations, payouts, and support tickets. |
| Approver | Own records plus records routed to them, directly reporting requestors, and active delegated work. |
| Custodian | Financially progressed reimbursements; all cash advances/liquidations; no MOM content. |
| Finance | Read-only financial-boundary records: approved-or-later reimbursements/cash advances and reviewed/closed liquidations. |
| Administrator | Broad configuration and oversight access, including all claims/MOMs/support tickets and demo controls when demo mode is enabled. |

**Current control limitation:** the server obtains the role from a caller-controlled `X-User-Id` header. All role rules below describe functionality, not trustworthy production identity.

## 5. Functional requirements

### 5.1 Core records

| ID | Requirement and acceptance criteria |
| --- | --- |
| FR-01 | **Implemented, with scope clarification.** A signed-in user with `reports_to` may create a reimbursement as Draft or Pending Approval. Only the owning Requestor may resubmit a Returned claim; resubmission replaces its line items and returns it to Pending Approval. **Pass:** valid create returns the claim and its status; an attempt to resubmit any status other than Returned returns 400; another user cannot resubmit it. **Conflict:** the original BRD says claims can be generally “edited where permitted”; no general Draft-claim update endpoint was found. |
| FR-02 | **Implemented, with validation clarification.** A claim contains one or more expense rows. Each row stores category, amount, receipt URL, and may store vendor, expense date, payment method, business purpose, and official receipt number. For a non-draft claim, each row needs category, a positive numeric amount, receipt, and an expense date within the configured reimbursement-date rule; category limits are checked. **Pass:** invalid input returns 400 and no claim is created. **Note:** receipt is required even when `is_draft=true`; vendor, payment method, business purpose, and official receipt number are not required and may be defaulted. |
| FR-03 | **Implemented.** Creating with `claim_type='Transport Reimbursement'` stores that type, follows the reimbursement workflow, and does not require a MOM. A normal reimbursement requires a MOM. **Pass:** a transport claim can reach Pending Approval without `mom_id`; an otherwise equivalent reimbursement receives 400. |
| FR-04 | **Conflict.** The system stores one MOM/LOA document type (`MoM` or `LOA`), client, one contact name/email field, meeting details, discussion, agreements, action items, source file URL/name, participants text, and custom fields. **Pass for implemented behaviour:** creating a record returns these stored values; only its owner or eligible Approver may update it. **Conflict requiring decision:** the original BRD requires multiple contacts/designations and multiple client-copy recipients as structured data. The current API has only single string fields (the UI may display comma-separated email text); no structured multiple-contact/designation model was found. |
| FR-05 | **Conflict.** A completed MOM can be linked to one reimbursement; the system rejects a missing/nonexistent MOM where required, an incomplete MOM on non-draft submission, and reuse of a MOM already linked to another claim. Claim receipts are stored on claim line items. **Conflict:** `cc_client` does not require a recipient email in the API. MOM sending substitutes a fallback demo email when the stored email is blank; this conflicts with the original requirement to require at least one recipient email. |
| FR-06 | **Implemented for client PDF export; delivery is not implemented.** Internal MOM/LOA export includes all displayed rows. Client PDF export removes `Type of Account` and otherwise uses the same document content. **Pass:** compare internal and client PDFs: `Type of Account` appears only in the internal copy. **Unverified / target:** a client-facing export visibility policy beyond that one field is not found; the “send” action writes a mock outbox email and does not deliver the PDF externally. |
| FR-07 | **Implemented, with search limitation.** Claim, cash-advance, liquidation, delegation, and administrative mutations record status/activity history with actor, timestamp, old/new value or status, and reason where the action supplies one. **Pass:** perform a workflow transition and verify the corresponding record history contains it. **Conflict:** no server endpoint provides a standalone searchable history repository; history is exposed with records/activity views, so “searchable history” is broader than verified behaviour. |

### 5.2 Reimbursement workflow

| ID | Requirement and acceptance criteria |
| --- | --- |
| FR-08 | **Implemented.** Valid reimbursement states are Draft, Pending Approval, Processing, Ready for Claim, Completed, Returned, and Rejected. A normal happy path is Draft/Pending Approval → Processing → Ready for Claim → Completed. **Pass:** each permitted action changes to the named state and adds history; protected out-of-order approval, code generation, and ready actions return 409. |
| FR-09 | **Implemented.** On claim creation, the server sets the approver from the Requestor's `reports_to`. If an Active delegation covers that manager and date, it assigns the delegate while retaining the manager as original approver. `Company.default_approver_id` is not used. **Pass:** change the manager/delegation data before submitting and verify the assigned approver; changing only company default approver has no routing effect. |
| FR-10 | **Implemented, with precision.** The current approver, original approver, or active delegate may decide a Pending Approval claim as Approved, Returned, Rejected, or Request Review. Returned/Rejected requires a comment. Request Review creates a review-meeting record; the Requestor may confirm, decline, or request rescheduling. **Pass:** unauthorised actors get 403; missing required comment gets 400; a decision after the claim left Pending Approval gets 409. |
| FR-11 | **Implemented.** When the claim requestor is the actor, the approval endpoint returns 403 even if that user is an Approver. **Pass:** an Approver's own pending claim cannot be approved, returned, or rejected by that same identity. |
| FR-12 | **Implemented, with sequence clarification.** A Custodian first generates/reissues a release code only while a claim is Processing or Ready for Claim. To mark it Ready for Claim, the Custodian must submit a configured payment method; payment reference is optional. This sets paid data and Ready for Claim. **Pass:** pre-Processing code generation/ready action returns 409; an unsupported payment method returns 400; a valid action exposes the claim in the ready queue. |
| FR-13 | **Implemented.** Only the claim Requestor may submit a code, and only when status is Ready for Claim. A valid code changes status to Completed and records receipt confirmation. **Pass:** another user receives 403; a non-ready claim cannot complete; valid code returns Completed. |
| FR-14 | **Implemented.** Codes are six characters drawn with `crypto.randomBytes` from `A-H`, `J-N`, `P-Z`, and `2-9`; they expire 14 days after issue. The server compares equal-length codes with `timingSafeEqual`; five incorrect attempts set a 15-minute lockout, during which even a correct code returns 429. The plaintext code remains on the claim for Custodian display. **Pass:** verify format, expiry error, five wrong attempts then 429, and rejection of a correct code during lockout. |

### 5.3 Cash advances and liquidations

| ID | Requirement and acceptance criteria |
| --- | --- |
| FR-15 | **Implemented.** A Requestor with a manager may create a positive-amount, purpose-required cash advance in Draft, edit it, submit it, have its assigned Approver/active delegate approve or reject it, and have a Custodian release an Approved advance. States are Draft → Submitted → Approved → Released → Liquidated, with Rejected as a resubmittable outcome. One Requestor may have only one active non-rejected/non-liquidated advance. **Pass:** invalid amount/purpose, a second active advance, wrong actor, and invalid state return 400/403. |
| FR-16 | **Implemented.** Only the Requestor may create a liquidation against their Released cash advance, then add, edit, or delete its line items while it is Draft or Returned for Revision. **Pass:** an unreleased/foreign advance cannot be liquidated; after submission, line-item modification is rejected. |
| FR-17 | **Implemented.** A liquidation moves Draft or Returned for Revision → Submitted. Its designated cash-advance approver or active delegate may approve it to Reviewed/Closed or return it; a return requires a comment. **Pass:** review outside Submitted state, a non-designated reviewer, and a Returned decision without comment fail. |
| FR-18 | **Implemented.** The system recalculates `totalSpent` from liquidation line items and compares it to the released advance: equal is Settled; lower is Refund Due; higher is Reimbursement Due. **Pass:** create line items below, equal to, and above the release amount and verify classification/variance after recalculation. |
| FR-19 | **Implemented, with important difference.** A Reviewed Refund Due liquidation can close only after a Custodian supplies a configured refund method; collection stores method, optional reference, timestamp, and closes the liquidation/advance. A Reimbursement Due approval automatically creates a Processing shortfall reimbursement with approved amount capped at PHP 1,000 and sends it directly to the Custodian workflow—there is no separate approval lifecycle. **Conflict:** this contradicts the original “may create a follow-up reimbursement that owns its own approval and payment lifecycle.” |

### 5.4 Organisational workflow

| ID | Requirement and acceptance criteria |
| --- | --- |
| FR-20 | **Implemented.** An Approver can request delegation to another Approver with required start/end dates; self-delegation and start-after-end are rejected. The delegate alone may accept or decline; accepted delegation routes new claims only inside the date window and expires after the end date. **Pass:** Pending delegation does not route work; accepted in-window delegation does; invalid target/dates fail. |
| FR-21 | **Implemented.** When an Administrator changes a Requestor's manager, each of that Requestor's Pending Approval claims still assigned to the old manager is retained there and receives `approver_stale_since`, `pending_transfer_to`, stale reason, and an un-escalated flag. **Pass:** update manager and verify no automatic reassignment plus the stale metadata/history. |
| FR-22 | **Implemented, with scheduler limitation.** The original/current approver and an Administrator may transfer a stale claim; an Administrator may also reassign it. A stale untransferred claim becomes escalated only when an Administrator runs the fallback check after seven days (or explicitly forces it); no background scheduler was found. **Pass:** run the check with eligible data and verify `escalated_to_admin=true`; before threshold without force it remains false. |
| FR-23 | **Implemented.** Approval decisions are authorised against the claim's stored assignment/original approver or an active delegate, not the actor's current headcount-derived authority. Explicit transfer/reassignment is required to move the work. **Pass:** change an assigned approver's role/authority and verify their existing assigned claim remains actionable until reassigned. |
| FR-24 | **Implemented.** Administrators may edit user role, department, job title, manager, employment status, and `can_approve_reimbursements`. A manager relationship may not be self-referential or circular. Authority is recalculated for an Approver when direct-report headcount changes; an admin override lasts until a relevant subsequent headcount change, and non-Approvers cannot hold approval authority. **Pass:** validate circular-chain rejection and recalculation/override behaviour. |

### 5.5 Information, support, and administration

| ID | Requirement and acceptance criteria |
| --- | --- |
| FR-25 | **Implemented for pilot.** The frontend exposes role-scoped dashboards/queues and shared receipt, calendar, notification, transaction, and support views. Notifications and emails are in-process demonstration records. **Pass:** each demo role sees its defined route set and scoped data. **Unverified / target:** external notification delivery is not implemented. |
| FR-26 | **Implemented in the frontend, scope-dependent.** Receipt Archive offers text search/filtering and Approver group-by controls for team member/client. Data shown comes from records the current identity receives. **Pass:** change search/filter/group criteria and verify only matching accessible items are displayed. **Note:** server-side filtering/authorisation of a dedicated receipt archive is not separately implemented. |
| FR-27 | **Implemented client-side.** Global search ranks claims, MOMs/LOAs, receipt items, and support tickets from data already loaded into the user's workspace; it supports token matching, prefixes, common abbreviations, and limited typo matching. **Pass:** result navigation opens only an accessible loaded record. **Conflict:** it is not a server-side permission-enforced search endpoint, so “only records the current user may open” depends on the upstream scoped datasets and client route checks. |
| FR-28 | **Partly implemented / conflict.** Administrators can manage companies; six named master-data catalogs; configurable field definitions; users; and system settings including categories, payment methods, thresholds, and category limits. **Conflict:** inactive catalog records are stored and returned by the API, and no universal server rule was found that prevents their selection in every new-record flow; “remain historical but not selectable” is not verified. |
| FR-29 | **Implemented, with wording correction.** Creating/updating a MOM calls company matching: an unmatched client name creates a pending-review company without blocking the Requestor; matches are normalised/deduplicated where possible. **Pass:** save a MOM with a new client and verify a pending-review company; submit a normalised duplicate and verify no duplicate company. |
| FR-30 | **Conflict.** An Administrator may submit a non-empty parsed record array as a historical import. When a DB is configured, the repository persists the batch, claims, line items, and histories in one transaction; a failure returns 500 and does not add the batch to in-memory state. **Conflict:** there is no backend CSV parser or full record-level validation before construction; when no DB is configured, the in-memory import is not a database transaction. |
| FR-31 | **Implemented.** Non-Admin users may create support tickets and read/reply/update only their own; Administrators may list, reply to, assign, prioritise, and update all tickets but cannot create their own. **Pass:** cross-user ticket access returns 403; Admin ticket creation returns 403; valid ticket/message creation returns 201. |

## 6. Reporting and analytics requirements

| ID | Requirement and acceptance criteria |
| --- | --- |
| AR-01 | **Implemented.** Analytics records expose claimed, approved, paid, and outstanding amounts. Outstanding is `max(approved − paid, 0)`. **Pass:** an approved-but-unpaid record has positive outstanding; a paid reimbursement has paid amount populated. |
| AR-02 | **Implemented.** Liquidation records always report `paidAmount=0`; their expenses are not added to paid cash advances in the common aggregate. **Pass:** include a released advance and its liquidation and verify the liquidation contributes no paid cash amount. |
| AR-03 | **Implemented, with FR-19 limitation.** A Reimbursement Due liquidation creates a separate reimbursement analytics record identified by `sourceLiquidationId`. **Pass:** review an over-spend liquidation and verify the new reimbursement appears separately. |
| AR-04 | **Implemented.** Finance scope includes reimbursement statuses Approved/Processing/Ready for Claim/Completed; cash advances Approved/Released/Liquidated; and liquidations Reviewed/Closed. **Pass:** Finance analytics excludes the listed earlier/rejected statuses. |
| AR-05 | **Partly implemented / conflict.** Approval turnaround uses immutable history submitted/approved endpoints and returns `null` when either is missing. **Conflict:** only average approval turnaround is implemented; other cycle times and a UI literal `No data` requirement are not verified (the API returns `null`, and UI rendering must be tested separately). |
| AR-06 | **Implemented.** Analytics accepts `dateBasis` of submitted, expense, approved, paid, or completed. For a date range, a record without the selected event date is excluded. **Pass:** select paid date and verify an unpaid record is absent; invalid basis defaults to submitted. |
| AR-07 | **Conflict.** Official receipt number is stored on line items and may be found in receipt-oriented client search. **Conflict:** the analytics summary does not return receipt-supported amount, coverage, or average receipt value; these measures are not implemented in the verified endpoint. |
| AR-08 | **Implemented.** Analytics applies role scope before filtering and aggregation; Approver scope includes current direct reports, stored assignments, and active delegation. **Pass:** compare results for unrelated Requestor versus Admin/eligible Approver. |

## 7. Data, security, and non-functional requirements

| ID | Requirement and verifiable status |
| --- | --- |
| NFR-01 | **Unverified / target — not implemented.** Microsoft Entra OIDC, PKCE/state/nonce validation, server sessions, and secure cookies are not present as an operational flow. Current identity is demo header based. |
| NFR-02 | **Partly implemented / target.** Many routes perform role/resource checks and return 401/403; a documented production-wide authorisation audit remains open. **Pass for current implementation:** test the relevant route with an unauthorised demo identity. **Unverified:** complete resource-by-resource production coverage. |
| NFR-03 | **Unverified / target — not implemented.** No validated Entra `oid` mapping exists. Roles are current internal demo-user properties. |
| NFR-04 | **Partly implemented / target.** Uploads accept JPG, PNG, GIF, WEBP, PDF, DOC, and DOCX up to 10 MB on local disk. Download resolves the file to an owning claim/MOM/liquidation item and applies that record's access predicate. Durable private object storage, retention, and cleanup are not implemented. |
| NFR-05 | **Implemented design constraint.** Production-mode deployment must use one persistent Node process because reads use process memory; Vercel serverless is unsupported. **Pass:** deployment design documents/host configuration use a persistent-process host. |
| NFR-06 | **Implemented with operational caveat.** Mutations call repository persistence functions; with `DEMO_MODE=false`, boot loads persisted domains rather than demo seed data. Write failures are logged and do not fail the business request; `/readyz` exposes persistence health for instrumented core-loop writes. **Unverified:** live migrations must be applied and live database round-trip tested before production. |
| NFR-07 | **Partly implemented / target.** Helmet CSP, API rate limits, structured logging, `/healthz` and `/readyz`, and core-loop persistence-health visibility exist. Backup/restore processes, external monitoring, error tracking, and incident ownership are not implemented/evidenced. |
| NFR-08 | **Unverified / target — not implemented.** Search is browser-side over loaded data; analytics is calculated from in-process records. A volume threshold and server/index implementation are not defined. |
| NFR-09 | **Unverified / target.** No evidence of completed accessibility, privacy/retention, financial-control, or formal UAT sign-off was found. Responsive UI is implemented but is not a completed review. |

## 8. Business rules and controls

- All displayed monetary formatting uses PHP; no multi-currency calculation policy was found.
- Finance is read-only in the frontend/API model and is limited to the financial status boundary stated in AR-04.
- Reimbursement payment/release and Requestor receipt confirmation are separate state changes.
- Initial reimbursement routing uses `reports_to` plus active delegation only. A manager change flags a pending claim; it does not silently move it.
- Notification preferences govern whether mock notification records are produced for supported event keys. The outbox is not proof of delivery.
- Local upload download checks are applied by matching the requested URL to a claim receipt, expense receipt, MOM file, or liquidation receipt. An unlinked file URL is not retrievable through this route.
- Demo seed/reset controls are Admin-only and return 404 when `DEMO_MODE=false`.

## 9. Dependencies and assumptions

| Dependency / decision | Consequence if absent |
| --- | --- |
| Entra tenant/application configuration and approved sign-in policy | NFR-01 and NFR-03 cannot be delivered. |
| Object-storage provider and credentials | Attachments remain local and non-durable. |
| Database-owner approval and migration remediation | Current live schema drift can prevent production persistence/claim creation. |
| Approved real-data master/reference data | Non-demo forms may have empty or unsuitable catalog choices. |
| Product/finance policy decisions | Conflicts in FR-04, FR-05, FR-19, FR-28, FR-30, AR-05, and AR-07 cannot be resolved by testing alone. |

## 10. Release gates

The system must not process real data until NFR-01 through NFR-04 production controls are implemented, live database migrations are authorised/applied, `DEMO_MODE=false` and demo access is disabled, durable uploads and real notification delivery are in place, and named security, database, infrastructure, privacy, financial-control, accessibility, and UAT owners sign off.

## 11. Acceptance approach

Pilot acceptance requires execution of the pass conditions in Sections 5–7 using separate demo identities and evidence of `npm run lint`, `npm test`, and `npm run build`. Production acceptance additionally requires evidence for every release gate; a successful HTTP response alone is insufficient because write-through persistence failures may be logged while the in-memory workflow continues.

## 12. Change log

| ID | Change and reason |
| --- | --- |
| FR-01 | Clarified create/draft/resubmit states; flagged absence of a general claim-edit function. |
| FR-02 | Split required from optional/defaulted line-item fields and stated validation failures. |
| FR-03 | Added MOM exception and observable type handling. |
| FR-04 | Flagged structured multi-contact/recipient conflict. |
| FR-05 | Specified MOM-link guards; flagged missing CC-email enforcement. |
| FR-06 | Defined the one verified client-export exclusion; flagged external delivery/other rules. |
| FR-07 | Defined history evidence and flagged standalone search gap. |
| FR-08 | Named actual statuses and protected transition failures. |
| FR-09 | Defined exact routing source and delegation effect. |
| FR-10 | Enumerated decisions, review-meeting actions, and error conditions. |
| FR-11 | Added direct self-approval pass/fail rule. |
| FR-12 | Corrected code/payment sequence and input rules. |
| FR-13 | Added actor, state, and completion criteria. |
| FR-14 | Added code format, expiry, lockout duration, and testable security outcomes. |
| FR-15 | Added cash-advance validations, roles, and one-active-advance rule. |
| FR-16 | Added Released prerequisite and edit lock. |
| FR-17 | Added reviewer/state/comment guards. |
| FR-18 | Defined variance calculation/classification. |
| FR-19 | Flagged direct Processing shortfall creation and PHP 1,000 cap conflict. |
| FR-20 | Added eligibility, acceptance, date-window, and expiry rules. |
| FR-21 | Added exact stale fields and no-reroute result. |
| FR-22 | Flagged manual—not scheduled—seven-day fallback. |
| FR-23 | Defined assignment-based authority behaviour. |
| FR-24 | Added hierarchy-cycle and authority recalculation/override rules. |
| FR-25 | Distinguished pilot UI/outbox functionality from external delivery. |
| FR-26 | Defined current UI-level filtering and server-side limitation. |
| FR-27 | Clarified browser-side scope dependency; flagged server-side enforcement gap. |
| FR-28 | Enumerated implemented administration and flagged inactive-data enforcement gap. |
| FR-29 | Reworded as automatic MOM company matching/pending review. |
| FR-30 | Flagged missing CSV parsing/full validation and no-DB atomicity limitation. |
| FR-31 | Added ticket ownership, Admin constraints, and status codes. |
| AR-01 | Defined amount outputs and formula. |
| AR-02 | Added explicit paid-amount assertion. |
| AR-03 | Defined separate shortfall analytics record. |
| AR-04 | Listed actual finance status sets. |
| AR-05 | Flagged incomplete cycle-time and `No data` implementation. |
| AR-06 | Defined accepted bases, default, and exclusion behaviour. |
| AR-07 | Flagged missing receipt metrics. |
| AR-08 | Defined scope-before-aggregation rules. |
| NFR-01 | Flagged unimplemented Entra/session target. |
| NFR-02 | Distinguished current checks from unaudited production coverage. |
| NFR-03 | Flagged absent Entra OID mapping. |
| NFR-04 | Defined current upload limits/access checks and missing durability controls. |
| NFR-05 | Restated verifiable persistent-process hosting constraint. |
| NFR-06 | Clarified write-through/load mode and persistence-health caveat. |
| NFR-07 | Split implemented middleware/health checks from open operations controls. |
| NFR-08 | Flagged browser/in-memory implementation and undefined threshold. |
| NFR-09 | Flagged missing formal review/sign-off evidence. |

## 13. Source and document control

Primary evidence: current backend route handlers/services, frontend API/search/export code, schema/repositories, and integration tests. Corroborating requirement sources reviewed: `docs/project-handoff/00-START-HERE.md`, `PRODUCTION-PUNCHLIST.md`, `ANALYTICS-METRIC-CONTRACT.md`, and `HIERARCHY-SYNC-DESIGN.md`. Where those sources or the original BRD differ from current code, this document marks the discrepancy instead of silently resolving it.
