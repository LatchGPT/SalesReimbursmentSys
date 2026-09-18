-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateSequence
-- Prisma introspection does not model this application-managed PostgreSQL
-- sequence. Keep it in the baseline because claim-number allocation uses
-- nextval()/setval() directly and a fresh database must reproduce it.
CREATE SEQUENCE "claim_number_seq"
    INCREMENT BY 1
    MINVALUE 1
    START WITH 123
    CACHE 1;

-- CreateEnum
CREATE TYPE "approval_decision" AS ENUM ('Approved', 'Rejected', 'Returned');

-- CreateEnum
CREATE TYPE "cash_advance_status" AS ENUM ('Draft', 'Submitted', 'Approved', 'Rejected', 'Released', 'Liquidated');

-- CreateEnum
CREATE TYPE "claim_status" AS ENUM ('Draft', 'Pending Approval', 'Approved', 'Processing', 'Ready for Claim', 'Completed', 'Rejected', 'Returned');

-- CreateEnum
CREATE TYPE "delegation_status" AS ENUM ('Pending', 'Active', 'Declined', 'Expired', 'Cancelled');

-- CreateEnum
CREATE TYPE "employment_status" AS ENUM ('Active', 'Inactive');

-- CreateEnum
CREATE TYPE "field_entity" AS ENUM ('mom', 'claim');

-- CreateEnum
CREATE TYPE "field_input_type" AS ENUM ('text', 'number', 'dropdown', 'date', 'textarea');

-- CreateEnum
CREATE TYPE "liquidation_status" AS ENUM ('Draft', 'Submitted', 'ReturnedForRevision', 'Reviewed', 'Closed');

-- CreateEnum
CREATE TYPE "liquidation_variance_type" AS ENUM ('Settled', 'RefundDue', 'ReimbursementDue');

-- CreateEnum
CREATE TYPE "minutes_source" AS ENUM ('Template', 'Uploaded');

-- CreateEnum
CREATE TYPE "mom_document_type" AS ENUM ('MoM', 'LOA');

-- CreateEnum
CREATE TYPE "mom_status" AS ENUM ('Draft', 'Completed');

-- CreateEnum
CREATE TYPE "review_meeting_status" AS ENUM ('PendingConfirmation', 'Confirmed', 'DeclineRequested', 'Completed');

-- CreateEnum
CREATE TYPE "support_priority" AS ENUM ('Low', 'Medium', 'High');

-- CreateEnum
CREATE TYPE "support_status" AS ENUM ('Open', 'In Progress', 'Resolved');

-- CreateEnum
CREATE TYPE "user_role" AS ENUM ('Requestor', 'Approver', 'Custodian', 'Finance', 'Admin');

-- CreateTable
CREATE TABLE "approvals" (
    "id" TEXT NOT NULL,
    "claim_id" TEXT NOT NULL,
    "approver_id" TEXT NOT NULL,
    "decision" "approval_decision" NOT NULL,
    "comment" TEXT NOT NULL DEFAULT '',
    "timestamp" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "approvals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "approver_delegations" (
    "id" TEXT NOT NULL,
    "approver_id" TEXT NOT NULL,
    "delegate_id" TEXT NOT NULL,
    "start_date" TEXT NOT NULL,
    "end_date" TEXT NOT NULL,
    "status" "delegation_status" NOT NULL,
    "decline_reason" TEXT,
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "approver_delegations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "branches" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "branches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "business_units" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "business_units_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cash_advances" (
    "id" TEXT NOT NULL,
    "requestor_id" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "purpose" TEXT NOT NULL,
    "mom_id" TEXT,
    "approver_id" TEXT NOT NULL,
    "released_by" TEXT,
    "release_date" TIMESTAMPTZ(6),
    "release_reference" TEXT,
    "release_method" TEXT,
    "status" "cash_advance_status" NOT NULL,
    "reminder_sent" BOOLEAN DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approved_at" TIMESTAMPTZ(6),
    "paid_amount" DECIMAL(12,2),

    CONSTRAINT "cash_advances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "claims" (
    "id" TEXT NOT NULL,
    "claim_number" TEXT,
    "requestor_id" TEXT NOT NULL,
    "current_approver_id" TEXT NOT NULL,
    "original_approver_id" TEXT,
    "mom_id" TEXT,
    "status" "claim_status" NOT NULL,
    "total_amount" DECIMAL(12,2) NOT NULL,
    "expense_category" TEXT,
    "receipt_url" TEXT,
    "remarks" TEXT,
    "supporting_documents" TEXT,
    "payment_reference" TEXT,
    "payment_method" TEXT,
    "release_code" TEXT,
    "flagged_high_value" BOOLEAN DEFAULT false,
    "approved_at" TIMESTAMPTZ(6),
    "processed_by" TEXT,
    "processing_date" TIMESTAMPTZ(6),
    "source_liquidation_id" TEXT,
    "import_batch_id" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approver_stale_since" TIMESTAMPTZ(6),
    "pending_transfer_to" TEXT,
    "approver_stale_reason" TEXT,
    "escalated_to_admin" BOOLEAN DEFAULT false,
    "approved_amount" DECIMAL(12,2),
    "paid_amount" DECIMAL(12,2),
    "paid_at" TIMESTAMPTZ(6),
    "claim_type" TEXT NOT NULL DEFAULT 'Reimbursement',
    "release_code_expires_at" TIMESTAMPTZ(6),
    "release_code_attempts" INTEGER DEFAULT 0,
    "release_code_locked_until" TIMESTAMPTZ(6),

    CONSTRAINT "claims_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "companies" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "industry" TEXT,
    "notes" TEXT,
    "address" TEXT,
    "business_unit_id" TEXT,
    "cost_center_id" TEXT,
    "default_department_id" TEXT,
    "currency" TEXT,
    "tax_id" TEXT,
    "contact_person" TEXT,
    "contact_email" TEXT,
    "default_approver_id" TEXT,
    "pending_review" BOOLEAN NOT NULL DEFAULT false,
    "created_by" TEXT,

    CONSTRAINT "companies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cost_centers" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cost_centers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "departments" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "departments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "emails" (
    "id" TEXT NOT NULL,
    "recipient_id" TEXT NOT NULL,
    "from" TEXT NOT NULL,
    "to" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "timestamp" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "emails_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "expense_line_items" (
    "id" TEXT NOT NULL,
    "claim_id" TEXT NOT NULL,
    "expense_date" TEXT NOT NULL,
    "vendor" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "payment_method" TEXT NOT NULL,
    "business_purpose" TEXT NOT NULL,
    "receipt_url" TEXT,
    "or_number" TEXT,

    CONSTRAINT "expense_line_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "field_definitions" (
    "id" TEXT NOT NULL,
    "entity" "field_entity" NOT NULL,
    "applicable_claim_types" TEXT[],
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "input_type" "field_input_type" NOT NULL,
    "required" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "default_value" TEXT,
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "options" TEXT[],
    "master_data_entity" TEXT,
    "allow_other" BOOLEAN DEFAULT false,
    "validation" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "field_definitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "import_batches" (
    "id" TEXT NOT NULL,
    "admin_id" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "total_records" INTEGER NOT NULL,
    "imported_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "import_batches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "last_seen" (
    "user_id" TEXT NOT NULL,
    "section" TEXT NOT NULL,
    "seen_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "last_seen_user_id_section_pk" PRIMARY KEY ("user_id","section")
);

-- CreateTable
CREATE TABLE "liquidation_line_items" (
    "id" TEXT NOT NULL,
    "liquidation_id" TEXT NOT NULL,
    "expense_date" TEXT NOT NULL,
    "vendor" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "payment_method" TEXT NOT NULL,
    "business_purpose" TEXT NOT NULL,
    "receipt_url" TEXT,
    "attachment_type" TEXT,
    "or_number" TEXT,

    CONSTRAINT "liquidation_line_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "liquidations" (
    "id" TEXT NOT NULL,
    "cash_advance_id" TEXT NOT NULL,
    "requestor_id" TEXT NOT NULL,
    "total_spent" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "variance_amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "variance_type" "liquidation_variance_type" NOT NULL,
    "status" "liquidation_status" NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "refund_method" TEXT,

    CONSTRAINT "liquidations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "moms" (
    "id" TEXT NOT NULL,
    "claim_id" TEXT,
    "requestor_id" TEXT,
    "client" TEXT,
    "contact_person" TEXT,
    "contact_person_email" TEXT,
    "meeting_date" TEXT NOT NULL,
    "meeting_time" TEXT,
    "location" TEXT,
    "purpose" TEXT,
    "discussion" TEXT,
    "agreements" TEXT,
    "action_items" TEXT,
    "prepared_by" TEXT,
    "prepared_by_department" TEXT,
    "prepared_by_job_title" TEXT,
    "summary" TEXT,
    "file_url" TEXT,
    "file_name" TEXT,
    "status" "mom_status" NOT NULL DEFAULT 'Draft',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "minutes_source" "minutes_source" NOT NULL DEFAULT 'Template',
    "meeting_type" TEXT,
    "participants_internal" TEXT,
    "participants_external" TEXT,
    "custom_fields" TEXT,
    "cc_client" BOOLEAN NOT NULL DEFAULT false,
    "document_type" "mom_document_type" NOT NULL DEFAULT 'MoM',

    CONSTRAINT "moms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_codes" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_codes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "review_meetings" (
    "id" TEXT NOT NULL,
    "claim_id" TEXT NOT NULL,
    "requestor_id" TEXT NOT NULL,
    "approver_id" TEXT NOT NULL,
    "meeting_date" TEXT NOT NULL,
    "meeting_time" TEXT NOT NULL,
    "status" "review_meeting_status" NOT NULL,
    "decline_reason" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "review_meetings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "status_histories" (
    "id" TEXT NOT NULL,
    "claim_id" TEXT,
    "cash_advance_id" TEXT,
    "liquidation_id" TEXT,
    "delegation_id" TEXT,
    "user_id" TEXT,
    "master_data_key" TEXT,
    "master_data_id" TEXT,
    "old_status" TEXT NOT NULL,
    "new_status" TEXT NOT NULL,
    "changed_by" TEXT NOT NULL,
    "reason" TEXT,
    "timestamp" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "status_histories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "support_request_messages" (
    "id" TEXT NOT NULL,
    "request_id" TEXT NOT NULL,
    "sender_id" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "timestamp" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "support_request_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "support_requests" (
    "id" TEXT NOT NULL,
    "requestor_id" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "related_entity_type" TEXT,
    "related_entity_id" TEXT,
    "priority" "support_priority" NOT NULL,
    "status" "support_status" NOT NULL,
    "assigned_admin_id" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "support_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "system_settings" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "expense_categories" TEXT[],
    "high_value_threshold" DECIMAL(12,2) NOT NULL,
    "payment_methods" TEXT[],
    "category_limits" TEXT,

    CONSTRAINT "system_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" "user_role" NOT NULL,
    "department" TEXT NOT NULL,
    "job_title" TEXT,
    "reports_to" TEXT,
    "employment_status" "employment_status" DEFAULT 'Active',
    "can_approve_reimbursements" BOOLEAN DEFAULT false,
    "notification_prefs" TEXT,
    "avatar_url" TEXT,
    "entra_object_id" TEXT,
    "user_principal_name" TEXT,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vendors" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vendors_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "claims_claim_number_unique" ON "claims"("claim_number");

-- CreateIndex
CREATE UNIQUE INDEX "companies_name_unique" ON "companies"("name");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_unique" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_entra_object_id_unique" ON "users"("entra_object_id");

-- CreateIndex
CREATE UNIQUE INDEX "users_user_principal_name_unique" ON "users"("user_principal_name");

-- AddForeignKey
ALTER TABLE "approvals" ADD CONSTRAINT "approvals_approver_id_users_id_fk" FOREIGN KEY ("approver_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "approvals" ADD CONSTRAINT "approvals_claim_id_claims_id_fk" FOREIGN KEY ("claim_id") REFERENCES "claims"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "approver_delegations" ADD CONSTRAINT "approver_delegations_approver_id_users_id_fk" FOREIGN KEY ("approver_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "approver_delegations" ADD CONSTRAINT "approver_delegations_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "approver_delegations" ADD CONSTRAINT "approver_delegations_delegate_id_users_id_fk" FOREIGN KEY ("delegate_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "cash_advances" ADD CONSTRAINT "cash_advances_approver_id_users_id_fk" FOREIGN KEY ("approver_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "cash_advances" ADD CONSTRAINT "cash_advances_mom_id_moms_id_fk" FOREIGN KEY ("mom_id") REFERENCES "moms"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "cash_advances" ADD CONSTRAINT "cash_advances_released_by_users_id_fk" FOREIGN KEY ("released_by") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "cash_advances" ADD CONSTRAINT "cash_advances_requestor_id_users_id_fk" FOREIGN KEY ("requestor_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "claims" ADD CONSTRAINT "claims_current_approver_id_users_id_fk" FOREIGN KEY ("current_approver_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "claims" ADD CONSTRAINT "claims_import_batch_id_import_batches_id_fk" FOREIGN KEY ("import_batch_id") REFERENCES "import_batches"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "claims" ADD CONSTRAINT "claims_mom_id_moms_id_fk" FOREIGN KEY ("mom_id") REFERENCES "moms"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "claims" ADD CONSTRAINT "claims_original_approver_id_users_id_fk" FOREIGN KEY ("original_approver_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "claims" ADD CONSTRAINT "claims_pending_transfer_to_users_id_fk" FOREIGN KEY ("pending_transfer_to") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "claims" ADD CONSTRAINT "claims_processed_by_users_id_fk" FOREIGN KEY ("processed_by") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "claims" ADD CONSTRAINT "claims_requestor_id_users_id_fk" FOREIGN KEY ("requestor_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "claims" ADD CONSTRAINT "claims_source_liquidation_id_liquidations_id_fk" FOREIGN KEY ("source_liquidation_id") REFERENCES "liquidations"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "companies" ADD CONSTRAINT "companies_business_unit_id_business_units_id_fk" FOREIGN KEY ("business_unit_id") REFERENCES "business_units"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "companies" ADD CONSTRAINT "companies_cost_center_id_cost_centers_id_fk" FOREIGN KEY ("cost_center_id") REFERENCES "cost_centers"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "companies" ADD CONSTRAINT "companies_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "companies" ADD CONSTRAINT "companies_default_approver_id_users_id_fk" FOREIGN KEY ("default_approver_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "companies" ADD CONSTRAINT "companies_default_department_id_departments_id_fk" FOREIGN KEY ("default_department_id") REFERENCES "departments"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "emails" ADD CONSTRAINT "emails_recipient_id_users_id_fk" FOREIGN KEY ("recipient_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "expense_line_items" ADD CONSTRAINT "expense_line_items_claim_id_claims_id_fk" FOREIGN KEY ("claim_id") REFERENCES "claims"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "import_batches" ADD CONSTRAINT "import_batches_admin_id_users_id_fk" FOREIGN KEY ("admin_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "last_seen" ADD CONSTRAINT "last_seen_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "liquidation_line_items" ADD CONSTRAINT "liquidation_line_items_liquidation_id_liquidations_id_fk" FOREIGN KEY ("liquidation_id") REFERENCES "liquidations"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "liquidations" ADD CONSTRAINT "liquidations_cash_advance_id_cash_advances_id_fk" FOREIGN KEY ("cash_advance_id") REFERENCES "cash_advances"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "liquidations" ADD CONSTRAINT "liquidations_requestor_id_users_id_fk" FOREIGN KEY ("requestor_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "moms" ADD CONSTRAINT "moms_claim_id_claims_id_fk" FOREIGN KEY ("claim_id") REFERENCES "claims"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "moms" ADD CONSTRAINT "moms_requestor_id_users_id_fk" FOREIGN KEY ("requestor_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "review_meetings" ADD CONSTRAINT "review_meetings_approver_id_users_id_fk" FOREIGN KEY ("approver_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "review_meetings" ADD CONSTRAINT "review_meetings_requestor_id_users_id_fk" FOREIGN KEY ("requestor_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "status_histories" ADD CONSTRAINT "status_histories_cash_advance_id_cash_advances_id_fk" FOREIGN KEY ("cash_advance_id") REFERENCES "cash_advances"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "status_histories" ADD CONSTRAINT "status_histories_claim_id_claims_id_fk" FOREIGN KEY ("claim_id") REFERENCES "claims"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "status_histories" ADD CONSTRAINT "status_histories_delegation_id_approver_delegations_id_fk" FOREIGN KEY ("delegation_id") REFERENCES "approver_delegations"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "status_histories" ADD CONSTRAINT "status_histories_liquidation_id_liquidations_id_fk" FOREIGN KEY ("liquidation_id") REFERENCES "liquidations"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "status_histories" ADD CONSTRAINT "status_histories_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "support_request_messages" ADD CONSTRAINT "support_request_messages_request_id_support_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "support_requests"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "support_request_messages" ADD CONSTRAINT "support_request_messages_sender_id_users_id_fk" FOREIGN KEY ("sender_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "support_requests" ADD CONSTRAINT "support_requests_assigned_admin_id_users_id_fk" FOREIGN KEY ("assigned_admin_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "support_requests" ADD CONSTRAINT "support_requests_requestor_id_users_id_fk" FOREIGN KEY ("requestor_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_reports_to_users_id_fk" FOREIGN KEY ("reports_to") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
