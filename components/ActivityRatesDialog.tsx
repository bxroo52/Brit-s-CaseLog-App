'use client';

import { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ACTIVITY_TYPES, DEFAULT_HOURLY_RATE } from '@/lib/constants';
import { ActivityRate, RateChangeLog } from '@/types';
import { toast } from 'sonner';
import { formatCurrency } from '@/lib/format';

interface ActivityRatesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  activityRates: ActivityRate[];
  rateChangeLogs: RateChangeLog[];
  saveActivityRate: (activityName: string, hourlyRate: number) => Promise<void>;
  loadActivityRates: () => Promise<void>;
  loadRateChangeLogs: () => Promise<void>;
}

export function ActivityRatesDialog({
  open,
  onOpenChange,
  activityRates,
  rateChangeLogs,
  saveActivityRate,
  loadActivityRates,
  loadRateChangeLogs,
}: ActivityRatesDialogProps) {
  const [rates, setRates] = useState<Record<string, number>>({});
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Init from props or defaults
  useEffect(() => {
    if (open) {
      loadActivityRates().catch(() => {});
      loadRateChangeLogs().catch(() => {});
      const map: Record<string, number> = {};
      ACTIVITY_TYPES.forEach((act) => {
        const found = activityRates.find(r => r.activityName === act);
        map[act] = found ? found.hourlyRate : DEFAULT_HOURLY_RATE;
      });
      setRates(map);
    }
  }, [open, loadActivityRates, loadRateChangeLogs]);

  const handleRateChange = (activity: string, value: string) => {
    const num = parseFloat(value);
    setRates((prev) => ({
      ...prev,
      [activity]: isNaN(num) ? 0 : Math.max(0, Math.round(num * 100) / 100),
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      for (const [act, rate] of Object.entries(rates)) {
        await saveActivityRate(act, rate);
      }
      await loadActivityRates();
      toast.success('Activity rates saved. New logs will use them.');
      onOpenChange(false);
    } catch (e) {
      toast.error('Failed to save rates.');
    } finally {
      setSaving(false);
    }
  };

  const handleBlurSave = async (activity: string) => {
    // optional auto save on blur for better UX
    try {
      await saveActivityRate(activity, rates[activity]);
      await loadActivityRates();
    } catch {}
  };

  // Bulk import handler (JSON or simple CSV)
  const handleImportRates = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    try {
      const text = await file.text();
      let imported: Record<string, number> = {};
      const ext = file.name.toLowerCase().split('.').pop();
      if (ext === 'json' || file.type.includes('json')) {
        imported = JSON.parse(text);
      } else if (ext === 'csv') {
        // simple CSV: activity,rate\nContact,50\n...
        const lines = text.trim().split(/\r?\n/);
        for (const line of lines) {
          const [act, rateStr] = line.split(',').map(s => s.trim());
          if (act && rateStr) {
            const num = parseFloat(rateStr);
            if (!isNaN(num)) imported[act] = num;
          }
        }
      } else {
        throw new Error('Unsupported file type. Use .json or .csv');
      }

      // Validate against known activities
      const validActivities = new Set(ACTIVITY_TYPES);
      const applied: string[] = [];
      const skipped: string[] = [];
      for (const [act, rate] of Object.entries(imported)) {
        if (validActivities.has(act as any) && typeof rate === 'number' && rate >= 0) {
          await saveActivityRate(act, rate);
          applied.push(act);
        } else {
          skipped.push(act);
        }
      }
      await loadActivityRates();
      await loadRateChangeLogs();
      // refresh local rates view
      const map: Record<string, number> = {};
      ACTIVITY_TYPES.forEach((a) => {
        map[a] = imported[a] !== undefined ? imported[a] : (activityRates.find(r => r.activityName === a)?.hourlyRate || DEFAULT_HOURLY_RATE);
      });
      setRates(map);

      const msg = `Imported ${applied.length} rates.${skipped.length ? ` Skipped ${skipped.length} invalid.` : ''}`;
      toast.success(msg);
    } catch (err: any) {
      toast.error(`Import failed: ${err.message || err}`);
    } finally {
      setImporting(false);
      if (e.target) e.target.value = ''; // reset input
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[90dvh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Activity Rates</DialogTitle>
          <p className="text-xs text-muted-foreground mt-1">
            Set the hourly rate for each activity type. These apply to all future time logs.
          </p>
        </DialogHeader>

        {/* Bulk Import */}
        <div className="px-1">
          <input
            ref={fileInputRef}
            type="file"
            accept=".json,.csv,application/json,text/csv"
            className="hidden"
            onChange={handleFileChange}
          />
          <Button
            variant="outline"
            size="sm"
            onClick={handleImportRates}
            disabled={importing || saving}
            className="w-full text-xs"
          >
            {importing ? 'Importing...' : 'Import Rates (JSON/CSV)'}
          </Button>
          <p className="text-[10px] text-muted-foreground mt-1">JSON: {"{ \"Contact\": 50, \"Court\": 50 }"} or CSV: activity,rate</p>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto space-y-3 py-2 pr-1 -mr-1">
          {ACTIVITY_TYPES.map((activity) => {
            const rate = rates[activity] ?? 85;
            return (
              <div key={activity} className="flex items-center justify-between gap-3 border rounded-lg px-3 py-2 bg-card">
                <div className="flex-1 min-w-0">
                  <Label className="text-sm font-medium">{activity}</Label>
                </div>
                <div className="flex items-center gap-1 w-32">
                  <span className="text-muted-foreground">$</span>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={rate === 0 ? '' : rate.toFixed(2)}
                    onChange={(e) => handleRateChange(activity, e.target.value)}
                    onBlur={() => handleBlurSave(activity)}
                    className="h-9 text-right font-mono"
                    placeholder="0.00"
                  />
                </div>
              </div>
            );
          })}
          <p className="text-[10px] text-muted-foreground px-1">
            Rates are per user and saved locally + synced (if enabled). Past entries keep the rate used at logging time.
          </p>

          {/* Rate History / Audit Logs */}
          <div className="mt-4 border-t pt-3">
            <div className="text-xs font-semibold text-muted-foreground mb-2">RATE HISTORY (last 10)</div>
            {rateChangeLogs && rateChangeLogs.length > 0 ? (
              <div className="space-y-1 text-[10px] max-h-24 overflow-auto bg-muted/20 p-2 rounded">
                {rateChangeLogs.slice(0, 10).map((log, idx) => (
                  <div key={idx} className="flex justify-between border-b border-muted/50 last:border-0 pb-0.5">
                    <span>{log.activityName}</span>
                    <span className="font-mono">
                      ${log.oldRate.toFixed(2)} → ${log.newRate.toFixed(2)}
                    </span>
                    <span className="text-muted-foreground">{new Date(log.changedAt).toLocaleDateString()}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[10px] text-muted-foreground italic">No rate changes logged yet.</p>
            )}
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : 'Save Rates'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
