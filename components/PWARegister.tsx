'use client';

import { useEffect } from 'react';
import { showToast } from '@/app/components/Toast';

export function PWARegister() {
  useEffect(() => {
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker
          .register('/sw.js', { updateViaCache: 'none' })
          .then((registration) => {
            // Check for updates periodically / on visibility to catch deploys fast
            const checkForUpdate = () => {
              if (registration) {
                registration.update().catch(() => {});
              }
            };
            // On visibility change (user returns to PWA) check for update
            document.addEventListener('visibilitychange', () => {
              if (document.visibilityState === 'visible') {
                checkForUpdate();
              }
            });
            // Also check shortly after load
            setTimeout(checkForUpdate, 30000);

            // Handle SW updates -> show toast + force activate + refresh
            registration.onupdatefound = () => {
              const installingWorker = registration.installing;
              if (installingWorker) {
                installingWorker.onstatechange = () => {
                  if (installingWorker.state === 'installed' && navigator.serviceWorker.controller) {
                    console.log('CaseLog: New version detected via SW update.');
                    showToast('New version available. Refreshing...', 'success');

                    // Tell new SW to activate immediately
                    if (registration.waiting) {
                      registration.waiting.postMessage({ type: 'SKIP_WAITING' });
                    }

                    // Give SW a moment then hard refresh so fresh assets load
                    setTimeout(() => {
                      window.location.reload();
                    }, 1200);
                  }
                };
              }
            };

            // If controller changes (new SW took over), ensure we are fresh
            navigator.serviceWorker.addEventListener('controllerchange', () => {
              // Reload once to pick up new service worker control + assets
              const w = window as any;
              if (!w.__caselogReloaded) {
                w.__caselogReloaded = true;
                window.location.reload();
              }
            });
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
