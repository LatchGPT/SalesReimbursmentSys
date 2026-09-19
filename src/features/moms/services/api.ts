import { MinutesSource } from '../types';
import { apiFetch } from '../../../lib/api/client';

export interface CreateMomInput {
  documentType?: 'MoM' | 'LOA';
  client: string;
  purpose: string;
  meetingDate: string;
  location?: string;
  contactPerson?: string;
  contactPersonEmail?: string;
  ccClient?: boolean;
  discussion?: string;
  actionItems?: string;
  source?: MinutesSource;
  fileUrl?: string;
  fileName?: string;
  customFields?: Record<string, string>;
  status?: 'Draft' | 'Completed';
}

function momRequestBody(input: CreateMomInput) {
  return {
    document_type: input.documentType || 'MoM',
    client: input.client,
    purpose: input.purpose,
    meeting_date: input.meetingDate,
    location: input.location || '',
    contact_person: input.contactPerson || '',
    contact_person_email: input.contactPersonEmail || '',
    cc_client: Boolean(input.ccClient),
    discussion: input.discussion || '',
    action_items: input.actionItems || '',
    minutes_source: input.source || MinutesSource.TEMPLATE,
    file_url: input.fileUrl,
    file_name: input.fileName,
    custom_fields: input.customFields,
    status: input.status || 'Completed',
  };
}

export const createMom = (input: CreateMomInput) =>
  apiFetch('/api/moms', {
    method: 'POST',
    body: JSON.stringify(momRequestBody(input)),
  });

export const updateMom = (id: string, input: CreateMomInput) =>
  apiFetch(`/api/moms/${id}`, {
    method: 'PUT',
    body: JSON.stringify(momRequestBody(input)),
  });

// Emails the client copy to the recipients on the record and finalizes it.
// Server route: POST /api/moms/:id/send (owner only).
export const sendMomToClient = (id: string) =>
  apiFetch(`/api/moms/${id}/send`, { method: 'POST', body: '{}' });
