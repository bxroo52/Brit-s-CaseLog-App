'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useAppStore } from '@/stores/useAppStore';
import { UserProfile } from '@/types';
import { toast } from 'sonner';
import { useSync } from '@/hooks/useSync';
import { simulateOfflineMode, getPendingQueueItems } from '@/lib/sync';
import { isSupabaseConfigured } from '@/lib/supabase';

interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SettingsDialog({ open, onOpenChange }: SettingsDialogProps) {
  const { profile, saveProfile } = useAppStore();
  const [form, setForm] = useState<Partial<UserProfile>>({});

  useEffect(() => {
    if (profile) {
      setForm({ ...profile });
    }
  }, [profile, open]);

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
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Your Info (for Invoices)</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-1">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label>Your Name</Label>
              <Input value={form.name || ''} onChange={(e) => setForm({ ...form, name: e.target.value })} className="mt-1.5" />
            </div>
            <div>
              <Label>Title / Role</Label>
              <Input value={form.title || ''} onChange={(e) => setForm({ ...form, title: e.target.value })} className="mt-1.5" />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
            <p className="text-[10px] text-muted-foreground mt-1">Stored locally. Appears on generated PDFs.</p>
          </div>

          <div>
            <Label>Invoice Footer Note</Label>
            <Textarea
              value={form.invoiceNotes || ''}
              onChange={(e) => setForm({ ...form, invoiceNotes: e.target.value })}
              className="mt-1.5"
              rows={2}
            />
            <p className="text-xs text-muted-foreground mt-1">Professional text only. Appears on every invoice.</p>
          </div>

          {/* PWA Install on iPhone / iOS */}
          <div className="border-t pt-4 mt-2 space-y-3">
            <div>
              <Label className="font-medium">Install on iPhone</Label>
              <p className="text-xs text-muted-foreground">Add to Home Screen for native-like offline experience.</p>
            </div>
            <Button 
              size="sm" 
              variant="outline" 
              onClick={() => {
                // For iOS, guide user
                const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
                if (isIOS) {
                  alert("On iPhone: Tap the Share button (square with arrow) at the bottom, then scroll and select 'Add to Home Screen'.");
                } else if ((window as any).deferredPwaPrompt) {
                  (window as any).deferredPwaPrompt.prompt();
                } else {
                  alert("Use your browser's install option or Share > Add to Home Screen on mobile.");
                }
              }}
              className="w-full"
            >
              Install App
            </Button>
          </div>

          {/* Offline-first Sync Controls */}
          <div className="border-t pt-4 mt-2 space-y-3">
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

