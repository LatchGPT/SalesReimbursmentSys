-- Additive indexes for approval and claim-workflow lookups.
CREATE INDEX "workflow_approvals_claim_id_idx" ON "approvals"("claim_id");
CREATE INDEX "approver_delegations_approver_id_status_idx" ON "approver_delegations"("approver_id", "status");
CREATE INDEX "approver_delegations_delegate_id_status_idx" ON "approver_delegations"("delegate_id", "status");
CREATE INDEX "claims_current_approver_id_status_created_at_idx" ON "claims"("current_approver_id", "status", "created_at");
CREATE INDEX "claims_requestor_id_created_at_idx" ON "claims"("requestor_id", "created_at");
CREATE INDEX "workflow_expense_line_items_claim_id_idx" ON "expense_line_items"("claim_id");
CREATE INDEX "review_meetings_approver_id_meeting_date_meeting_time_status_idx" ON "review_meetings"("approver_id", "meeting_date", "meeting_time", "status");
CREATE INDEX "status_histories_claim_id_timestamp_idx" ON "status_histories"("claim_id", "timestamp");
