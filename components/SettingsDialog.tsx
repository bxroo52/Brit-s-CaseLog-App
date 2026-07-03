'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAppStore } from '@/stores/useAppStore';
import { UserProfile } from '@/types';
import { toast } from 'sonner';
import { useSync } from '@/hooks/useSync';
import { simulateOfflineMode, getPendingQueueItems } from '@/lib/sync';
import { isSupabaseConfigured } from '@/lib/supabase';
import { db } from '@/lib/db';
import { ACTIVITY_TYPES, DEFAULT_HOURLY_RATE } from '@/lib/constants';
import { getActivityRates, setActivityRate, initializeDefaultActivityRates } from '@/lib/db';

interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SettingsDialog({ open, onOpenChange }: SettingsDialogProps) {
  const { profile, saveProfile, user, saveActivityRate: storeSaveRate, loadActivityRates } = useAppStore();
  const [form, setForm] = useState<Partial<UserProfile>>({});
  const [rates, setRates] = useState<Record<string, number>>({});
  const [savingRates, setSavingRates] = useState(false);

  useEffect(() => {
    if (profile) {
      setForm({ name: profile.name, email: profile.email, phone: profile.phone });
    }
  }, [profile, open]);

  // Load activity rates when dialog opens
  useEffect(() => {
    if (open) {
      const userId = user?.id;
      initializeDefaultActivityRates(userId).then(() => {
        getActivityRates(userId).then((loaded) => {
          const map: Record<string, number> = {};
          ACTIVITY_TYPES.forEach((act) => {
            const found = loaded.find(r => r.activityName === act);
            map[act] = found ? found.hourlyRate : DEFAULT_HOURLY_RATE;
          });
          setRates(map);
        });
      });
    }
  }, [open, user]);

  const handleSave = async () => {
    try {
      // Only save the kept profile fields
      const cleanForm = {
        name: form.name,
        email: form.email,
        phone: form.phone,
      };
      await saveProfile(cleanForm);
      toast.success('Profile saved.');
      onOpenChange(false);
    } catch {
      toast.error('Failed to save settings.');
    }
  };

  const handleRateChange = (activity: string, value: string) => {
    const num = parseFloat(value);
    setRates((prev) => ({
      ...prev,
      [activity]: isNaN(num) ? 0 : Math.max(0, Math.round(num * 100) / 100),
    }));
  };

  const saveRate = async (activity: string) => {
    const rate = rates[activity];
    if (rate === undefined) return;
    setSavingRates(true);
    try {
      await storeSaveRate(activity, rate);
      toast.success(`Rate for ${activity} saved.`);
    } catch {
      toast.error('Failed to save rate.');
    } finally {
      setSavingRates(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90dvh] flex flex-col gap-2 overflow-hidden !top-3 !-translate-y-0 sm:!top-1/2 sm:!-translate-y-1/2">
        <DialogHeader>
          <DialogTitle>Your Info (for Invoices)</DialogTitle>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-y-auto space-y-3 py-0.5 pr-1 -mr-1">
          <div>
            <Label>Your Name</Label>
            <Input value={form.name || ''} onChange={(e) => setForm({ ...form, name: e.target.value })} className="mt-1.5" />
          </div>

          <div>
            <Label>Email</Label>
            <Input value={form.email || ''} onChange={(e) => setForm({ ...form, email: e.target.value })} className="mt-1.5" />
          </div>

          <div>
            <Label>Phone</Label>
            <Input value={form.phone || ''} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="mt-1.5" />
          </div>

          {/* Activity Rates Section */}
          <div className="border-t pt-3 mt-2 space-y-2">
            <Label className="font-medium">Activity Rates</Label>
            <p className="text-[10px] text-muted-foreground">Set your hourly rate for each activity type (used in Log Time).</p>
            <div className="space-y-2">
              {ACTIVITY_TYPES.map((activity) => {
                const rate = rates[activity] ?? DEFAULT_HOURLY_RATE;
                return (
                  <div key={activity} className="flex items-center justify-between gap-2">
                    <span className="text-sm flex-1">{activity}</span>
                    <div className="flex items-center gap-1 w-28">
                      <span className="text-muted-foreground text-xs">$</span>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        value={rate === 0 ? '' : rate.toFixed(2)}
                        onChange={(e) => handleRateChange(activity, e.target.value)}
                        onBlur={() => saveRate(activity)}
                        className="h-8 text-right font-mono text-sm"
                        placeholder={DEFAULT_HOURLY_RATE.toFixed(2)}
                        disabled={savingRates}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* PWA Install Prompt */}
          <div className="border-t pt-3 mt-1.5 space-y-2">
            <div>
              <Label className="font-medium">Install CaseLog App</Label>
              <p className="text-xs text-muted-foreground">
                Add to home screen for the best offline experience on mobile.
              </p>
            </div>
            <Button
              className="h-10 w-full"
              variant="default"
              onClick={() => {
                const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
                const deferredPrompt = (window as any).deferredPwaPrompt;

                if (isIOS) {
                  alert(
                    "On iPhone:\n1. Tap the Share button (⬆️ square with arrow) at the bottom of Safari.\n2. Scroll down and tap 'Add to Home Screen'.\n3. Tap 'Add'."
                  );
                } else if (deferredPrompt) {
                  deferredPrompt.prompt();
                  (window as any).deferredPwaPrompt = null;
                } else {
                  // Fallback
                  alert(
                    "To install:\n- On Chrome/Android: Look for the install icon in address bar or menu.\n- On iOS Safari: Use Share → Add to Home Screen."
                  );
                }
              }}
            >
              📱 Install App on Home Screen
            </Button>
            <p className="text-[10px] text-muted-foreground">
              Works great offline once installed.
            </p>
          </div>

          {/* Data Backup / Restore */}
          <div className="border-t pt-3 mt-1.5 space-y-2">
            <div>
              <Label className="font-medium">Backup &amp; Restore</Label>
              <p className="text-xs text-muted-foreground">Export or import all your local data as JSON.</p>
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <Button
                className="h-10 flex-1"
                variant="outline"
                onClick={async () => {
                  try {
                    const cases = await db.cases.toArray();
                    const timeEntries = await db.timeEntries.toArray();
                    const expenses = await db.expenses.toArray();
                    const profile = await db.profile.toArray();

                    const backup = {
                      version: 1,
                      exportedAt: new Date().toISOString(),
                      cases,
                      timeEntries,
                      expenses,
                      profile: profile[0] || null,
                    };

                    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `caselog-backup-${new Date().toISOString().slice(0,10)}.json`;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);

                    toast.success('Backup exported successfully. Keep it safe!');
                  } catch (err) {
                    toast.error('Failed to export backup.');
                    console.error(err);
                  }
                }}
              >
                Export All Data
              </Button>
              <Button
                className="h-10 flex-1"
                variant="outline"
                onClick={() => {
                  const input = document.createElement('input');
                  input.type = 'file';
                  input.accept = 'application/json';
                  input.onchange = async (e: any) => {
                    const file = e.target.files?.[0];
                    if (!file) return;

                    try {
                      const text = await file.text();
                      const backup = JSON.parse(text);

                      if (!backup.cases || !backup.timeEntries || !backup.expenses) {
                        throw new Error('Invalid backup file');
                      }

                      if (!confirm(`Import backup from ${backup.exportedAt}? This will merge/overwrite local data. Proceed?`)) {
                        return;
                      }

                      // Clear and re-add (or use bulkPut for merge)
                      await db.cases.clear();
                      await db.timeEntries.clear();
                      await db.expenses.clear();

                      if (backup.cases.length) await db.cases.bulkAdd(backup.cases);
                      if (backup.timeEntries.length) await db.timeEntries.bulkAdd(backup.timeEntries);
                      if (backup.expenses.length) await db.expenses.bulkAdd(backup.expenses);
                      if (backup.profile) await db.profile.put(backup.profile);

                      // Reload store data
                      await useAppStore.getState().loadAllData();
                      await useAppStore.getState().loadProfile();

                      toast.success('Backup imported successfully! Data reloaded.');
                      onOpenChange(false);
                    } catch (err) {
                      toast.error('Failed to import backup. Is it a valid CaseLog file?');
                      console.error(err);
                    }
                  };
                  input.click();
                }}
              >
                Import Backup
              </Button>
            </div>
            <p className="text-[10px] text-muted-foreground">
              Backups include all cases, logs, and your profile. Works offline.
            </p>
          </div>

          {/* Offline-first Sync Controls */}
          <div className="border-t pt-3 mt-1.5 space-y-2">
            <div>
              <Label className="font-medium">Sync &amp; Data</Label>
              <p className="text-xs text-muted-foreground">
                All work is saved locally first. Sync when online.
                {isSupabaseConfigured ? ' (Supabase connected)' : ' (Offline-only mode — no Supabase)'}
              </p>
            </div>

            <SyncControls onClose={() => onOpenChange(false)} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
          <Button onClick={handleSave}>Save Profile</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SyncControls({ onClose }: { onClose: () => void }) {
  const { pendingChangesCount, isOnline, isSyncing, syncNow, refreshSyncStatus } = useSync();
  const { clearLocalData } = useAppStore();
  const [pendingItems, setPendingItems] = useState<any[]>([]);

  useEffect(() => {
    getPendingQueueItems().then(setPendingItems);
  }, []);

  const handleSyncNow = async () => {
    await syncNow();
    const items = await getPendingQueueItems();
    setPendingItems(items);
    refreshSyncStatus();
  };

  const handleSimulateOffline = async () => {
    toast.info('Simulating offline for 15s...');
    await simulateOfflineMode(15000);
  };

  const handleClear = async () => {
    await clearLocalData();
    onClose();
  };

  return (
    <div className="space-y-2 text-sm">
      <div className="flex flex-wrap gap-2">
        <Button className="h-9" variant="outline" onClick={handleSyncNow} disabled={isSyncing || !isOnline}>
          {isSyncing ? 'Syncing…' : 'Sync Now'}
        </Button>
        <Button className="h-9" variant="outline" onClick={handleSimulateOffline}>
          Test Offline Mode
        </Button>
        <Button className="h-9" variant="destructive" onClick={handleClear}>
          Clear All Local Data
        </Button>
        <Button
          className="h-9"
          variant="outline"
          onClick={async () => {
            if (!confirm('Clear all pending sync items? This cannot be undone.')) return;
            await db.syncQueue.clear();
            setPendingItems([]);
            refreshSyncStatus();
            toast('Pending sync queue cleared.');
          }}
        >
          Clear Pending Queue
        </Button>
      </div>

      <div className="text-xs text-muted-foreground">
        Pending in queue: <span className="font-mono">{pendingChangesCount}</span>
        {pendingItems.length > 0 && (
          <div className="mt-1 max-h-20 overflow-auto text-[10px] bg-muted p-1 rounded">
            {pendingItems.slice(0, 4).map((q, i) => (
              <div key={i}>{q.operation} {q.table} • {new Date(q.timestamp).toLocaleTimeString()}</div>
            ))}
            {pendingItems.length > 4 && <div>... +{pendingItems.length - 4} more</div>}
          </div>
        )}
      </div>
    </div>
  );
}

