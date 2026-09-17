import { v4 as uuidv4 } from 'uuid';
import { state } from '../state';

export type NotificationEventKey = 'submitted' | 'approved' | 'returned' | 'ready' | 'delegation';

export function shouldNotify(recipientId: string, eventKey: NotificationEventKey): boolean {
  const recipient = state.users.find(u => u.id === recipientId);
  const pref = recipient?.notification_prefs?.[eventKey];
  if (!pref) return true;
  return pref.inApp !== false || pref.email !== false;
}

export function sendEmail(
  toOrId: string,
  subject: string,
  body: string,
  ccId?: string,
  opts?: { plain?: boolean; recipientName?: string; fromLabel?: string; timestamp?: string; eventKey?: NotificationEventKey }
) {
  if (opts?.eventKey && !shouldNotify(toOrId, opts.eventKey)) return;
  const recipient = state.users.find(u => u.id === toOrId);
  const toEmail = recipient ? recipient.email : toOrId;
  const recipientId = recipient ? recipient.id : 'external';
  const recipientName = opts?.recipientName || (recipient ? recipient.name : toOrId.split('@')[0]);
  const fromLine = opts?.plain ? (opts.fromLabel || 'system@reimbursement.local') : "SharePoint Online <no-reply@mgenesis.com>";

  const emailTimestamp = opts?.timestamp || new Date().toISOString();
  const sentString = new Date(emailTimestamp).toLocaleString('en-US', { timeZone: 'Asia/Manila' });

  const finalBody = opts?.plain
    ? `Dear ${recipientName},


${body}`
    : `From:
${fromLine}

Sent:
${sentString}

To:
${toEmail}${ccId ? `\nCC:\n${state.users.find(u => u.id === ccId)?.email || ccId}` : ''}

Subject:
${subject}


Dear ${recipientName},


${body}


This is an automatically generated email.
Please do not reply.


Sales Reimbursement System
Business Support Management Assistant`;

  if (recipient) {
    state.teamsMessages.push({
      id: uuidv4(),
      recipient_id: recipient.id,
      from: 'Microsoft Teams',
      to: recipient.email,
      subject,
      body,
      read: false,
      timestamp: emailTimestamp,
      channel: 'Teams',
    });
  } else {
    state.emails.push({
      id: uuidv4(),
      recipient_id: recipientId,
      from: fromLine,
      to: toEmail,
      subject,
      body: finalBody,
      read: false,
      timestamp: emailTimestamp,
      channel: 'Email'
    });
  }

  if (ccId) {
    const ccRecipient = state.users.find(u => u.id === ccId);
    if (ccRecipient) {
      state.teamsMessages.push({
        id: uuidv4(),
        recipient_id: ccRecipient.id,
        from: 'Microsoft Teams',
        to: ccRecipient.email,
        subject: `[CC] ${subject}`,
        body,
        read: false,
        timestamp: emailTimestamp,
        channel: 'Teams',
      });
    }
  }

  console.log(`\n--- MOCK ${recipient ? 'TEAMS' : 'EMAIL'} TRANSPORT ---`);
  console.log(`To: ${toEmail}`);
  if (ccId) console.log(`CC: ${state.users.find(u => u.id === ccId)?.email}`);
  console.log(`Subject: ${subject}`);
  console.log(`Body:\n${recipient ? body : finalBody}`);
  console.log(`----------------------------\n`);
}

export function notifyClientCcSent({
  recipientIds,
  claimNumber,
  clientName,
  clientEmail,
  eventLabel,
}: {
  recipientIds: Array<string | undefined>;
  claimNumber: string;
  clientName?: string;
  clientEmail: string;
  eventLabel: string;
}) {
  const clientLabel = clientName?.trim()
    ? `${clientName.trim()} (${clientEmail})`
    : clientEmail;
  const subject = `Client CC Sent - ${claimNumber} (${eventLabel})`;
  const body = `A courtesy copy of the ${eventLabel.toLowerCase()} notification for ${claimNumber} was sent to ${clientLabel}.

This confirms that the client contact was CCed as requested.`;

  Array.from(new Set(recipientIds.filter((id): id is string => Boolean(id))))
    .forEach(recipientId => sendEmail(recipientId, subject, body));
}
