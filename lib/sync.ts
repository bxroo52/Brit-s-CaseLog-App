import { db, SyncQueueItem } from './db';
import { supabase } from './supabase';
import { toast } from 'sonner';
import { announce } from './utils';

// Normalize camelCase (TS/Dexie) <-> snake_case (Supabase) for sync
function toSupabasePayload(record: any) {
  if (!record) return record;
  const p = { ...record };
  if (p.userId !== undefined) {
    p.user_id = p.userId;
    // keep userId too? or delete, but to be safe for local keep, but for upsert send both ok-ish
  }
  // Map other common if needed (for robustness)
  if (p.respondentName !== undefined) p.respondent_name = p.respondentName;
  if (p.caseNumber !== undefined) p.case_number = p.caseNumber;
  if (p.assignmentType !== undefined) p.assignment_type = p.assignmentType;
  if (p.hourlyRate !== undefined) p.hourly_rate = p.hourlyRate;
  if (p.firstTimeBilling !== undefined) p.first_time_billing = p.firstTimeBilling;
  if (p.caseNotes !== undefined) p.case_notes = p.caseNotes;
  if (p.billableHoursRounded !== undefined) p.billable_hours_rounded = p.billableHoursRounded;
  if (p.activityType !== undefined) p.activity_type = p.activityType;
  if (p.expenseType !== undefined) p.expense_type = p.expenseType;
  if (p.billingStatus !== undefined) p.billing_status = p.billingStatus;
  if (p.billingMonth !== undefined) p.billing_month = p.billingMonth;
  if (p.createdAt !== undefined) p.created_at = p.createdAt;
  if (p.updatedAt !== undefined) p.updated_at = p.updatedAt;
  if (p.isDeleted !== undefined) p.is_deleted = p.isDeleted;
  if (p.caseId !== undefined) p.case_id = p.caseId;
  if (p.activityRate !== undefined) p.activity_rate = p.activityRate;
  if (p.totalAmount !== undefined) p.total_amount = p.totalAmount;
  return p;
}

function fromSupabaseRow(row: any) {
  if (!row) return row;
  const r = { ...row };
  if (r.user_id !== undefined) r.userId = r.user_id;
  if (r.respondent_name !== undefined) r.respondentName = r.respondent_name;
  if (r.case_number !== undefined) r.caseNumber = r.case_number;
  if (r.assignment_type !== undefined) r.assignmentType = r.assignment_type;
  if (r.hourly_rate !== undefined) r.hourlyRate = r.hourly_rate;
  if (r.first_time_billing !== undefined) r.firstTimeBilling = r.first_time_billing;
  if (r.case_notes !== undefined) r.caseNotes = r.case_notes;
  if (r.billable_hours_rounded !== undefined) r.billableHoursRounded = r.billable_hours_rounded;
  if (r.activity_type !== undefined) r.activityType = r.activity_type;
  if (r.expense_type !== undefined) r.expenseType = r.expense_type;
  if (r.billing_status !== undefined) r.billingStatus = r.billing_status;
  if (r.billing_month !== undefined) r.billingMonth = r.billing_month;
  if (r.created_at !== undefined) r.createdAt = r.created_at;
  if (r.updated_at !== undefined) r.updatedAt = r.updated_at;
  if (r.is_deleted !== undefined) r.isDeleted = r.is_deleted;
  if (r.case_id !== undefined) r.caseId = r.case_id;
  if (r.activity_rate !== undefined) r.activityRate = r.activity_rate;
  if (r.total_amount !== undefined) r.totalAmount = r.total_amount;
  return r;
}

// --- Queue a change (call AFTER the optimistic local Dexie write) ---
export async function queueChange(
  operation: 'upsert' | 'delete',
  table: SyncQueueItem['table'],
  recordId: string,
  payload: any
) {
  // Optimistic write already happened in the calling function
  await db.syncQueue.add({
    operation,
    table,
    recordId,
    payload,
    timestamp: new Date().toISOString(),
    retryCount: 0,
  });
}

export async function processSyncQueue() {
  const pending = await db.syncQueue.orderBy('timestamp').toArray();
  if (pending.length === 0) return { success: true, processed: 0 };

  let processed = 0;

  for (const item of pending) {
    try {
      if (!supabase) {
        // No Supabase configured — leave items in queue
        break;
      }

      if (item.operation === 'upsert') {
        const remoteTable =
          item.table === 'timeEntries' ? 'time_entries' : item.table;

        const payloadForSupabase = toSupabasePayload(item.payload);
        const { error } = await supabase
          .from(remoteTable)
          .upsert(payloadForSupabase, { onConflict: 'id' });

        if (error) throw error;
      } else if (item.operation === 'delete') {
        const remoteTable =
          item.table === 'timeEntries' ? 'time_entries' : item.table;

        const { error } = await supabase
          .from(remoteTable)
          .delete()
          .eq('id', item.recordId);

        if (error) throw error;
      }

      // Success — remove from queue
      if (item.id !== undefined) {
        await db.syncQueue.delete(item.id);
      }
      processed++;
    } catch (err: any) {
      // Increment retry and store error
      if (item.id !== undefined) {
        await db.syncQueue.update(item.id, {
          retryCount: item.retryCount + 1,
          lastError: err?.message || String(err),
        });
      }

      if ((item.retryCount + 1) > 5) {
        console.error('Max retries reached for sync item', item);
      }
    }
  }

  return { success: processed > 0, processed };
}

// Simple incremental pull (call after successful push or on a schedule)
export async function pullLatestChanges(lastSync: string) {
  if (!supabase) return { pulled: 0 };

  let pulled = 0;

  // Cases
  const { data: caseRows } = await supabase
    .from('cases')
    .select('*')
    .gt('updated_at', lastSync);

  if (caseRows?.length) {
    const normalized = caseRows.map((c: any) => ({
      ...fromSupabaseRow(c),
      synced: true,
      isDeleted: c.is_deleted ?? c.isDeleted ?? false,
    }));
    await db.cases.bulkPut(normalized);
    pulled += normalized.length;
  }

  // Time entries
  const { data: timeRows } = await supabase
    .from('time_entries')
    .select('*')
    .gt('updated_at', lastSync);

  if (timeRows?.length) {
    const normalized = timeRows.map((t: any) => ({
      ...fromSupabaseRow(t),
      synced: true,
      isDeleted: t.is_deleted ?? t.isDeleted ?? false,
    }));
    await db.timeEntries.bulkPut(normalized);
    pulled += normalized.length;
  }

  // Expenses
  const { data: expRows } = await supabase
    .from('expenses')
    .select('*')
    .gt('updated_at', lastSync);

  if (expRows?.length) {
    const normalized = expRows.map((e: any) => ({
      ...fromSupabaseRow(e),
      synced: true,
      isDeleted: e.is_deleted ?? e.isDeleted ?? false,
    }));
    await db.expenses.bulkPut(normalized);
    pulled += normalized.length;
  }

  return { pulled };
}

// Main sync entry point — call on "online" event or manual "Sync Now"
export async function syncNow() {
  if (!navigator.onLine || !supabase) {
    return { success: false, processed: 0, pulled: 0 };
  }

  const pushResult = await processSyncQueue();

  const lastSyncKey = 'caselog:lastPullAt';
  const lastSync =
    (typeof localStorage !== 'undefined' && localStorage.getItem(lastSyncKey)) ||
    '1970-01-01T00:00:00.000Z';

  const pullResult = await pullLatestChanges(lastSync);

  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(lastSyncKey, new Date().toISOString());
  }

  const total = pushResult.processed + pullResult.pulled;
  if (total > 0) {
    const msg = `Synced ${pushResult.processed} changes • pulled ${pullResult.pulled}`;
    toast.success(msg);
    announce(msg, false); // polite
  }

  return {
    success: pushResult.processed > 0 || pullResult.pulled > 0,
    processed: pushResult.processed,
    pulled: pullResult.pulled,
  };
}

// --- Connectivity helpers (used by UI components) ---
export function getIsOnline(): boolean {
  return typeof navigator !== 'undefined' ? navigator.onLine : true;
}

export function subscribeToOnlineStatus(
  callback: (online: boolean) => void
): () => void {
  if (typeof window === 'undefined') return () => {};

  const handler = () => callback(navigator.onLine);
  window.addEventListener('online', handler);
  window.addEventListener('offline', handler);

  return () => {
    window.removeEventListener('online', handler);
    window.removeEventListener('offline', handler);
  };
}

// --- UI helpers ---
export async function getPendingQueueCount(): Promise<number> {
  return db.syncQueue.count();
}

export async function getPendingQueueItems(): Promise<SyncQueueItem[]> {
  return db.syncQueue.orderBy('timestamp').toArray();
}

// Demo helper for Settings "Test Offline" button
export async function simulateOfflineMode(durationMs = 15000) {
  const original = navigator.onLine;
  Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });

  setTimeout(() => {
    Object.defineProperty(navigator, 'onLine', { value: original, configurable: true });
    window.dispatchEvent(new Event('online'));
    syncNow();
  }, durationMs);
}

// Kept for Settings "Clear Local Data" button
export async function clearAllLocalData() {
  await db.syncQueue.clear();
  await db.cases.clear();
  await db.timeEntries.clear();
  await db.expenses.clear();
  await db.activityRates.clear();
  await db.rateChangeLogs.clear();
}

// Auto-sync when we come back online
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    toast.info('Back online — syncing changes...');
    announce('Back online — syncing changes...', false);
    syncNow();
  });
}
