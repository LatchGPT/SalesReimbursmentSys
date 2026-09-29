import { describe, it, expect } from 'vitest';
import { SYSTEM_NAME } from './Topbar';
import fs from 'node:fs';
import path from 'node:path';

describe('Topbar Header and System Name Consistency', () => {
  it('defines SYSTEM_NAME as Sales Reimbursement System', () => {
    expect(SYSTEM_NAME).toBe('Sales Reimbursement System');
  });

  it('removes the obsolete "Expense Dashboard" label and replaces it with SYSTEM_NAME', () => {
    const topbarContent = fs.readFileSync(path.resolve(__dirname, 'Topbar.tsx'), 'utf-8');
    expect(topbarContent).not.toContain('Expense Dashboard');
    expect(topbarContent).toContain('{SYSTEM_NAME}');
  });
});
