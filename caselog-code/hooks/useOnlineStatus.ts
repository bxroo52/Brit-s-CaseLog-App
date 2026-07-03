'use client';

import { useEffect, useState } from 'react';
import { getIsOnline, subscribeToOnlineStatus } from '@/lib/sync';

export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(getIsOnline());

  useEffect(() => {
    const unsub = subscribeToOnlineStatus((online) => setIsOnline(online));
    return unsub;
  }, []);

  return isOnline;
}
