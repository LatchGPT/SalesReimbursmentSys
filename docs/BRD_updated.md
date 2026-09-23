# Business Requirements Document (BRD)
## Sales Reimbursement System

| Field | Value |
|---|---|
| **Document Title** | Business Requirements Document â€” Sales Reimbursement System |
| **Organization** | Microgenesis Business System |
| **Version** | 1.0 |
| **Status** | Draft â€” Pending Stakeholder Review |
| **Date** | September 22, 2026 |
| **Prepared By** | Business Analysis Team |
| **Project Sponsor** | TBD |
| **Audience** | Internal Stakeholders (Management, IT, Finance Leadership) |

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Business Objectives](#2-business-objectives)
3. [Project Scope](#3-project-scope)
4. [Stakeholders & User Roles](#4-stakeholders--user-roles)
5. [Functional Requirements](#5-functional-requirements)
   - 5.1 [Authentication & Identity](#51-authentication--identity)
   - 5.2 [Reimbursement Claims](#52-reimbursement-claims)
   - 5.3 [Cash Advances](#53-cash-advances)
   - 5.4 [Liquidations](#54-liquidations)
   - 5.5 [Minutes of Meeting & Agreements (MoM/LOA)](#55-minutes-of-meeting--agreements-momloa)
   - 5.6 [Approval Workflow](#56-approval-workflow)
   - 5.7 [Custodian Disbursement & Processing](#57-custodian-disbursement--processing)
   - 5.8 [Finance Oversight](#58-finance-oversight)
   - 5.9 [Administration](#59-administration)
   - 5.10 [Notifications](#510-notifications)
   - 5.11 [Support Ticketing](#511-support-ticketing)
   - 5.12 [Calendar & Review Meetings](#512-calendar--review-meetings)
   - 5.13 [Receipt Archive](#513-receipt-archive)
   - 5.14 [Analytics & Reporting](#514-analytics--reporting)
6. [Non-Functional Requirements](#6-non-functional-requirements)
7. [Process / Workflow Flows](#7-process--workflow-flows)
8. [Assumptions & Constraints](#8-assumptions--constraints)
9. [Out of Scope](#9-out-of-scope)
10. [Current System Status & Demo Deployment Note](#10-current-system-status--demo-deployment-note)
11. [Glossary](#11-glossary)

---

## 1. Executive Summary

Microgenesis Business System requires a centralized, role-based **Sales Reimbursement System** to digitize, streamline, and control the end-to-end expense management process for its sales workforce. The current process relies on manual forms, email chains, and manual trackingâ€”resulting in delayed reimbursements, lost receipts, lack of audit trails, and zero financial visibility.

This document defines the business requirements for a web-based system that covers:
- Expense **reimbursement** requests with itemized receipts
- Pre-approved **cash advances** with mandatory **liquidation** accounting
- **Minutes of Meeting (MoM)** and **Letter of Agreement (LOA)** creation and archiving
- A structured **approval workflow** with delegation, escalation, and stale-approver handling
- **Disbursement processing** by designated custodians with anti-fraud payout confirmation
- **Finance-level** reporting and read-only oversight
- **Administrator controls** for master data, users, field configuration, and audit logging

The system is currently in a pre-production, client demonstration state and is being prepared for full deployment on Microsoft Azure infrastructure.

---

## 2. Business Objectives

| # | Objective | Success Criterion |
|---|---|---|
| BO-01 | Eliminate paper-based expense submission | 100% of reimbursements, cash advances, and liquidations submitted digitally |
| BO-02 | Reduce reimbursement cycle time | Average approval-to-payout time reduced by â‰¥ 50% vs. current manual process |
| BO-03 | Enforce accountability and prevent fraud | Every payout requires a release-code confirmation by the payee (anti-fraud control) |
| BO-04 | Provide real-time financial visibility | Finance and management can view live expenditure dashboards at any time |
| BO-05 | Maintain a complete audit trail | All status changes, approvals, and administrative actions are logged and searchable |
| BO-06 | Support org-chart-driven approvals | Claims route automatically to the requestor's direct manager; org changes are handled without data loss |
| BO-07 | Ensure policy compliance readiness | The system enforces configurable expense categories, high-value thresholds, and required receipts per claim |

---

## 3. Project Scope

### 3.1 In Scope

- Web-based application accessible from any modern browser
- Role-based access control for five distinct user roles
- Full reimbursement, cash advance, and liquidation lifecycle management
- Minutes of Meeting and Letter of Agreement creation, preview, and PDF export
- Approval workflow with delegation, stale-approver escalation, and approval transfer
- Custodian disbursement queue with release-code payout confirmation
- Finance-level view-only reporting and analytics
- Administrator tools: user management, master data, custom fields, audit log, company directory
- Receipt and document upload and archival
- In-app notification system
- Internal support ticketing
- Calendar-based review meeting scheduling
- Analytics dashboards per role
- Philippine Peso (â‚±) as the system currency

### 3.2 Target Deployment

The production system will be hosted on **Microsoft Azure**, served as a unified Next.js web application. Data is persisted in a **PostgreSQL database** (Supabase). File attachments (receipts, MoM uploads) are stored in a private cloud storage bucket.

---

## 4. Stakeholders & User Roles

### 4.1 Stakeholder Map

| Stakeholder Group | Interest / Concern |
|---|---|
| Sales Employees (Requestors) | Timely reimbursement, simple submission experience |
| Sales Managers / Team Leads (Approvers) | Efficient review queue, delegation during absences |
| Treasury / Cashier (Custodians) | Accurate disbursement records, anti-fraud controls |
| Finance Department | Company-wide expenditure visibility and reporting |
| IT / System Administrators | System configuration, user management, audit compliance |
| Senior Management | Strategic financial oversight, policy enforcement |

---

### 4.2 User Roles â€” Detailed Description

#### ðŸ§‘â€ðŸ’¼ Role 1: Requestor

**Who they are:** Sales employees, field staff, and any employee who incurs business expenses on behalf of the company.

**Core Responsibilities:**
- Submit reimbursement claims with itemized expenses and receipts
- Request cash advances before a business engagement
- Liquidate (account for) released cash advances post-engagement
- Propose and confirm review meeting schedules with their approver
- Enter a release code to personally confirm receipt of payment (anti-fraud)
- Track all their submissions in a personal dashboard

**Key Permissions:**
- Create, save as draft, edit (own drafts only), and submit claims
- View only their own claims, MOMs, and payout history
- Open support tickets
- Manage their own notification preferences

---

#### âœ… Role 2: Approver

**Who they are:** Managers, team leads, and any employee designated to review and decide on their direct reports' expense claims.

**Core Responsibilities:**
- Review the full details of submitted claims (line items, receipts, linked MoM)
- Approve, reject, or return claims for revision
- Confirm or decline proposed review meeting schedules
- Handle stale-approver situations (approve or transfer to a new approver)
- Delegate their approval authority to a designated colleague during absences

**Key Permissions:**
- All Requestor permissions (Approvers also submit their own expenses)
- Access to the **Approval Queue**
- Perform approval actions: Approve / Reject / Return for Revision
- Accept or decline delegation requests from other approvers
- View their direct reports' Receipt Archive

> **Important Rule:** An approver can never approve their own claimâ€”this is enforced at the system level, not just the UI.

---

#### ðŸ¦ Role 3: Custodian

**Who they are:** Treasury officers, cashiers, or finance operations staff responsible for physically releasing funds and confirming refunds.

**Core Responsibilities:**
- Process claims that have been approved, moving them into the disbursement queue
- Generate a unique **release code** for each claim and communicate it to the requestor (out-of-band)
- Select the payment method (Cash, GCash, Bank Transfer, Check) and mark the claim **Ready for Claim**
- Track and record when a liquidation results in a **Refund Due** (collect the shortfall from the requestor)
- View transaction history and queue analytics

**Key Permissions:**
- Access to the **Processing Queue**
- Generate release codes and set payment methods
- View **Transaction History** and **Analytics** for their queue
- **Cannot** create claims, approve or reject requests, or change administrative configuration

---

#### ðŸ“Š Role 4: Finance

**Who they are:** Finance analysts, controllers, or finance leadership who require company-wide visibility for reporting and complianceâ€”without the ability to alter any records.

**Core Responsibilities:**
- Monitor all financial records from the approval stage onward
- Filter and analyze expenditure by type, status, client, department, location, and date
- Review the receipt archive and transaction history
- Access analytics dashboards for expenditure, department, client, category, and workflow metrics

**Key Permissions (View-Only):**
- **Financial Records**: all claims, cash advances, liquidations from approval onward
- **Receipt Archive**: all receipts and OR numbers
- **Transaction History**: all completed payouts
- **Analytics**: full company-wide dashboards

**Explicitly Excluded:**
- Creating or editing any claim or record
- Approving, rejecting, or returning requests
- Processing disbursements or generating release codes
- Changing any administrative configuration
- Viewing draft claims, pending submissions, or rejected/unreviewed records below the approval threshold
- Viewing personal MoMs not linked to a submitted claim

---

#### âš™ï¸ Role 5: Admin

**Who they are:** System administrators and IT staff responsible for configuring and maintaining the system.

**Core Responsibilities:**
- Manage all user accounts (roles, departments, reporting structure/org chart, employment status)
- Maintain master data catalogs used across forms
- Define custom form fields for MoM and claim submission
- Manage the company directory used in MoM creation
- Import historical claim data
- Review the system-wide audit log
- Monitor mock email/Teams outbox
- Access full admin reporting and CSV exports
- Manually trigger stale-approver escalation checks

**Admin Screens Summary:**

| Screen | Purpose |
|---|---|
| **User Accounts** | Create, edit, deactivate users; set roles, departments, managers |
| **Master Data Admin** | Manage Departments, Cost Centers, Business Units, Branches, Project Codes, Vendors |
| **Field Definitions** | Add/edit custom fields on MoM and claim forms (type, label, required, catalog source) |
| **Company Directory** | Maintain client/company list used in MoM creation |
| **Historical Import** | Bulk CSV import of legacy claims |
| **Admin Reporting** | Org-wide charts and CSV export |
| **Audit Log** | Searchable activity log covering all workflow, user, and master-data events |
| **System Emails** | View and search the mock email/Teams outbox |

---

## 5. Functional Requirements

### 5.1 Authentication & Identity

| ID | Requirement |
|---|---|
| AUTH-01 | The system shall authenticate users via **Microsoft Entra ID (Azure AD) OIDC** in production |
| AUTH-02 | Authentication shall use server-managed sessions; no credentials shall be stored in the browser |
| AUTH-03 | Each user session shall carry the authenticated user's role, department, and manager assignment |
| AUTH-04 | The system shall support a **demo login mode** (account picker without passwords) for internal demonstrations and UAT only, controlled by a server-side environment flag |
| AUTH-05 | Users shall be able to sign out from any page |
| AUTH-06 | An approver's role permissions shall be additiveâ€”they retain all Requestor capabilities |

---

### 5.2 Reimbursement Claims

| ID | Requirement |
|---|---|
| RC-01 | The system shall provide a **multi-step claim submission wizard** with the following steps: (1) Minutes of Meeting, (2) Details & Expense Line Items, (3) Schedule Review Meeting, (4) Review & Submit |
| RC-02 | The system shall support **saving a claim as Draft** at any step; drafts are private to the requestor |
| RC-03 | Each expense line item shall capture: date, category, vendor, payment method, amount (â‚±), and a receipt image or PDF |
| RC-04 | Receipt upload shall be **mandatory** before a claim can be submitted |
| RC-05 | The system shall support **configurable expense categories** managed by an Admin |
| RC-06 | The system shall support **configurable payment methods** (e.g., Cash, GCash, Bank Transfer, Check) managed by Admin |
| RC-07 | Claims exceeding a configurable **high-value threshold** shall be automatically flagged for heightened review |
| RC-08 | The system shall support **custom form fields** on the claim form (e.g., account type, category, department), configurable by Admin |
| RC-09 | Each submitted claim shall receive a unique **claim number** |
| RC-10 | A requestor shall be able to **revise and resubmit** a returned claim; the revised claim routes back to the same approver |
| RC-11 | A requestor shall be able to **view the full status history** of any of their claims |
| RC-12 | All amounts shall be denominated in **Philippine Peso (â‚±)** |

---

### 5.3 Cash Advances

| ID | Requirement |
|---|---|
| CA-01 | A requestor shall be able to submit a **Cash Advance** request specifying an amount and purpose |
| CA-02 | Cash advance submission does not require expense line items or receipts at the time of request |
| CA-03 | An approved cash advance shall follow the same approval workflow as a reimbursement (via the approver queue) |
| CA-04 | Upon approval, the claim is routed to the **Custodian** for fund release |
| CA-05 | Once the custodian releases funds, the cash advance status becomes **Released** |
| CA-06 | A released cash advance **requires a liquidation** to be filed once the funds are spent |

---

### 5.4 Liquidations

| ID | Requirement |
|---|---|
| LQ-01 | A requestor shall be able to submit a **Liquidation** against a specific Released cash advance |
| LQ-02 | Liquidation shall require itemized expense line items with receipts, identical in structure to a reimbursement |
| LQ-03 | The system shall **automatically calculate the variance** between the cash advance amount and total amount spent |
| LQ-04 | Three variance outcomes shall be supported: **Settled** (exact), **Refund Due** (spent less), **Reimbursement Due** (spent more) |
| LQ-05 | A **Reimbursement Due** variance shall automatically generate a follow-up reimbursement claim for the difference |
| LQ-06 | A **Refund Due** variance shall route to the custodian for collection from the requestor |

---

### 5.5 Minutes of Meeting & Agreements (MoM/LOA)

| ID | Requirement |
|---|---|
| MOM-01 | The system shall support creation of **Minutes of Meeting (MoM)** and **Letter of Agreement (LOA)** documents |
| MOM-02 | MoMs can be created using a **system template** or by **uploading an existing document** |
| MOM-03 | MoM fields shall include: client (from company directory), meeting date/time, location, purpose, discussion summary, agreements, action items, and participants (internal and external) |
| MOM-04 | The system shall support **multiple contact persons** on a MoM, each with their designation |
| MOM-05 | The system shall support **multiple CC email recipients** for the client copy of the MoM |
| MOM-06 | The system shall generate **separate internal and client-copy previews**; the client copy omits internal-only fields (e.g., Type of Account) |
| MOM-07 | MoM documents shall be exportable as **PDF** |
| MOM-08 | A **"Send to Client"** action shall record an outbox event and mark the MoM as completed; this requires a real email integration in production |
| MOM-09 | MoMs shall be **editable after completion** to allow for client-requested corrections |
| MOM-10 | Custom fields on the MoM form shall be configurable by an Admin |

---

### 5.6 Approval Workflow

| ID | Requirement |
|---|---|
| APW-01 | Submitted claims shall **automatically route** to the requestor's direct manager (as configured in the org chart) |
| APW-02 | An approver shall be able to **Approve**, **Reject**, or **Return for Revision** any claim in their queue |
| APW-03 | **Rejection** requires a mandatory comment and permanently ends the claim |
| APW-04 | **Return for Revision** requires a mandatory comment and sends the claim back to the requestor |
| APW-05 | An approver shall be able to **Delegate** their approval authority to another approver for a specified date range |
| APW-06 | Delegated claims shall automatically route to the delegate for the duration of the delegation window |
| APW-07 | The system shall detect **stale approvals** when a requestor's manager has changed after a claim was submitted |
| APW-08 | An approver shall be able to **Transfer** a stale claim to the newly suggested approver |
| APW-09 | Stale-approver escalation shall also run automatically on a scheduled (hourly) basis |
| APW-10 | An admin shall be able to **manually trigger** the stale-approver escalation check |
| APW-11 | An approver shall **never be permitted** to approve their own claims |
| APW-12 | Delegation requests shall show Accept / Decline options to the recipient |

---

### 5.7 Custodian Disbursement & Processing

| ID | Requirement |
|---|---|
| CUS-01 | All approved claims shall appear in the **Custodian Processing Queue** |
| CUS-02 | The custodian shall **generate a unique release code** for each claim |
| CUS-03 | The custodian shall **select a payment method** and mark the claim **Ready for Claim** |
| CUS-04 | A claim is **not considered complete** until the requestor personally enters the release code on the Payouts screen |
| CUS-05 | The release code entry shall function as an **anti-fraud confirmation** that the funds reached the intended recipient |
| CUS-06 | Release codes shall have an **expiry time** and shall lock after a configured number of failed attempts |
| CUS-07 | The custodian's **Transaction History** shall record every completed payout with date, method, and reference |
| CUS-08 | Liquidations resulting in a **Refund Due** shall appear in the custodian queue for collection management |

---

### 5.8 Finance Oversight

| ID | Requirement |
|---|---|
| FIN-01 | Finance users shall have **read-only access** to all financial records from the approval stage onward |
| FIN-02 | Finance users shall be able to **filter** records by claim type, status, client, location, department, and date range |
| FIN-03 | Finance users shall have access to the **Receipt Archive** with amount and category filtering |
| FIN-04 | Finance users shall have access to **Transaction History** for finalized activity |
| FIN-05 | Finance users shall have access to **Analytics dashboards** for expenditure, department, client, category, and workflow views |
| FIN-06 | Finance users shall **not** see drafts, pending submissions, pre-Finance rejections, or unreviewed liquidations |
| FIN-07 | Personal MoMs shall remain private to Finance unless linked to a submitted claim |

---

### 5.9 Administration

| ID | Requirement |
|---|---|
| ADM-01 | Admins shall be able to **create, edit, and deactivate** any user account |
| ADM-02 | Admins shall be able to set a user's **role, department, manager (org chart)**, employment status, and reimbursement-approval authority |
| ADM-03 | Changing a user's manager shall trigger **stale-approver handling** for any in-flight claims |
| ADM-04 | Admins shall maintain six **Master Data catalogs**: Departments, Cost Centers, Business Units, Branches, Project Codes, Vendors |
| ADM-05 | Deactivating a master data item shall remove it from future form dropdowns while **preserving it on historical records** |
| ADM-06 | Admins shall be able to define **custom form fields** for MoM and claim forms (label, input type, required/optional, applicable claim types, master data source) |
| ADM-07 | Admins shall maintain a **Company Directory** of clients with address, contact info, and auto-fill defaults |
| ADM-08 | The system shall provide an **Audit Log** that is searchable and covers all workflow, user, and master-data events |
| ADM-09 | Admins shall have access to **Admin Reporting** with org-wide charts and CSV export |
| ADM-10 | The system shall support **Historical Import** of past claims via CSV |
| ADM-11 | Admins shall be able to configure **system settings**: expense categories, payment methods, high-value threshold, and per-category limits |

---

### 5.10 Notifications

| ID | Requirement |
|---|---|
| NOT-01 | The system shall generate **in-app notifications** for relevant workflow events: claim submitted, approved, returned, ready for payout, and delegation activity |
| NOT-02 | A **notification badge** on the bell icon shall display the count of unread notifications |
| NOT-03 | Users shall be able to configure **notification preferences** per event category (in-app, email) |
| NOT-04 | Notification preferences shall **persist across sessions** |
| NOT-05 | The system shall send **email and/or Microsoft Teams** notifications for key events in production (requires email/Teams integration) |

---

### 5.11 Support Ticketing

| ID | Requirement |
|---|---|
| SUP-01 | Any user shall be able to **open a support ticket** with a subject, description, and priority (Low / Medium / High) |
| SUP-02 | A ticket may optionally be **linked to a specific claim** |
| SUP-03 | Both the requester and the assigned admin can **reply within the ticket thread** |
| SUP-04 | Users shall only see **their own tickets**; admins see all tickets |
| SUP-05 | Support ticket status shall progress through: **Open â†’ In Progress â†’ Resolved** |

---

### 5.12 Calendar & Review Meetings

| ID | Requirement |
|---|---|
| CAL-01 | When submitting a reimbursement, the requestor shall **propose a review meeting date and time** with their approver |
| CAL-02 | The approver shall **confirm or decline** the proposed meeting from the Calendar screen |
| CAL-03 | If declined, the approver shall provide a reason and the requestor shall be prompted to **propose a new time** |
| CAL-04 | The **Calendar screen** shall display upcoming review meetings in a monthly view |

---

### 5.13 Receipt Archive

| ID | Requirement |
|---|---|
| RA-01 | The **Receipt Archive** shall store all receipts and official receipts (OR numbers) associated with claims |
| RA-02 | Requestors shall see their own receipts; Approvers see their team's receipts; Finance and Admin have company-wide access |
| RA-03 | The archive shall support **search by keywords, amount, category, date, and status** |
| RA-04 | Approvers shall be able to **group results by Team Member or by Client** for reconciliation |

---

### 5.14 Analytics & Reporting

| ID | Requirement |
|---|---|
| ANA-01 | Each role shall have a **role-appropriate dashboard** with real KPIs (not hardcoded values) |
| ANA-02 | Custodian analytics shall show queue shape, disbursement throughput, and payment method breakdown |
| ANA-03 | Finance analytics shall include expenditure by department, client, category, and workflow-stage views |
| ANA-04 | Admin reporting shall cover the entire organization and support **CSV export** |
| ANA-05 | All analytics shall reflect **live database state**, not cached or stale data |

---

## 6. Non-Functional Requirements

### 6.1 Performance

| ID | Requirement |
|---|---|
| NFR-01 | Page load time (on an average corporate network) shall not exceed **3 seconds** for all main screens |
| NFR-02 | The system shall support **concurrent use** by all active employees without degradation |
| NFR-03 | File upload (receipts, MoM documents) shall support files up to **10 MB** |

### 6.2 Security

| ID | Requirement |
|---|---|
| NFR-04 | Production authentication shall use **Microsoft Entra ID OIDC** with server-managed sessions |
| NFR-05 | No secrets, database URLs, or session tokens shall be exposed to the browser |
| NFR-06 | Database access shall be restricted to the backend service layer; direct database access from the browser is prohibited |
| NFR-07 | File storage shall use a **private bucket** with signed, expiring access URLs |
| NFR-08 | Row-Level Security (RLS) policies shall be defined and enforced at the database layer before go-live |
| NFR-09 | Release codes shall expire and lock after failed attempts to prevent brute-force payout fraud |

### 6.3 Availability & Reliability

| ID | Requirement |
|---|---|
| NFR-10 | The system shall target **99.5% uptime** during business hours (Mondayâ€“Friday, 8 AMâ€“6 PM PHT) |
| NFR-11 | The system shall expose a **health check endpoint** (`/readyz`) for monitoring database reachability and persistence health |
| NFR-12 | The system shall support **point-in-time recovery (PITR)** of the production database |

### 6.4 Usability

| ID | Requirement |
|---|---|
| NFR-13 | The application shall be accessible via any **modern web browser** (Chrome, Edge, Firefox, Safari) |
| NFR-14 | The interface shall be **responsive** and usable on desktop and tablet form factors |
| NFR-15 | Role-based navigation shall display **only the screens relevant to the user's role** |
| NFR-16 | Sidebar navigation items shall display **live count badges** (pending approvals, unread notifications, items in queue) |

### 6.5 Auditability & Compliance

| ID | Requirement |
|---|---|
| NFR-17 | All workflow state changes, administrative actions, and user management events shall be recorded in the **Audit Log** |
| NFR-18 | The audit log shall be **immutable**â€”no user or admin shall be able to delete or edit log entries |
| NFR-19 | The system shall maintain a **status history** for every claim, cash advance, liquidation, and delegation |

---

## 7. Process / Workflow Flows

### 7.1 Reimbursement Claim Lifecycle

```
[Requestor]          [Approver]           [Custodian]         [Requestor]
     |                     |                    |                   |
  Submit Claim â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€> Pending Approval  |                   |
     |                     |                    |                   |
     |              Approve / Reject /           |                   |
     |              Return for Revision          |                   |
     |                     |                    |                   |
     |              [If Approved]                |                   |
     |                     â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€> Processing           |
     |                                          |                   |
     |                                   Generate Release Code      |
     |                                   Set Payment Method         |
     |                                   Mark Ready for Claim â”€â”€â”€â”€â”€â”€>
     |                                          |                   |
     |                                          |           Enter Release Code
     |                                          |                   |
     |                                          |            [Claim Completed]
```

### 7.2 Cash Advance & Liquidation Lifecycle

```
[Requestor]          [Approver]           [Custodian]         [Requestor]
     |                     |                    |                   |
  Request Cash Advance â”€â”€â”€> Pending Approval    |                   |
     |                     |                    |                   |
     |              Approve / Reject             |                   |
     |                     |                    |                   |
     |              [If Approved]                |                   |
     |                     â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€> Processing           |
     |                                          |                   |
     |                                    Release Funds             |
     |                                    (Status: Released) â”€â”€â”€â”€â”€â”€> 
     |                                          |                   |
     |             [Requestor spends funds]     |                   |
     |                     |                    |                   |
  Submit Liquidation â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€>
     |                     |                    |                   |
     |               [Review]                   |                   |
     |                                          |                   |
     | Variance = Settled â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€> Closed               |
     | Variance = Refund Due â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€> Custodian collects refund
     | Variance = Reimbursement Due â”€â”€â”€â”€â”€â”€â”€â”€> Auto-generate follow-up claim
```

### 7.3 Approval Delegation Flow

```
[Approver A]                           [Approver B]
     |                                      |
  Request Delegation (date range) â”€â”€â”€â”€â”€â”€â”€â”€â”€>|
     |                              Accept / Decline
     |                                      |
     |              [If Accepted]           |
     |                                      |
  Claims route to B for the date range â”€â”€â”€â”€â”€>
     |                                      |
     |              [Date range ends]       |
     |                                      |
  Claims route back to A automatically      |
```

### 7.4 Stale Approver Handling

```
[System / Org Chart Change]
         |
  Manager of Requestor changes
         |
  Existing in-flight claims remain with OLD approver
         |
  System detects stale approver (hourly cron or manual trigger)
         |
  "Stale Approvals Detected" banner shown to OLD approver
         |
  Old Approver can: Review it themselves
                 OR Transfer to new suggested approver
```

---

## 8. Assumptions & Constraints

### Assumptions

| # | Assumption |
|---|---|
| A-01 | All users will have valid Microsoft organizational accounts (Azure AD) in the production environment |
| A-02 | The organization's org chart (manager hierarchy) will be maintained and kept current in the system |
| A-03 | Expense categories and payment methods reflect the organization's existing finance policies |
| A-04 | Receipts and MoM documents may be in image (JPG, PNG) or PDF format |
| A-05 | All monetary amounts are denominated in **Philippine Peso (â‚± / PHP)** |
| A-06 | The organization operates within Philippine jurisdiction for financial and tax purposes |
| A-07 | Only one level of approval is required per claim (the requestor's direct manager) |
| A-08 | Custodians will communicate release codes to requestors via existing out-of-band channels (phone, in-person, chat) |

### Constraints

| # | Constraint |
|---|---|
| C-01 | The production system must integrate with **Microsoft Entra ID** for authentication |
| C-02 | Database and file storage shall use **Supabase (PostgreSQL + Storage)** |
| C-03 | The web application is deployed on **Microsoft Azure / Vercel** |
| C-04 | The system shall not expose the direct database migration URL at runtime |
| C-05 | Schema changes require a deliberate, human-approved migration step â€” they must never run automatically on deployment |
| C-06 | The legacy Render rollback service must remain operational until the production Vercel deployment is fully verified |
| C-07 | The system must not expose any database, session, or service-role secrets in browser-visible environment variables |

---

## 9. Out of Scope

The following items are **explicitly outside** the scope of the current version:

| Item | Notes |
|---|---|
| Mobile native applications (iOS / Android) | Tablet-responsive web only |
| Live email delivery and Microsoft Teams integration | Targeted for a future integration phase; currently a mock outbox |
| Multi-currency support | System is PHP-only in this version |
| Payroll system integration | Reimbursements are processed as standalone cash payouts |
| ERP / accounting system integration (e.g., SAP, Oracle) | Not in current scope |
| Automated PDF email delivery of MoM to client | Currently records a mock event; full delivery is a future integration |
| Real-time bank transfer initiation | Payment method is recorded; actual transfer happens outside the system |
| Policy compliance tab / automated expense policy enforcement engine | Identified as future scope during requirements discovery |
| Biometric or 2FA beyond Azure AD standard policies | Delegated to Azure AD configuration |
| Server-side paginated audit log / system emails | Currently client-side pagination; server-side pagination is a future improvement |

---

## 10. Current System Status & Demo Deployment Note

> **Note to Stakeholders:** The system described in this document is currently deployed in a **pre-production, client demonstration state**. This means:

| Feature | Current Demo State | Production Target |
|---|---|---|
| Authentication | Account picker (no password) for demo convenience | Microsoft Entra ID OIDC |
| Email / Teams delivery | Mock outbox â€” no actual emails sent | Real email/Teams integration |
| Database Row-Level Security | Not yet enforced (backend-only access) | RLS policies to be defined |
| Release code payout | Functional and tested | Fully production-ready |
| Historical Import | Simulated (in-memory only) | Durable database persistence |
| Demo mode | `DEMO_MODE=true` â€” auto-generates demonstration data | `DEMO_MODE=false` with live data |
| Deployment target | Vercel (Next.js) + Supabase | Microsoft Azure |

The demo login and non-production features exist solely for the purpose of demonstrating the system to the client prior to full deployment. All core business workflows (submit â†’ approve â†’ process â†’ payout) are functional and tested.

---

## 11. Glossary

| Term | Definition |
|---|---|
| **BRD** | Business Requirements Document |
| **Claim** | Any request for reimbursement, cash advance, or liquidation submitted by a requestor |
| **Cash Advance** | A pre-approved disbursement of funds to a requestor before expenses are incurred |
| **Custodian** | The treasury/cashier role responsible for releasing approved funds and collecting refunds |
| **Draft** | A claim saved but not yet submitted; visible only to the requestor |
| **High-Value Claim** | A claim exceeding the administrator-configured monetary threshold; flagged for heightened review |
| **Liquidation** | The accounting submission that reconciles a released cash advance against actual expenses |
| **LOA** | Letter of Agreement â€” a formal agreement document created within the MoM module |
| **MoM** | Minutes of Meeting â€” a structured record of a client or business meeting |
| **OR Number** | Official Receipt number; required documentation for tax-compliant expense items |
| **Org Chart** | The hierarchy of reporting relationships (who reports to whom) used to route claims |
| **PHP / â‚±** | Philippine Peso â€” the currency used throughout the system |
| **Release Code** | A unique short code generated by the custodian and entered by the requestor to confirm receipt of payment (anti-fraud control) |
| **Requestor** | An employee who submits expense claims |
| **RLS** | Row-Level Security â€” a database-level access control mechanism |
| **Stale Approver** | A situation where a requestor's manager has changed after a claim was submitted, leaving the claim assigned to the old manager |
| **Variance** | The difference between a cash advance amount and actual liquidation amount; may result in Settled, Refund Due, or Reimbursement Due |
| **Delegation** | The act of an approver temporarily transferring their approval authority to a designated colleague |
| **OIDC** | OpenID Connect â€” the authentication protocol used with Microsoft Entra ID |
| **PITR** | Point-in-Time Recovery â€” the ability to restore a database to any prior moment |

---

*End of Document*

---

**Document Control**

| Version | Date | Author | Changes |
|---|---|---|---|
| 1.0 | September 22, 2026 | Business Analysis Team | Initial draft |

