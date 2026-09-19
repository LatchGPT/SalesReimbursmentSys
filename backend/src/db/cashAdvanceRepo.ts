import type {
  cash_advances as CashAdvanceRow,
  cash_advance_status,
  liquidation_line_items as LiquidationLineItemRow,
  liquidations as LiquidationRow,
  liquidation_status,
  liquidation_variance_type,
  status_histories as StatusHistoryRow,
} from '../../../src/generated/prisma/client';
import { serverEnv } from '../../../src/config/env';
import {
  CashAdvanceStatus,
  LiquidationStatus,
  LiquidationVarianceType,
} from '../serverTypes';
import type {
  CashAdvance,
  Liquidation,
  LiquidationLineItem,
  StatusHistory,
} from '../serverTypes';
import { getDb } from './index';

export const isDbConfigured = () => !!serverEnv.databaseUrl;

function cashAdvanceToRow(cashAdvance: CashAdvance) {
  return {
    id: cashAdvance.id,
    requestor_id: cashAdvance.requestorId,
    amount: cashAdvance.amount,
    purpose: cashAdvance.purpose,
    mom_id: cashAdvance.momId ?? null,
    approver_id: cashAdvance.approverId,
    approved_at: cashAdvance.approvedAt
      ? new Date(cashAdvance.approvedAt)
      : null,
    paid_amount: cashAdvance.paidAmount ?? null,
    released_by: cashAdvance.releasedBy ?? null,
    release_date: cashAdvance.releaseDate
      ? new Date(cashAdvance.releaseDate)
      : null,
    release_reference: cashAdvance.releaseReference ?? null,
    release_method: cashAdvance.releaseMethod ?? null,
    status: cashAdvance.status as cash_advance_status,
    reminder_sent: cashAdvance.reminderSent ?? false,
  };
}

function cashAdvanceFromRow(row: CashAdvanceRow): CashAdvance {
  return {
    id: row.id,
    requestorId: row.requestor_id,
    amount: Number(row.amount),
    purpose: row.purpose,
    momId: row.mom_id ?? undefined,
    approverId: row.approver_id,
    approvedAt: row.approved_at?.toISOString(),
    paidAmount: row.paid_amount !== null ? Number(row.paid_amount) : undefined,
    releasedBy: row.released_by ?? undefined,
    releaseDate: row.release_date?.toISOString(),
    releaseReference: row.release_reference ?? undefined,
    releaseMethod: row.release_method ?? undefined,
    status: row.status as CashAdvanceStatus,
    reminderSent: row.reminder_sent ?? undefined,
    createdAt: row.created_at.toISOString(),
  };
}

export async function persistCashAdvance(
  cashAdvance: CashAdvance,
): Promise<void> {
  if (!isDbConfigured()) return;
  const row = cashAdvanceToRow(cashAdvance);
  await getDb().cash_advances.upsert({
    where: { id: row.id },
    create: { ...row, created_at: new Date(cashAdvance.createdAt) },
    update: row,
  });
}

function liquidationToRow(liquidation: Liquidation) {
  return {
    id: liquidation.id,
    cash_advance_id: liquidation.cashAdvanceId,
    requestor_id: liquidation.requestorId,
    total_spent: liquidation.totalSpent,
    variance_amount: liquidation.varianceAmount,
    variance_type: liquidation.varianceType as liquidation_variance_type,
    status: liquidation.status as liquidation_status,
    refund_method: liquidation.refundMethod ?? null,
  };
}

function liquidationFromRow(row: LiquidationRow): Liquidation {
  return {
    id: row.id,
    cashAdvanceId: row.cash_advance_id,
    requestorId: row.requestor_id,
    totalSpent: Number(row.total_spent),
    varianceAmount: Number(row.variance_amount),
    varianceType: row.variance_type as LiquidationVarianceType,
    status: row.status as LiquidationStatus,
    createdAt: row.created_at.toISOString(),
    refundMethod: row.refund_method ?? undefined,
  };
}

export async function persistLiquidation(
  liquidation: Liquidation,
): Promise<void> {
  if (!isDbConfigured()) return;
  const row = liquidationToRow(liquidation);
  await getDb().liquidations.upsert({
    where: { id: row.id },
    create: { ...row, created_at: new Date(liquidation.createdAt) },
    update: row,
  });
}

function lineItemToRow(item: LiquidationLineItem) {
  return {
    id: item.id,
    liquidation_id: item.liquidationId,
    expense_date: item.expense_date,
    vendor: item.vendor,
    category: item.category,
    amount: item.amount,
    payment_method: item.payment_method,
    business_purpose: item.business_purpose,
    receipt_url: item.receipt_url ?? null,
    attachment_type: item.attachment_type ?? null,
    or_number: item.or_number ?? null,
  };
}

function lineItemFromRow(row: LiquidationLineItemRow): LiquidationLineItem {
  return {
    id: row.id,
    liquidationId: row.liquidation_id,
    expense_date: row.expense_date,
    vendor: row.vendor,
    category: row.category,
    amount: Number(row.amount),
    payment_method: row.payment_method,
    business_purpose: row.business_purpose,
    receipt_url: row.receipt_url ?? undefined,
    attachment_type: row.attachment_type ?? undefined,
    or_number: row.or_number ?? undefined,
  };
}

export async function persistLiquidationLineItems(
  liquidationId: string,
  items: LiquidationLineItem[],
): Promise<void> {
  if (!isDbConfigured()) return;
  await getDb().$transaction(async (tx) => {
    await tx.liquidation_line_items.deleteMany({
      where: { liquidation_id: liquidationId },
    });
    if (items.length > 0) {
      await tx.liquidation_line_items.createMany({
        data: items.map(lineItemToRow),
      });
    }
  });
}

export async function persistLiquidationLineItem(
  item: LiquidationLineItem,
): Promise<void> {
  if (!isDbConfigured()) return;
  const row = lineItemToRow(item);
  await getDb().liquidation_line_items.upsert({
    where: { id: row.id },
    create: row,
    update: row,
  });
}

export async function deleteLiquidationLineItem(itemId: string): Promise<void> {
  if (!isDbConfigured()) return;
  await getDb().liquidation_line_items.deleteMany({ where: { id: itemId } });
}

export async function clearCashAdvanceLoopInDb(): Promise<void> {
  if (!isDbConfigured()) return;
  await getDb().$transaction(async (tx) => {
    await tx.liquidation_line_items.deleteMany();
    await tx.liquidations.deleteMany();
    await tx.cash_advances.deleteMany();
  });
}

function historyFromRow(row: StatusHistoryRow): StatusHistory {
  return {
    id: row.id,
    claim_id: '',
    cash_advance_id: row.cash_advance_id ?? undefined,
    liquidation_id: row.liquidation_id ?? undefined,
    old_status: row.old_status,
    new_status: row.new_status,
    changed_by: row.changed_by,
    reason: row.reason ?? undefined,
    timestamp: row.timestamp.toISOString(),
  };
}

export async function loadCashAdvanceLoopFromDb(): Promise<{
  cashAdvances: CashAdvance[];
  liquidations: Liquidation[];
  liquidationLineItems: LiquidationLineItem[];
  statusHistories: StatusHistory[];
}> {
  if (!isDbConfigured()) {
    return {
      cashAdvances: [],
      liquidations: [],
      liquidationLineItems: [],
      statusHistories: [],
    };
  }
  const db = getDb();
  const [caRows, liquidationRows, lineItemRows, historyRows] = await Promise.all([
    db.cash_advances.findMany(),
    db.liquidations.findMany(),
    db.liquidation_line_items.findMany(),
    db.status_histories.findMany({
      where: {
        OR: [
          { cash_advance_id: { not: null } },
          { liquidation_id: { not: null } },
        ],
      },
    }),
  ]);
  return {
    cashAdvances: caRows.map(cashAdvanceFromRow),
    liquidations: liquidationRows.map(liquidationFromRow),
    liquidationLineItems: lineItemRows.map(lineItemFromRow),
    statusHistories: historyRows.map(historyFromRow),
  };
}
