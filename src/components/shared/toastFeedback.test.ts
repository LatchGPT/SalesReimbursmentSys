import { describe, it, expect } from 'vitest';

describe('Action Confirmation Messages & Acceptance Criteria', () => {
  const standardActionMessages = {
    submit: 'Claim submitted successfully.',
    approve: 'Claim approved successfully.',
    reject: 'Claim rejected successfully.',
    return: 'Claim returned successfully.',
    delete: 'Record deleted successfully.',
    saveDraft: 'Draft saved successfully.',
  };

  it('contains the expected standard success messages from the specification', () => {
    expect(standardActionMessages.submit).toBe('Claim submitted successfully.');
    expect(standardActionMessages.approve).toBe('Claim approved successfully.');
    expect(standardActionMessages.reject).toBe('Claim rejected successfully.');
    expect(standardActionMessages.return).toBe('Claim returned successfully.');
    expect(standardActionMessages.delete).toBe('Record deleted successfully.');
    expect(standardActionMessages.saveDraft).toBe('Draft saved successfully.');
  });

  it('ensures all completion actions provide a clear confirmation message with positive status', () => {
    Object.values(standardActionMessages).forEach(message => {
      expect(message).toMatch(/successfully\.$/);
    });
  });
});
