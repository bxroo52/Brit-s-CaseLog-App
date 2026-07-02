'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useAppStore } from '@/stores/useAppStore';
import { UserProfile, Case, TimeEntry, Expense } from '@/types';
import { toast } from 'sonner';
import { useSync } from '@/hooks/useSync';
import { simulateOfflineMode, getPendingQueueItems } from '@/lib/sync';
import { isSupabaseConfigured } from '@/lib/supabase';
import { db } from '@/lib/db';
import { useTheme } from "next-themes";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SettingsDialog({ open, onOpenChange }: SettingsDialogProps) {
  const { profile, saveProfile } = useAppStore();
  const { theme, setTheme } = useTheme();
  const [form, setForm] = useState<Partial<UserProfile>>({});

  useEffect(() => {
    if (profile) {
      setForm({ ...profile });
    }
  }, [profile, open]);

  // Sync current theme from next-themes to form (or local)
  const [selectedTheme, setSelectedTheme] = useState<string>(theme || 'system');

  useEffect(() => {
    if (theme) {
      setSelectedTheme(theme);
    }
  }, [theme]);

  const handleSave = async () => {
    try {
      await saveProfile(form);
      toast.success('Profile saved. Your invoices will look sharp.');
      onOpenChange(false);
    } catch {
      toast.error('Failed to save settings.');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90dvh] flex flex-col gap-2 overflow-hidden !top-3 !-translate-y-0 sm:!top-1/2 sm:!-translate-y-1/2">
        <DialogHeader>
          <DialogTitle>Your Info (for Invoices)</DialogTitle>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-y-auto space-y-3 py-0.5 pr-1 -mr-1">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <div>
              <Label>Your Name</Label>
              <Input value={form.name || ''} onChange={(e) => setForm({ ...form, name: e.target.value })} className="mt-1.5" />
            </div>
            <div>
              <Label>Title / Role</Label>
              <Input value={form.title || ''} onChange={(e) => setForm({ ...form, title: e.target.value })} className="mt-1.5" />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <div>
              <Label>Email</Label>
              <Input value={form.email || ''} onChange={(e) => setForm({ ...form, email: e.target.value })} className="mt-1.5" />
            </div>
            <div>
              <Label>Phone</Label>
              <Input value={form.phone || ''} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="mt-1.5" />
            </div>
          </div>

          <div>
            <Label>Street Address</Label>
            <Input value={form.address || ''} onChange={(e) => setForm({ ...form, address: e.target.value })} className="mt-1.5" />
          </div>
          <div>
            <Label>City, State, ZIP</Label>
            <Input value={form.cityStateZip || ''} onChange={(e) => setForm({ ...form, cityStateZip: e.target.value })} className="mt-1.5" />
          </div>

          <div>
            <Label>Court Visitor ID (optional)</Label>
            <Input value={form.courtVisitorId || ''} onChange={(e) => setForm({ ...form, courtVisitorId: e.target.value })} className="mt-1.5" />
          </div>

          <div>
            <Label>Organization</Label>
            <Input value={form.organization || 'Alaska Court System'} onChange={(e) => setForm({ ...form, organization: e.target.value })} className="mt-1.5" placeholder="Alaska Court System" />
          </div>

          <div>
            <Label>Theme</Label>
            <Select value={selectedTheme} onValueChange={(val) => {
              if (val) {
                setSelectedTheme(val);
                setTheme(val as 'light' | 'dark' | 'system');
                // Force class update on html for immediate effect
                const html = document.documentElement;
                if (val === 'dark') {
                  html.classList.add('dark');
                  html.classList.remove('light');
                } else if (val === 'light') {
                  html.classList.add('light');
                  html.classList.remove('dark');
                } else {
                  // system
                  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
                  if (prefersDark) {
                    html.classList.add('dark');
                    html.classList.remove('light');
                  } else {
                    html.classList.add('light');
                    html.classList.remove('dark');
                  }
                }
              }
            }}>
              <SelectTrigger className="mt-1.5">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="light">Light</SelectItem>
                <SelectItem value="dark">Dark</SelectItem>
                <SelectItem value="system">System</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-[10px] text-muted-foreground mt-0.5">Changes apply immediately.</p>
          </div>

          <div>
            <Label>Logo (optional - small image for invoices)</Label>
            <div className="flex items-center gap-3 mt-1.5">
              <Input
                type="file"
                accept="image/*"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const reader = new FileReader();
                  reader.onload = () => {
                    setForm({ ...form, logoDataUrl: reader.result as string });
                  };
                  reader.readAsDataURL(file);
                }}
                className="text-sm"
              />
              {form.logoDataUrl && (
                <img src={form.logoDataUrl} alt="Logo preview" className="h-9 w-auto rounded border object-contain" />
              )}
              {form.logoDataUrl && (
                <Button variant="ghost" size="sm" onClick={() => setForm({ ...form, logoDataUrl: undefined })}>Remove</Button>
              )}
            </div>
            <p className="text-[10px] text-muted-foreground mt-0.5">Stored locally. Appears on generated PDFs. (Small preview above)</p>
            {form.logoDataUrl && (
              <div className="text-[10px] text-muted-foreground">Will appear scaled in invoice header.</div>
            )}
          </div>

          <div>
            <Label>Invoice Footer Note</Label>
            <Textarea
              value={form.invoiceNotes || ''}
              onChange={(e) => setForm({ ...form, invoiceNotes: e.target.value })}
              className="mt-1.5"
              rows={2}
            />
            <p className="text-xs text-muted-foreground mt-0.5">Professional text only. Appears on every invoice.</p>
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
              size="sm"
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
              className="w-full"
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
            <div className="flex gap-2">
              <Button
                size="sm"
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
                className="flex-1"
              >
                Export All Data
              </Button>
              <Button
                size="sm"
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
                className="flex-1"
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
        <Button size="sm" variant="outline" onClick={handleSyncNow} disabled={isSyncing || !isOnline}>
          {isSyncing ? 'Syncing…' : 'Sync Now'}
        </Button>
        <Button size="sm" variant="outline" onClick={handleSimulateOffline}>
          Test Offline Mode
        </Button>
        <Button size="sm" variant="destructive" onClick={handleClear}>
          Clear All Local Data
        </Button>
        <Button
          size="sm"
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

