import { describe, it, expect } from 'vitest';
import { classifySubject, FILTERS, CATEGORY_ICON } from './NotificationsView';

describe('NotificationsView helper logic', () => {
  it('correctly classifies subjects into notification categories', () => {
    expect(classifySubject('Reimbursement Approved - REIM-2026-0001')).toBe('approved');
    expect(classifySubject('Reimbursement Rejected - REIM-2026-0002')).toBe('rejected');
    expect(classifySubject('Reimbursement Returned for Revision - REIM-2026-0003')).toBe('returned');
    expect(classifySubject('Reimbursement - For Release')).toBe('payments');
    expect(classifySubject('Payment Released - CV-3000')).toBe('payments');
    expect(classifySubject('Meeting Review Required')).toBe('meetings');
    expect(classifySubject('Cash Advance Request Submitted')).toBe('advances');
    expect(classifySubject('Liquidation Report Submitted')).toBe('liquidations');
    expect(classifySubject('General System Notice')).toBe('other');
  });

  it('provides visual metadata for every category', () => {
    const categories = ['rejected', 'returned', 'approved', 'payments', 'meetings', 'advances', 'liquidations', 'other'] as const;
    categories.forEach(cat => {
      expect(CATEGORY_ICON[cat]).toBeDefined();
      expect(CATEGORY_ICON[cat].icon).toBeTruthy();
      expect(CATEGORY_ICON[cat].color).toBeTruthy();
      expect(CATEGORY_ICON[cat].bg).toBeTruthy();
    });
  });

  it('filters match according to defined rules', () => {
    const unreadFilter = FILTERS.find(f => f.id === 'unread');
    expect(unreadFilter?.match({ subject: 'Test', read: false })).toBe(true);
    expect(unreadFilter?.match({ subject: 'Test', read: true })).toBe(false);

    const approvalsFilter = FILTERS.find(f => f.id === 'approvals');
    expect(approvalsFilter?.match({ subject: 'Claim Approved', read: false })).toBe(true);
    expect(approvalsFilter?.match({ subject: 'Claim Rejected', read: false })).toBe(false);
  });
});
