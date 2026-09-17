export const EXPENSE_CATEGORIES = [
  'Meals', 'Supplies', 'Lodging', 'Transportation', 'Utilities', 'Entertainment',
] as const;

export function normalizeExpenseCategory(category?: string): string {
  const value = (category || '').trim();
  return value.toLowerCase() === 'travel' ? 'Transportation' : value;
}
