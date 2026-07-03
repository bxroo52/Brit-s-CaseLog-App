'use client';

import { useEffect } from 'react';

export function PWARegister() {
  useEffect(() => {
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker
          .register('/sw.js')
          .then((registration) => {
            // Handle updates
            registration.onupdatefound = () => {
              const installingWorker = registration.installing;
              if (installingWorker) {
                installingWorker.onstatechange = () => {
                  if (installingWorker.state === 'installed' && navigator.serviceWorker.controller) {
                    // New content available, could show update toast
                    console.log('CaseLog: New content available, reload for update.');
                  }
                };
              }
            };
          })
          .catch((err) => {
            console.warn('SW registration failed (non-fatal)', err);
          });
      });
    }

    // Capture beforeinstallprompt for Android/Chrome install
    let deferredPrompt: any;
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      deferredPrompt = e;
      // Store for use in Settings or button
      (window as any).deferredPwaPrompt = deferredPrompt;
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstall);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
    };
  }, []);

  return null;
}
