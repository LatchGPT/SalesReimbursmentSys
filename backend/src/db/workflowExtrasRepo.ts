import type {
  approver_delegations as DelegationRow,
  review_meetings as ReviewMeetingRow,
  status_histories as StatusHistoryRow,
  support_priority,
  support_request_messages as SupportMessageRow,
  support_requests as SupportRequestRow,
  support_status,
} from '../../../src/generated/prisma/client';
import { serverEnv } from '../../../src/config/env';
import {
  DelegationStatus,
  ReviewMeetingStatus,
  SupportRequestPriority,
  SupportRequestStatus,
} from '../serverTypes';
import type {
  ApproverDelegation,
  ReviewMeeting,
  StatusHistory,
  SupportRequest,
  SupportRequestMessage,
} from '../serverTypes';
import { getDb } from './index';

export const isDbConfigured = () => !!serverEnv.databaseUrl;

function supportStatusToPrisma(status: SupportRequestStatus): support_status {
  return status === 'In Progress' ? 'In_Progress' : status as support_status;
}

function supportStatusFromPrisma(status: support_status): SupportRequestStatus {
  return status === 'In_Progress'
    ? 'In Progress' as SupportRequestStatus
    : status as SupportRequestStatus;
}

function delegationToRow(delegation: ApproverDelegation) {
  return {
    id: delegation.id,
    approver_id: delegation.approver_id,
    delegate_id: delegation.delegate_id,
    start_date: delegation.start_date,
    end_date: delegation.end_date,
    status: delegation.status,
    decline_reason: delegation.decline_reason ?? null,
    created_by: delegation.created_by,
  };
}

function delegationFromRow(row: DelegationRow): ApproverDelegation {
  return {
    id: row.id,
    approver_id: row.approver_id,
    delegate_id: row.delegate_id,
    start_date: row.start_date,
    end_date: row.end_date,
    status: row.status as DelegationStatus,
    decline_reason: row.decline_reason ?? undefined,
    created_by: row.created_by,
    created_at: row.created_at.toISOString(),
    updated_at: row.updated_at.toISOString(),
  };
}

export async function persistDelegation(
  delegation: ApproverDelegation,
): Promise<void> {
  if (!isDbConfigured()) return;
  const row = delegationToRow(delegation);
  await getDb().approver_delegations.upsert({
    where: { id: row.id },
    create: row,
    update: row,
  });
}

export async function loadDelegationsFromDb(): Promise<ApproverDelegation[]> {
  if (!isDbConfigured()) return [];
  return (await getDb().approver_delegations.findMany()).map(delegationFromRow);
}

function delegationHistoryFromRow(row: StatusHistoryRow): StatusHistory {
  return {
    id: row.id,
    claim_id: '',
    delegation_id: row.delegation_id ?? undefined,
    old_status: row.old_status,
    new_status: row.new_status,
    changed_by: row.changed_by,
    reason: row.reason ?? undefined,
    timestamp: row.timestamp.toISOString(),
  };
}

export async function loadDelegationHistoryFromDb(): Promise<StatusHistory[]> {
  if (!isDbConfigured()) return [];
  const rows = await getDb().status_histories.findMany({
    where: { delegation_id: { not: null } },
  });
  return rows.map(delegationHistoryFromRow);
}

function reviewMeetingToRow(meeting: ReviewMeeting) {
  return {
    id: meeting.id,
    claim_id: meeting.claim_id,
    requestor_id: meeting.requestor_id,
    approver_id: meeting.approver_id,
    meeting_date: meeting.meeting_date,
    meeting_time: meeting.meeting_time,
    status: meeting.status,
    decline_reason: meeting.decline_reason ?? null,
  };
}

function reviewMeetingFromRow(row: ReviewMeetingRow): ReviewMeeting {
  return {
    id: row.id,
    claim_id: row.claim_id,
    requestor_id: row.requestor_id,
    approver_id: row.approver_id,
    meeting_date: row.meeting_date,
    meeting_time: row.meeting_time,
    status: row.status as ReviewMeetingStatus,
    decline_reason: row.decline_reason ?? undefined,
    created_at: row.created_at.toISOString(),
  };
}

export async function persistReviewMeeting(meeting: ReviewMeeting): Promise<void> {
  if (!isDbConfigured()) return;
  const row = reviewMeetingToRow(meeting);
  await getDb().review_meetings.upsert({
    where: { id: row.id },
    create: row,
    update: row,
  });
}

export async function loadReviewMeetingsFromDb(): Promise<ReviewMeeting[]> {
  if (!isDbConfigured()) return [];
  return (await getDb().review_meetings.findMany()).map(reviewMeetingFromRow);
}

function supportRequestToRow(request: SupportRequest) {
  return {
    id: request.id,
    requestor_id: request.requestor_id,
    subject: request.subject,
    description: request.description,
    related_entity_type: request.related_entity_type ?? null,
    related_entity_id: request.related_entity_id ?? null,
    priority: request.priority as support_priority,
    status: supportStatusToPrisma(request.status),
    assigned_admin_id: request.assigned_admin_id ?? null,
  };
}

function supportRequestFromRow(row: SupportRequestRow): SupportRequest {
  return {
    id: row.id,
    requestor_id: row.requestor_id,
    subject: row.subject,
    description: row.description,
    related_entity_type: (row.related_entity_type ?? undefined) as
      SupportRequest['related_entity_type'],
    related_entity_id: row.related_entity_id ?? undefined,
    priority: row.priority as SupportRequestPriority,
    status: supportStatusFromPrisma(row.status),
    assigned_admin_id: row.assigned_admin_id ?? undefined,
    created_at: row.created_at.toISOString(),
    updated_at: row.updated_at.toISOString(),
  };
}

export async function persistSupportRequest(
  request: SupportRequest,
): Promise<void> {
  if (!isDbConfigured()) return;
  const row = supportRequestToRow(request);
  await getDb().support_requests.upsert({
    where: { id: row.id },
    create: row,
    update: row,
  });
}

function supportMessageToRow(message: SupportRequestMessage) {
  return {
    id: message.id,
    request_id: message.request_id,
    sender_id: message.sender_id,
    message: message.message,
    timestamp: new Date(message.timestamp),
  };
}

function supportMessageFromRow(row: SupportMessageRow): SupportRequestMessage {
  return {
    id: row.id,
    request_id: row.request_id,
    sender_id: row.sender_id,
    message: row.message,
    timestamp: row.timestamp.toISOString(),
  };
}

export async function insertSupportMessage(
  message: SupportRequestMessage,
): Promise<void> {
  if (!isDbConfigured()) return;
  await getDb().support_request_messages.createMany({
    data: [supportMessageToRow(message)],
    skipDuplicates: true,
  });
}

export async function loadSupportRequestsFromDb(): Promise<{
  requests: SupportRequest[];
  messages: SupportRequestMessage[];
}> {
  if (!isDbConfigured()) return { requests: [], messages: [] };
  const [requestRows, messageRows] = await Promise.all([
    getDb().support_requests.findMany(),
    getDb().support_request_messages.findMany(),
  ]);
  return {
    requests: requestRows.map(supportRequestFromRow),
    messages: messageRows.map(supportMessageFromRow),
  };
}

export async function clearWorkflowExtrasInDb(): Promise<void> {
  if (!isDbConfigured()) return;
  await getDb().$transaction(async (tx) => {
    await tx.support_request_messages.deleteMany();
    await tx.support_requests.deleteMany();
    await tx.review_meetings.deleteMany();
    await tx.approver_delegations.deleteMany();
  });
}
