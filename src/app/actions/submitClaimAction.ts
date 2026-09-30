'use server';

import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../../lib/db/index';
import { Claim, ClaimStatus, ExpenseLineItem, Mom, MomStatus, UserRole } from '../../lib/db/serverTypes';
import { getOrCreateCompany } from '../../server/services/companyService';
import { generateClaimNumber } from '../../server/services/claimNumber';
import { persistClaimWithLineItems } from '../../lib/db/coreLoopRepo';
import { sendEmail, notifyClientCcSent } from '../../server/services/notifications';
import { formatPHP, REIMBURSEMENT_CAP } from '../../server/constants';
import { normalizeExpenseCategory } from '../../lib/expenseCategories';
import { getReimbursementDateError, getTodayIsoDate } from '../../features/claims/domain/reimbursementPolicy';
import { persistStatusHistoryFireAndForget } from '../../lib/db/coreLoopRepo';

export async function submitClaimAction(userId: string | null, body: any) {
  if (!userId) return { status: 401, body: { error: 'Unauthorized' } };

  const db = getDb();
  
  // 1. Fetch User directly
  const userRow = await db.users.findUnique({ where: { id: userId } });
  if (!userRow) return { status: 401, body: { error: 'Unauthorized' } };
  
  const user = {
    id: userRow.id,
    name: userRow.name,
    email: userRow.email,
    reports_to: userRow.reports_to,
    department: userRow.department,
    job_title: userRow.job_title,
    role: userRow.role as UserRole
  };

  if (!user.reports_to) {
    return { status: 403, body: { error: 'Forbidden: You must have a designated manager (reports_to) to submit.' } };
  }

  const { claim_type, mom_id, mom: momPayload, expense_category, total_amount, receipt_url, or_number, expense_date, remarks, supporting_documents, line_items, is_draft } = body || {};
  const claimType = claim_type === 'Transport Reimbursement' ? 'Transport Reimbursement' : 'Reimbursement';
  const isTransportReimbursement = claimType === 'Transport Reimbursement';

  let mom: Mom | undefined;
  if (momPayload && typeof momPayload === 'object') {
    if (!is_draft && (!momPayload.client || !momPayload.purpose)) {
      return { status: 400, body: { error: 'Client and Purpose are required for Minutes of Meeting.' } };
    }
    const newMomId = uuidv4();
    mom = {
      id: newMomId,
      claim_id: undefined,
      requestor_id: user.id,
      document_type: momPayload.document_type === 'LOA' || momPayload.documentType === 'LOA' ? 'LOA' : 'MoM',
      client: momPayload.client || (is_draft ? 'Draft Client' : ''),
      contact_person: momPayload.contact_person || momPayload.contactPerson || '',
      contact_person_email: momPayload.contact_person_email || momPayload.contactPersonEmail || '',
      cc_client: Boolean(momPayload.cc_client ?? momPayload.ccClient),
      meeting_date: momPayload.meeting_date || momPayload.meetingDate || new Date().toISOString().split('T')[0],
      meeting_time: momPayload.meeting_time || momPayload.meetingTime || '',
      location: momPayload.location || '',
      purpose: momPayload.purpose || (is_draft ? 'Draft Meeting' : ''),
      discussion: momPayload.discussion || '',
      agreements: momPayload.agreements || '',
      action_items: momPayload.action_items || momPayload.actionItems || '',
      prepared_by: user.name,
      prepared_by_department: user.department,
      prepared_by_job_title: user.job_title,
      file_url: momPayload.file_url,
      file_name: momPayload.file_name,
      status: is_draft ? MomStatus.DRAFT : MomStatus.COMPLETED,
      created_at: new Date().toISOString(),
      minutes_source: momPayload.minutes_source || 'Template',
      meeting_type: momPayload.meeting_type || '',
      participants_internal: momPayload.participants_internal || '',
      participants_external: momPayload.participants_external || '',
      custom_fields: momPayload.custom_fields || undefined,
    };
    if (mom.client) {
      await getOrCreateCompany(mom.client, user.id);
    }
  } else if (mom_id) {
    const momRow = await db.moms.findUnique({ where: { id: mom_id } });
    if (!momRow) return { status: 400, body: { error: 'Minutes of Meeting (MOM) not found.' } };
    
    if (!is_draft && momRow.status !== MomStatus.COMPLETED) {
      return { status: 400, body: { error: 'Cannot attach an incomplete or draft Minutes of Meeting.' } };
    }
    if (momRow.claim_id) {
      return { status: 400, body: { error: 'This Minutes of Meeting is already linked to another claim and cannot be reused.' } };
    }
    mom = { ...momRow, status: momRow.status as MomStatus, minutes_source: momRow.minutes_source as any } as unknown as Mom;
  } else if (!is_draft && !isTransportReimbursement) {
    return { status: 400, body: { error: 'Minutes of Meeting (MOM) is required.' } };
  }

  let itemsToCreate: any[] = [];
  let claimTotal = 0;
  let mainCategory = normalizeExpenseCategory(expense_category || 'Multiple Categories');
  let mainReceipt = receipt_url || '';

  if (line_items && Array.isArray(line_items) && line_items.length > 0) {
    for (const [index, item] of line_items.entries()) {
      if (!is_draft && !item.category) return { status: 400, body: { error: 'Each expense must have a category.' } };
      const numericAmount = Number(item.amount);
      if (!is_draft) {
        if (isNaN(numericAmount) || numericAmount <= 0) return { status: 400, body: { error: 'Each expense amount must be a valid number greater than zero.' } };
        if (!item.receipt_url) return { status: 400, body: { error: 'Each expense must have a receipt.' } };
        const dateError = getReimbursementDateError(item.expense_date, getTodayIsoDate());
        if (dateError) return { status: 400, body: { error: `Expense row ${index + 1}: ${dateError}` } };
      }

      const validAmount = isNaN(numericAmount) || numericAmount < 0 ? 0 : numericAmount;
      itemsToCreate.push({
        category: normalizeExpenseCategory(item.category || 'Other'),
        amount: validAmount,
        receipt_url: item.receipt_url || '',
        or_number: item.or_number || '',
        vendor: item.vendor || '',
        expense_date: item.expense_date || getTodayIsoDate(),
        payment_method: item.payment_method || '',
        business_purpose: item.business_purpose || remarks ||
          (isTransportReimbursement ? 'Business transport reimbursement' : `Sales reimbursement for meeting with ${mom?.client || 'client'}`)
      });
      claimTotal += validAmount;
    }
    mainCategory = itemsToCreate.length === 1 ? itemsToCreate[0].category : 'Multiple Categories';
    mainReceipt = itemsToCreate[0]?.receipt_url || '';
  } else {
    if (!is_draft) {
      const dateError = getReimbursementDateError(expense_date, getTodayIsoDate());
      if (dateError) return { status: 400, body: { error: dateError } };
      if (!expense_category) return { status: 400, body: { error: 'Expense Category is required.' } };
      if (total_amount === undefined || total_amount === null || total_amount === '') return { status: 400, body: { error: 'Expense amount is required.' } };
      const numericAmount = Number(total_amount);
      if (isNaN(numericAmount) || numericAmount <= 0) return { status: 400, body: { error: 'Expense amount must be a valid number greater than zero.' } };
      if (!receipt_url) return { status: 400, body: { error: 'Receipt image or PDF is required.' } };

      itemsToCreate.push({
        category: normalizeExpenseCategory(expense_category),
        amount: numericAmount,
        receipt_url: receipt_url,
        or_number: or_number,
        expense_date,
        business_purpose: remarks || (isTransportReimbursement ? 'Business transport reimbursement' : `Sales reimbursement for meeting with ${mom?.client || 'client'}`)
      });
      claimTotal = numericAmount;
      mainCategory = normalizeExpenseCategory(expense_category);
      mainReceipt = receipt_url;
    } else {
      const numericAmount = Number(total_amount) || 0;
      itemsToCreate.push({
        category: normalizeExpenseCategory(expense_category || 'Other'),
        amount: numericAmount,
        receipt_url: receipt_url || '',
        or_number: or_number || '',
        expense_date: expense_date || getTodayIsoDate(),
        business_purpose: remarks || (isTransportReimbursement ? 'Business transport reimbursement' : 'Draft reimbursement')
      });
      claimTotal = numericAmount;
      mainCategory = normalizeExpenseCategory(expense_category || 'Other');
      mainReceipt = receipt_url || '';
    }
  }

  if (itemsToCreate.length === 0 && is_draft) {
    itemsToCreate.push({
      category: 'Other', amount: 0, receipt_url: '', or_number: '', expense_date: getTodayIsoDate(), business_purpose: remarks || (isTransportReimbursement ? 'Business transport reimbursement' : 'Draft reimbursement')
    });
    mainCategory = 'Other'; mainReceipt = '';
  }

  if (!is_draft) {
    const settings = await db.system_settings.findFirst();
    const limits = settings?.expense_category_limits ? JSON.parse(settings.expense_category_limits as string) : {};
    for (const item of itemsToCreate) {
      const limit = limits[item.category];
      if (limit && item.amount > limit) {
        return { status: 400, body: { error: `Category '${item.category}' exceeds the limit of ${formatPHP(limit)}` } };
      }
    }
  }

  const claimId = uuidv4();
  const claimNumber = await generateClaimNumber();
  const expenses: ExpenseLineItem[] = itemsToCreate.map(item => ({
    id: uuidv4(),
    claim_id: claimId,
    expense_date: item.expense_date || mom?.meeting_date || new Date().toISOString().split('T')[0],
    vendor: item.vendor || mom?.client || (isTransportReimbursement ? 'Transport Provider' : 'Client Meeting'),
    category: item.category,
    amount: item.amount,
    payment_method: item.payment_method || 'Cash',
    business_purpose: item.business_purpose,
    receipt_url: item.receipt_url,
    or_number: item.or_number
  }));

  let originalApproverId: string | undefined = undefined;
  let currentApproverId = user.reports_to || '';

  if (user.reports_to) {
    const delegation = await db.approver_delegations.findFirst({
      where: { approver_id: user.reports_to, status: 'Active' }
    });
    if (delegation) {
      originalApproverId = user.reports_to;
      currentApproverId = delegation.delegate_id;
    }
  }

  const settings = await db.system_settings.findFirst();
  const highValueThreshold = settings ? Number(settings.high_value_threshold) : 10000;

  const claim: Claim = {
    id: claimId,
    claim_number: claimNumber,
    requestor_id: user.id,
    current_approver_id: currentApproverId,
    original_approver_id: originalApproverId,
    mom_id: mom?.id || mom_id || undefined,
    claim_type: claimType as any,
    status: is_draft ? ClaimStatus.DRAFT : ClaimStatus.PENDING_APPROVAL,
    total_amount: claimTotal,
    expense_category: mainCategory,
    receipt_url: mainReceipt,
    remarks,
    supporting_documents,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    flagged_high_value: itemsToCreate.some(item => item.amount > highValueThreshold)
  };

  if (mom) mom.claim_id = claimId;

  try {
    await persistClaimWithLineItems(claim, expenses, mom ? [mom] : []);
  } catch (err) {
    console.error('[db] Could not persist new claim to Postgres:', err);
    return { status: 500, body: { error: 'Could not save reimbursement. Please try again.' } };
  }

  persistStatusHistoryFireAndForget({
    id: uuidv4(),
    claim_id: claim.id,
    old_status: ClaimStatus.DRAFT,
    new_status: claim.status,
    changed_by: user.id,
    reason: is_draft ? 'Draft saved by requestor' : `${claimType} filed and received by the system`,
    timestamp: new Date().toISOString()
  });

  if (!is_draft && originalApproverId && currentApproverId !== originalApproverId) {
    const origUser = await db.users.findUnique({ where: { id: originalApproverId } });
    const delegateUser = await db.users.findUnique({ where: { id: currentApproverId } });
    const origName = origUser?.name || originalApproverId;
    const delegateName = delegateUser?.name || currentApproverId;

    persistStatusHistoryFireAndForget({
      id: uuidv4(),
      claim_id: claim.id,
      old_status: ClaimStatus.DRAFT,
      new_status: ClaimStatus.PENDING_APPROVAL,
      changed_by: user.id,
      reason: `Auto-routed to delegate ${delegateName} (on behalf of ${origName})`,
      timestamp: new Date().toISOString()
    });
  }

  if (!is_draft && currentApproverId) {
    const approverRow = await db.users.findUnique({ where: { id: currentApproverId } });
    const approverName = approverRow ? approverRow.name : 'Approver';
    
    sendEmail(currentApproverId, `${claimType} Submitted - ${claimNumber}`, `A new ${claimType.toLowerCase()} request ${claimNumber} by ${user.name} has been submitted and is awaiting your review and approval.\n\nReference:\n${claimNumber}\n\nRequired Action:\nPlease log in to the system and navigate to the Approval Queue to approve or reject this claim.`, undefined, { eventKey: 'submitted' });
    sendEmail(user.id, `${claimType} Submitted - ${claimNumber}`, `Your ${claimType.toLowerCase()} request ${claimNumber} for PHP ${claimTotal} has been successfully submitted and routed to ${approverName} for review.\n\nReference:\n${claimNumber}\n\nYou'll receive another email as soon as ${approverName} makes a decision.`, undefined, { eventKey: 'submitted' });

    if (mom?.cc_client && mom.contact_person_email) {
      sendEmail(mom.contact_person_email, `Copy: ${claimType} Submitted - ${claimNumber}`, `${user.name} submitted ${claimNumber}, which references the meeting with ${mom.client || 'your organization'}. This is a courtesy copy requested by the filer.`, undefined, { plain: true, recipientName: mom.contact_person || undefined, fromLabel: `${user.name} via Sales Reimbursement System` });
      notifyClientCcSent({ recipientIds: [user.id, currentApproverId], claimNumber, clientName: mom.contact_person, clientEmail: mom.contact_person_email, eventLabel: 'Submission' });
    }
  }

  return { status: 200, body: { ...claim, mom } };
}
