import { db, SyncQueueItem } from './db';
import { supabase } from './supabase';

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

        const { error } = await supabase
          .from(remoteTable)
          .upsert(item.payload, { onConflict: 'id' });

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
      ...c,
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
      ...t,
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
      ...e,
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
}

// Auto-sync when we come back online
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    syncNow();
  });
}
