'use client';

import { useSync } from '@/hooks/useSync';
import { Button } from '@/components/ui/button';
import { useAppStore } from '@/stores/useAppStore';
import { Cloud, CloudOff, RefreshCw, AlertTriangle } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

export function SyncStatus() {
  const { isOnline, isSyncing, pendingChangesCount, lastSync, syncNow } = useSync();
  const { refreshSyncStatus } = useAppStore();

  const hasPending = pendingChangesCount > 0;

  let label = 'All synced';
  let Icon = Cloud;
  let color = 'text-green-600';

  if (!isOnline) {
    label = hasPending ? 'Offline — changes saved locally' : 'Offline';
    Icon = CloudOff;
    color = 'text-amber-600';
  } else if (isSyncing) {
    label = 'Syncing...';
    Icon = RefreshCw;
    color = 'text-blue-600';
  } else if (hasPending) {
    label = `${pendingChangesCount} change${pendingChangesCount === 1 ? '' : 's'} pending`;
    Icon = AlertTriangle;
    color = 'text-orange-600';
  }

  const lastSyncText = lastSync
    ? formatDistanceToNow(new Date(lastSync), { addSuffix: true })
    : 'never';

  return (
    <div className="flex items-center gap-2 text-xs">
      <div className={`flex items-center gap-1.5 ${color}`}>
        <Icon className={`h-3.5 w-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
        <span>{label}</span>
      </div>

      {hasPending && isOnline && (
        <Button
          variant="ghost"
          size="sm"
          className="h-6 px-2 text-[10px]"
          onClick={async () => {
            await syncNow();
            refreshSyncStatus();
          }}
        >
          Sync now
        </Button>
      )}

      {!hasPending && lastSync && (
        <span className="text-muted-foreground/70">• {lastSyncText}</span>
      )}
    </div>
  );
}
