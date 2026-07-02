'use client';

import { useEffect, useState } from 'react';
import { getIsOnline, subscribeToOnlineStatus } from '@/lib/sync';

export function useOnlineStatus() {
  // Default to true (online) for server render to avoid hydration mismatch.
  // Actual value set in effect after client mount.
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    setIsOnline(getIsOnline());
    const unsub = subscribeToOnlineStatus((online) => setIsOnline(online));
    return unsub;
  }, []);

  return isOnline;
}
