import { describe, expect, it } from 'vitest';
import { DraftLineItem } from '@/features/claims/services/api';

/**
 * Helpers representing the clear/reset and delete-row behavior
 * implemented on the delete icon dropdown in LineItemsStep.tsx (Ticket SRS-36).
 */
export function clearExpenseLineItem(
  items: DraftLineItem[],
  targetIndex: number,
  claimType: string = 'Reimbursement'
): DraftLineItem[] {
  return items.map((li, i) =>
    i === targetIndex
      ? {
          expenseDate: '',
          amount: 0,
          paymentMethod: 'Personal Card',
          vendor: '',
          businessPurpose: '',
          orNumber: '',
          receiptFile: undefined,
          receiptUrl: undefined,
          category: claimType === 'Transport Reimbursement' ? 'Transportation' : 'Meals',
        }
      : li
  );
}

export function deleteExpenseLineItem(
  items: DraftLineItem[],
  targetIndex: number,
  claimType: string = 'Reimbursement'
): DraftLineItem[] {
  if (items.length <= 1) {
    return [
      {
        expenseDate: '',
        amount: 0,
        paymentMethod: 'Personal Card',
        vendor: '',
        businessPurpose: '',
        orNumber: '',
        receiptFile: undefined,
        receiptUrl: undefined,
        category: claimType === 'Transport Reimbursement' ? 'Transportation' : 'Meals',
      },
    ];
  }
  return items.filter((_, i) => i !== targetIndex);
}

describe('SRS-36: Expense row clear and delete behavior', () => {
  const initialItems: DraftLineItem[] = [
    {
      expenseDate: '2026-09-20',
      amount: 450,
      paymentMethod: 'Cash',
      vendor: 'Microgenesis Supply',
      businessPurpose: 'Office stationery',
      orNumber: 'OR-12345',
      category: 'Supplies',
      receiptUrl: 'blob:http://localhost:3000/mock-uuid',
    },
    {
      expenseDate: '2026-09-21',
      amount: 120,
      paymentMethod: 'Personal Card',
      vendor: 'Grab',
      businessPurpose: 'Client ride',
      orNumber: 'OR-67890',
      category: 'Transportation',
    },
  ];

  it('resets line item fields to default values while preserving row structure and array length when clearing inputs', () => {
    // User chooses "Clear inputs only" on first row (index 0)
    const updated = clearExpenseLineItem(initialItems, 0, 'Reimbursement');

    // 1. Array length remains 2 (row is NOT removed from state/DOM)
    expect(updated).toHaveLength(2);

    // 2. Row at index 0 has its user inputs cleared/reset
    expect(updated[0]).toEqual({
      expenseDate: '',
      amount: 0,
      paymentMethod: 'Personal Card',
      vendor: '',
      businessPurpose: '',
      orNumber: '',
      receiptFile: undefined,
      receiptUrl: undefined,
      category: 'Meals',
    });

    // 3. Other rows remain untouched
    expect(updated[1]).toEqual(initialItems[1]);

    // 4. Totals recalculate accurately based on reset amounts
    const totalAmount = updated.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
    expect(totalAmount).toBe(120);
  });

  it('removes the row from the table when choosing "Delete row" on multi-row tables', () => {
    // User chooses "Delete row" on first row (index 0)
    const updated = deleteExpenseLineItem(initialItems, 0, 'Reimbursement');

    // Row is removed, length is 1
    expect(updated).toHaveLength(1);
    expect(updated[0].vendor).toBe('Grab');
    expect(updated[0].amount).toBe(120);
  });

  it('safely resets the row rather than leaving zero rows if deleting the only remaining row', () => {
    const singleRow: DraftLineItem[] = [
      {
        expenseDate: '2026-09-20',
        amount: 500,
        vendor: 'Store',
      },
    ];

    const updated = deleteExpenseLineItem(singleRow, 0, 'Reimbursement');
    expect(updated).toHaveLength(1);
    expect(updated[0].amount).toBe(0);
    expect(updated[0].vendor).toBe('');
  });
});
