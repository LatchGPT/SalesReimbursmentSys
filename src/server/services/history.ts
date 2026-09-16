import { v4 as uuidv4 } from 'uuid';
import { state } from '../state';
import { persistStatusHistoryFireAndForget } from '../../db/coreLoopRepo';

export function addHistory(claimId: string, oldStatus: string, newStatus: string, changedBy: string, reason?: string) {
  const entry = {
    id: uuidv4(),
    claim_id: claimId,
    old_status: oldStatus,
    new_status: newStatus,
    changed_by: changedBy,
    reason,
    timestamp: new Date().toISOString()
  };
  state.statusHistories.push(entry);
  if (!state.suppressHistoryPersistence) persistStatusHistoryFireAndForget(entry);
}

export function addCaHistory(caId: string, oldStatus: string, newStatus: string, changedBy: string, reason?: string) {
  const entry = {
    id: uuidv4(),
    claim_id: '',
    cash_advance_id: caId,
    old_status: oldStatus,
    new_status: newStatus,
    changed_by: changedBy,
    reason,
    timestamp: new Date().toISOString()
  };
  state.statusHistories.push(entry);
  if (!state.suppressHistoryPersistence) persistStatusHistoryFireAndForget(entry);
}

export function addLiqHistory(liqId: string, oldStatus: string, newStatus: string, changedBy: string, reason?: string) {
  const entry = {
    id: uuidv4(),
    claim_id: '',
    liquidation_id: liqId,
    old_status: oldStatus,
    new_status: newStatus,
    changed_by: changedBy,
    reason,
    timestamp: new Date().toISOString()
  };
  state.statusHistories.push(entry);
  if (!state.suppressHistoryPersistence) persistStatusHistoryFireAndForget(entry);
}

export function addUserHistory(userId: string, oldStatus: string, newStatus: string, changedBy: string, reason?: string) {
  const entry = {
    id: uuidv4(),
    claim_id: '',
    user_id: userId,
    old_status: oldStatus,
    new_status: newStatus,
    changed_by: changedBy,
    reason,
    timestamp: new Date().toISOString()
  };
  state.statusHistories.push(entry);
  if (!state.suppressHistoryPersistence) persistStatusHistoryFireAndForget(entry);
}

export function addDelegationHistory(delegationId: string, oldStatus: string, newStatus: string, changedBy: string, reason?: string) {
  const entry = {
    id: uuidv4(),
    claim_id: '',
    delegation_id: delegationId,
    old_status: oldStatus,
    new_status: newStatus,
    changed_by: changedBy,
    reason,
    timestamp: new Date().toISOString()
  };
  state.statusHistories.push(entry);
  if (!state.suppressHistoryPersistence) persistStatusHistoryFireAndForget(entry);
}

export function addMasterDataHistory(entityKey: string, recordId: string, field: string, oldVal: string, newVal: string, changedBy: string) {
  const entry = {
    id: uuidv4(),
    claim_id: '',
    master_data_key: entityKey,
    master_data_id: recordId,
    old_status: `${field}: ${oldVal}`,
    new_status: `${field}: ${newVal}`,
    changed_by: changedBy,
    reason: `Changed ${entityKey} ${field}`,
    timestamp: new Date().toISOString()
  };
  state.statusHistories.push(entry);
  if (!state.suppressHistoryPersistence) persistStatusHistoryFireAndForget(entry);
}
