import { Router } from 'express';
import { User, UserRole, Claim, ClaimStatus } from '../../lib/db/serverTypes';
import { state } from '../../server/state';
import { getUser } from '../../server/middleware/auth';
import { addUserHistory } from '../../server/services/history';
import { recalcApprovalAuthority, detectStaleApprovers } from '../../server/services/hierarchy';
import { syncUsersToDb } from '../../lib/db/usersRepo';
import { persistClaim } from '../../lib/db/coreLoopRepo';

export const usersRouter = Router();

export const wouldCreateCycle = (userId: string, candidateManagerId: string): boolean => {
  if (candidateManagerId === userId) return true;
  let currentId: string | null = candidateManagerId;
  const visited = new Set<string>();
  while (currentId) {
    if (currentId === userId) return true;
    if (visited.has(currentId)) return false;
    visited.add(currentId);
    const currentUser: User | undefined = state.users.find(u => u.id === currentId);
    currentId = currentUser?.reports_to ?? null;
  }
  return false;
};

usersRouter.get('/users', (req, res) => {
  const user = getUser(req);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });
  res.json(state.users);
});

usersRouter.put('/users/:id', async (req, res) => {
  const admin = getUser(req);
  if (!admin || admin.role !== UserRole.ADMIN) return res.status(403).json({ error: 'Forbidden' });

  const target = state.users.find(u => u.id === req.params.id);
  if (!target) return res.status(404).json({ error: 'User not found' });

  const { role, department, job_title, reports_to, confirmOrphan, employment_status, can_approve_reimbursements } = req.body;

  if (target.id === admin.id && role !== undefined && role !== UserRole.ADMIN) {
    return res.status(400).json({ error: 'You cannot remove your own Admin role.' });
  }

  if (reports_to !== undefined && reports_to !== null) {
    if (reports_to === target.id) {
      return res.status(400).json({ error: 'A user cannot report to themselves.' });
    }
    if (wouldCreateCycle(target.id, reports_to)) {
      return res.status(400).json({ error: 'This change would create a circular reporting chain.' });
    }
  }

  const roleChanging = role !== undefined && role !== target.role;
  if (roleChanging && target.role === UserRole.APPROVER && role !== UserRole.APPROVER) {
    const reportees = state.users.filter(u => u.reports_to === target.id);
    if (reportees.length > 0 && !confirmOrphan) {
      return res.status(409).json({
        error: 'orphan_warning',
        message: `${target.name} still has ${reportees.length} direct report${reportees.length > 1 ? 's' : ''} (${reportees.map(u => u.name).join(', ')}) who will be left without a valid approver. Confirm to proceed anyway.`,
        reportees: reportees.map(u => ({ id: u.id, name: u.name }))
      });
    }
  }

  const changed: string[] = [];
  const staleFlaggedClaims: Claim[] = [];

  if (role !== undefined && role !== target.role) {
    addUserHistory(target.id, target.role, role, admin.id, `Changed ${target.name}'s role`);
    target.role = role;
    changed.push('role');
    if (role !== UserRole.APPROVER && target.can_approve_reimbursements) {
      addUserHistory(target.id, 'true', 'false', admin.id, `Approval authority revoked — ${target.name} is no longer an Approver`);
      target.can_approve_reimbursements = false;
    }
  }
  if (department !== undefined && department !== target.department) {
    addUserHistory(target.id, target.department, department, admin.id, `Changed ${target.name}'s department`);
    target.department = department;
    changed.push('department');
  }
  if (job_title !== undefined && job_title !== target.job_title) {
    addUserHistory(target.id, target.job_title || '(none)', job_title || '(none)', admin.id, `Changed ${target.name}'s job title`);
    target.job_title = job_title;
    changed.push('job_title');
  }
  if (reports_to !== undefined && reports_to !== target.reports_to) {
    const oldManagerId = target.reports_to;
    const oldManagerName = state.users.find(u => u.id === oldManagerId)?.name || '(none)';
    const newManagerName = reports_to ? (state.users.find(u => u.id === reports_to)?.name || reports_to) : '(none)';
    addUserHistory(target.id, oldManagerName, newManagerName, admin.id, `Changed ${target.name}'s reporting manager`);
    target.reports_to = reports_to;
    changed.push('reports_to');

    recalcApprovalAuthority(oldManagerId);
    recalcApprovalAuthority(reports_to);
    await detectStaleApprovers(target.id, oldManagerId, reports_to, admin.id);
  }
  if (employment_status !== undefined && employment_status !== target.employment_status) {
    addUserHistory(target.id, target.employment_status || 'Active', employment_status, admin.id, `Changed ${target.name}'s employment status`);
    target.employment_status = employment_status;
    changed.push('employment_status');
    if (employment_status === 'Inactive') {
      state.claims.forEach(c => {
        if (c.current_approver_id === target.id && c.status === ClaimStatus.PENDING_APPROVAL && !c.approver_stale_since) {
          c.approver_stale_since = new Date().toISOString();
          c.pending_transfer_to = null;
          c.approver_stale_reason = `${target.name} is now marked Inactive.`;
          staleFlaggedClaims.push(c);
        }
      });
    }
  }
  if (can_approve_reimbursements !== undefined && can_approve_reimbursements !== target.can_approve_reimbursements) {
    if (can_approve_reimbursements && target.role !== UserRole.APPROVER) {
      return res.status(400).json({ error: `Only Approvers can be granted approval authority. ${target.name} is currently ${target.role} — change their role first.` });
    }
    addUserHistory(target.id, String(target.can_approve_reimbursements), String(can_approve_reimbursements), admin.id, `Admin override: ${target.name}'s approval authority`);
    target.can_approve_reimbursements = can_approve_reimbursements;
    changed.push('can_approve_reimbursements');
  }

  try {
    await syncUsersToDb(state.users);
    for (const claim of staleFlaggedClaims) await persistClaim(claim);
  } catch (err) {
    console.error('[db] Could not persist user/claim changes to Postgres:', err);
  }

  res.json({ user: target, changed });
});
