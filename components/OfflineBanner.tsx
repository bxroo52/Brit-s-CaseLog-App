'use client';

import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { useSync } from '@/hooks/useSync';
import { WifiOff } from 'lucide-react';

export function OfflineBanner() {
  const isOnline = useOnlineStatus();
  const { pendingChangesCount } = useSync();

  if (isOnline) return null;

  return (
    <div className="bg-amber-600 text-white text-center py-1.5 px-4 text-xs sm:text-sm flex items-center justify-center gap-2 z-50">
      <WifiOff className="h-3.5 w-3.5 flex-shrink-0" />
      <span>
        You're offline — all changes saved locally. 
        {pendingChangesCount > 0 && ` ${pendingChangesCount} pending change${pendingChangesCount > 1 ? 's' : ''} will sync when back online.`}
      </span>
    </div>
  );
}
