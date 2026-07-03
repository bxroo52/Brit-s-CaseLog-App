'use client';

import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { useSync } from '@/hooks/useSync';
import { WifiOff } from 'lucide-react';
import { useState, useEffect } from 'react';
import { announce } from '@/lib/utils';

export function OfflineBanner() {
  const [mounted, setMounted] = useState(false);
  const isOnline = useOnlineStatus();
  const { pendingChangesCount } = useSync();

  useEffect(() => {
    setMounted(true);
  }, []);

  // Announce offline status (polite)
  useEffect(() => {
    if (mounted && !isOnline) {
      const msg = `You're offline — all changes saved locally. ${pendingChangesCount > 0 ? `${pendingChangesCount} pending changes will sync when back online.` : ''}`;
      announce(msg, false);
    }
  }, [isOnline, pendingChangesCount, mounted]);

  // Render nothing on server / first client render to match SSR HTML
  if (!mounted) return null;
  if (isOnline) {
    return null;
  }

  return (
    <div className="bg-amber-600 text-white text-center py-1.5 px-4 text-xs sm:text-sm flex items-center justify-center gap-2 z-50" suppressHydrationWarning>
      <WifiOff className="h-3.5 w-3.5 flex-shrink-0" />
      <span>
        You're offline — all changes saved locally. 
        {pendingChangesCount > 0 && ` ${pendingChangesCount} pending change${pendingChangesCount > 1 ? 's' : ''} will sync when back online.`}
      </span>
    </div>
  );
}
