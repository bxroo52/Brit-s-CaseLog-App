'use client';

import { useEffect } from 'react';
import { useAppStore } from '@/stores/useAppStore';
import { subscribeToOnlineStatus, syncNow as runSyncNow } from '@/lib/sync';

export function useSync() {
  const {
    isOnline,
    isSyncing,
    pendingChangesCount,
    lastSync,
    refreshSyncStatus,
    syncNow,
  } = useAppStore();

  useEffect(() => {
    // Subscribe to connectivity changes and refresh status
    const unsub = subscribeToOnlineStatus(() => {
      refreshSyncStatus();
    });

    // Initial status
    refreshSyncStatus();

    // Opportunistic sync when the hook mounts and we're online
    if (typeof navigator !== 'undefined' && navigator.onLine) {
      // Don't block
      setTimeout(() => runSyncNow().catch(() => {}), 1200);
    }

    return unsub;
  }, [refreshSyncStatus]);

  return {
    isOnline,
    isSyncing,
    pendingChangesCount,
    lastSync,
    syncNow,
    refreshSyncStatus,
  };
}
