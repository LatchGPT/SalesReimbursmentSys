import { describe, expect, it } from 'vitest';
import { dispatchTestRequest } from './testRouter';
import { UserRole } from '../src/lib/db/serverTypes';
import { state } from '../src/server/state';

async function callApi(path: string, init: RequestInit = {}): Promise<Response> {
  return dispatchTestRequest(path, init);
}

describe('User Accounts - Add and Delete User API', () => {
  const adminId = 'u4'; // Dave Lopez (Admin)
  const regularUserId = 'u1'; // Alice Reyes (Requestor)

  describe('POST /api/users (Add User)', () => {
    it('rejects unauthenticated or non-admin requests with 403', async () => {
      const resNonAdmin = await callApi('/api/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Id': regularUserId,
        },
        body: JSON.stringify({
          name: 'Test Candidate',
          email: 'candidate@mgenesis.com',
          role: UserRole.REQUESTOR,
          department: 'Sales',
        }),
      });
      expect(resNonAdmin.status).toBe(403);

      const resUnauth = await callApi('/api/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: 'Test Candidate',
          email: 'candidate2@mgenesis.com',
          role: UserRole.REQUESTOR,
          department: 'Sales',
        }),
      });
      expect(resUnauth.status).toBe(403);
    });

    it('rejects invalid or missing fields', async () => {
      // Missing name
      const resNoName = await callApi('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-User-Id': adminId },
        body: JSON.stringify({
          email: 'noname@mgenesis.com',
          role: UserRole.REQUESTOR,
          department: 'Sales',
        }),
      });
      expect(resNoName.status).toBe(400);

      // Invalid email
      const resBadEmail = await callApi('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-User-Id': adminId },
        body: JSON.stringify({
          name: 'Bad Email User',
          email: 'not-an-email',
          role: UserRole.REQUESTOR,
          department: 'Sales',
        }),
      });
      expect(resBadEmail.status).toBe(400);

      // Duplicate email
      const resDup = await callApi('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-User-Id': adminId },
        body: JSON.stringify({
          name: 'Duplicate User',
          email: state.users[0]?.email || 'mia@mgenesis.com',
          role: UserRole.REQUESTOR,
          department: 'Sales',
        }),
      });
      expect(resDup.status).toBe(400);
      expect(await resDup.json()).toEqual({ error: 'A user with this email already exists.' });
    });

    it('allows Admin to create a new user successfully', async () => {
      const email = `newuser_${Date.now()}@mgenesis.com`;
      const res = await callApi('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-User-Id': adminId },
        body: JSON.stringify({
          name: 'New Test Employee',
          email,
          role: UserRole.REQUESTOR,
          department: 'Sales',
          job_title: 'Junior Sales Executive',
          reports_to: 'u2',
        }),
      });
      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.user).toBeDefined();
      expect(data.user.name).toBe('New Test Employee');
      expect(data.user.email).toBe(email);
      expect(data.user.role).toBe(UserRole.REQUESTOR);
      expect(data.user.reports_to).toBe('u2');
      expect(data.user.employment_status).toBe('Active');

      // Verify user is in state.users
      const inState = state.users.find((u) => u.id === data.user.id);
      expect(inState).toBeDefined();
    });
  });

  describe('DELETE /api/users/:id (Delete User)', () => {
    it('rejects non-admin delete requests with 403', async () => {
      const res = await callApi('/api/users/u1', {
        method: 'DELETE',
        headers: { 'X-User-Id': regularUserId },
      });
      expect(res.status).toBe(403);
    });

    it('prevents Admin from deleting their own account', async () => {
      const res = await callApi(`/api/users/${adminId}`, {
        method: 'DELETE',
        headers: { 'X-User-Id': adminId },
      });
      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ error: 'You cannot delete your own account.' });
    });

    it('prevents deleting a manager who has active direct reports', async () => {
      // u2 (Bob Santos) has direct reports (e.g. u1 Alice)
      const res = await callApi('/api/users/u2', {
        method: 'DELETE',
        headers: { 'X-User-Id': adminId },
      });
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toContain('direct report');
    });

    it('prevents deleting a user with existing reimbursement claims', async () => {
      state.claims.push({
        id: 'claim_test_guard',
        claim_number: 'CLM-TEST-GUARD',
        requestor_id: 'u1',
        current_approver_id: 'u2',
        status: 'Pending Approval' as any,
        total_amount: 1500,
        created_at: new Date().toISOString(),
      } as any);

      const res = await callApi('/api/users/u1', {
        method: 'DELETE',
        headers: { 'X-User-Id': adminId },
      });
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toContain('claims or transactions');
    });

    it('allows Admin to delete an eligible user without transactions or reports', async () => {
      // Create a temporary user with no claims
      const tempEmail = `temp_delete_${Date.now()}@mgenesis.com`;
      const createRes = await callApi('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-User-Id': adminId },
        body: JSON.stringify({
          name: 'Temporary User',
          email: tempEmail,
          role: UserRole.REQUESTOR,
          department: 'Marketing',
        }),
      });
      expect(createRes.status).toBe(201);
      const { user: createdUser } = await createRes.json();

      // Now delete this temporary user
      const deleteRes = await callApi(`/api/users/${createdUser.id}`, {
        method: 'DELETE',
        headers: { 'X-User-Id': adminId },
      });
      expect(deleteRes.status).toBe(200);
      expect(await deleteRes.json()).toEqual({
        success: true,
        message: `User ${createdUser.name} deleted successfully.`,
      });

      // Verify user was removed from state.users
      expect(state.users.some((u) => u.id === createdUser.id)).toBe(false);
    });
  });
});
