'use client';

import { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import CaseSelector from '@/components/CaseSelector';
import { Checkbox } from '@/components/ui/checkbox';
import { ACTIVITY_TYPES } from '@/lib/constants';
import { TimeEntryFormData, Case } from '@/types';
import { useAppStore } from '@/stores/useAppStore';
import { formatCurrency } from '@/lib/format';
import { toast } from '@/app/components/Toast';
import { Play, Square } from 'lucide-react';
import { format } from 'date-fns';

interface TimeLogDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultCaseId?: string;
  existingEntry?: any; // partial TimeEntry for editing
}

export function TimeLogDialog({ open, onOpenChange, defaultCaseId, existingEntry }: TimeLogDialogProps) {
  const { cases, addTimeEntry, editTimeEntry, getCaseById, getActivityRate, activityRates, startTimer: storeStartTimer, stopTimer: storeStopTimer, resetTimer: storeResetTimer, getElapsedSeconds, getBilledHours, getActiveTimer } = useAppStore();

  const [form, setForm] = useState<TimeEntryFormData>({
    caseId: defaultCaseId || '',
    date: format(new Date(), 'yyyy-MM-dd'),
    activityType: 'Contact',
    billableHours: 1,
    description: '',
    isOpenCourt: false,
  });

  const openCases = cases.filter((c) => c.status === 'Open');

  // For selector: prefer open cases, but always include the case being edited (even if now closed)
  const selectorCases = (() => {
    let list = [...openCases];
    const currentId = existingEntry?.caseId || form.caseId || defaultCaseId;
    if (currentId) {
      const currentCase = cases.find((c) => c.id === currentId);
      if (currentCase && !list.some((c) => c.id === currentCase.id)) {
        list = [currentCase, ...list];
      }
    }
    return list.length > 0 ? list : openCases;
  })();

  // Local UI state for stopwatch display (synced from store)
  const [displayElapsed, setDisplayElapsed] = useState('00:00:00');
  const [isTiming, setIsTiming] = useState(false); // reflects if THIS dialog's timer is active
  const displayIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Allow manual override of estimated/calculated bill amount (for edit)
  const [billAmount, setBillAmount] = useState<string>('');

  // Activity rate: for new use current settings; for edit, prefer historical snapshot if activity unchanged
  const effectiveActivity = form.activityType || 'Contact';
  const currentActivityRate = getActivityRate(effectiveActivity);
  const historicalRate = existingEntry && existingEntry.activityType === effectiveActivity 
    ? (existingEntry.activityRate ?? existingEntry.hourlyRate) 
    : null;
  const displayRate = historicalRate ?? currentActivityRate;
  const calculatedBill = (form.billableHours || 0) * displayRate;
  const finalBillAmount = billAmount !== '' ? parseFloat(billAmount) : calculatedBill;

  // Per Alaska Court Visitor billing regulations (ADM-121 form for visitor fees):
  // - Itemize time with date, brief description, hours in tenths of hours.
  // - Report separate totals for "Total Time Spent In Open Court" and "Out Of Court".
  // - Use activity rates for the "Rate" per service (our Activity Rates feature).
  // - 'Court' activity or isOpenCourt derives the open court time.
  // - First Time Billing flag, Assignment Type required.
  // - Expenses itemized separately by category.

  // Ensure rates are loaded when dialog opens
  useEffect(() => {
    if (open && (activityRates?.length ?? 0) === 0) {
      // non blocking
      // the store load will populate via parent
    }
  }, [open, activityRates]);

  // Populate when editing
  useEffect(() => {
    if (existingEntry) {
      setForm({
        caseId: existingEntry.caseId,
        date: existingEntry.date,
        activityType: existingEntry.activityType,
        billableHours: existingEntry.billableHours,
        description: existingEntry.description,
        isOpenCourt: existingEntry.isOpenCourt ?? (existingEntry.activityType === 'Court'),
      });
      const existingBill = existingEntry.totalAmount ?? existingEntry.amount;
      setBillAmount(existingBill !== undefined ? existingBill.toString() : '');
    } else if (defaultCaseId) {
      setForm((f) => ({ ...f, caseId: defaultCaseId }));
      setBillAmount('');
    }
  }, [existingEntry, defaultCaseId]);

  // Recover active timer on open / refresh (persist in store/local)
  useEffect(() => {
    if (!open) return;
    const timer = getActiveTimer();
    if ((timer.isRunning || timer.elapsedAtStop) && timer.caseId && timer.activityType) {
      // If this dialog matches or no specific, sync form
      if (!existingEntry) {
        setForm((f) => ({
          ...f,
          caseId: timer.caseId!,
          activityType: timer.activityType!,
        }));
      }
      setIsTiming(!!timer.isRunning);
      // The interval effect will pick up the display
    }
  }, [open]);

  // Sync with global timer and update display every second if running
  useEffect(() => {
    const syncAndUpdate = () => {
      const timer = getActiveTimer();
      const elapsedSec = getElapsedSeconds();
      const h = Math.floor(elapsedSec / 3600);
      const m = Math.floor((elapsedSec % 3600) / 60);
      const s = elapsedSec % 60;
      const hhmmss = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
      setDisplayElapsed(hhmmss);
      setIsTiming(!!timer.isRunning);

      // If this dialog's case/activity matches the active timer, update form hours live (but we use billed on stop)
      if (timer.caseId === form.caseId && timer.activityType === form.activityType) {
        const billed = getBilledHours();
        setForm((f) => ({ ...f, billableHours: billed }));
      }
    };

    syncAndUpdate(); // initial

    const timer = getActiveTimer();
    if (timer.isRunning) {
      if (displayIntervalRef.current) clearInterval(displayIntervalRef.current);
      displayIntervalRef.current = setInterval(syncAndUpdate, 1000);
    } else if (displayIntervalRef.current) {
      clearInterval(displayIntervalRef.current);
      displayIntervalRef.current = null;
    }

    return () => {
      if (displayIntervalRef.current) {
        clearInterval(displayIntervalRef.current);
        displayIntervalRef.current = null;
      }
    };
  }, [form.caseId, form.activityType, open, isTiming]); // include isTiming to re-eval interval on pause/resume

  const toggleTimer = () => {
    const active = getActiveTimer();
    if (!isTiming) {
      // Must have case and activity selected (requirement)
      if (!form.caseId || !form.activityType) {
        toast.error('Select a Case and Activity Type before starting the timer.');
        return;
      }
      // Only one timer
      if (active.isRunning && (active.caseId !== form.caseId || active.activityType !== form.activityType)) {
        toast.error('Another timer is already running. Stop it first.');
        return;
      }
      storeStartTimer(form.caseId, form.activityType);
      setIsTiming(true);
      toast.info('Timer started. Go do the thing.');
    } else {
      const elapsedSec = storeStopTimer();
      const rounded = getBilledHours();
      setForm((f) => ({ ...f, billableHours: rounded }));
      setIsTiming(false);
      // Immediately freeze display
      const h = Math.floor(elapsedSec / 3600);
      const m = Math.floor((elapsedSec % 3600) / 60);
      const s = elapsedSec % 60;
      setDisplayElapsed(`${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`);
      if (displayIntervalRef.current) {
        clearInterval(displayIntervalRef.current);
        displayIntervalRef.current = null;
      }
      toast.success(`Timer stopped. ${rounded.toFixed(1)}h (rounded UP) ready to log.`);
    }
  };

  const handleSubmit = async () => {
    if (!form.caseId) {
      toast.error('Select a case.');
      return;
    }
    if (!form.activityType) {
      toast.error('Activity is required.');
      return;
    }
    if (!form.date) {
      toast.error('Date is required.');
      return;
    }
    if (form.billableHours <= 0) {
      toast.error('Hours must be greater than zero.');
      return;
    }
    if (!form.description.trim()) {
      toast.error('Add a short description. Payroll isn\'t psychic.');
      return;
    }

    const finalBill = finalBillAmount;

    try {
      if (existingEntry) {
        await editTimeEntry(existingEntry.id, {
          ...form,
          billableHours: form.billableHours,
          amount: finalBill,
          totalAmount: finalBill,
        } as any);
        toast.success('Time entry updated.');
      } else {
        await addTimeEntry({
          ...form,
          billableHours: form.billableHours,
          amount: finalBill,
          totalAmount: finalBill,
        } as any);
        toast.success('Logged. Tiny logs beat giant catch-up sessions.');
      }

      // If this was from timer, reset the global timer
      const timer = getActiveTimer();
      if (timer.caseId === form.caseId && timer.activityType === form.activityType) {
        storeResetTimer();
      }

      onOpenChange(false);
      resetForm();
    } catch (e: any) {
      console.error('Time log failed in TimeLogDialog:', e);
      toast.error(`Could not save time entry: ${e?.message || e || 'Unknown error'}`);
    }
  };

  const resetForm = () => {
    setForm({
      caseId: defaultCaseId || (openCases[0]?.id ?? ''),
      date: format(new Date(), 'yyyy-MM-dd'),
      activityType: 'Contact',
      billableHours: 1,
      description: '',
      isOpenCourt: false,
    });
    setIsTiming(false);
    setDisplayElapsed('00:00:00');
    setBillAmount('');
    // Note: global timer is managed separately; reset only if matches on submit
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) resetForm(); onOpenChange(o); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{existingEntry ? 'Edit Time Entry' : 'Log Time'}</DialogTitle>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-y-auto space-y-4">
          <CaseSelector
            selectedCaseId={form.caseId}
            onChange={(caseId) => setForm({ ...form, caseId })}
            cases={selectorCases}
          />
          {openCases.length === 0 && (
            <div className="text-xs text-amber-400">No open cases. Create one first using the + New Case button.</div>
          )}

          <div className="flex gap-3">
            <div>
              <Label>Date</Label>
              <Input
                type="date"
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
                className="mt-1.5 w-28"
              />
            </div>
            <div className="flex-1">
              <Label>Activity</Label>
              <Select value={form.activityType} onValueChange={(v) => setForm({ ...form, activityType: v as any, isOpenCourt: v === 'Court' })}>
                <SelectTrigger className="mt-1.5">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ACTIVITY_TYPES.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <Label>Billable Hours</Label>
              {isTiming ? (
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  onClick={toggleTimer}
                  className="gap-1.5 h-8 text-xs"
                >
                  <Square className="h-3 w-3" /> Pause Timer
                </Button>
              ) : (getActiveTimer().elapsedAtStop || form.billableHours > 0) ? (
                <Button
                  type="button"
                  variant="default"
                  size="sm"
                  onClick={toggleTimer}
                  disabled={!form.caseId || !form.activityType}
                  className="gap-1.5 h-8 text-xs bg-green-600 hover:bg-green-700"
                >
                  <Play className="h-3 w-3" /> Resume Timer
                </Button>
              ) : (
                <Button
                  type="button"
                  variant="default"
                  size="sm"
                  onClick={toggleTimer}
                  disabled={!form.caseId || !form.activityType}
                  className="gap-1.5 h-8 text-xs bg-green-600 hover:bg-green-700"
                >
                  <Play className="h-3 w-3" /> Start Timer
                </Button>
              )}
            </div>

            {isTiming || displayElapsed !== '00:00:00' ? (
              <div className="p-4 bg-zinc-900 rounded-2xl text-center">
                <div className="text-4xl font-mono tabular-nums tracking-[2px] font-semibold">
                  {displayElapsed}
                </div>
                <div className="text-xs text-green-400 mt-1">
                  {isTiming ? 'RUNNING • will round UP to nearest 0.1h on stop' : 'PAUSED • frozen display'}
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  step="0.1"
                  min="0"
                  value={form.billableHours === 0 ? '' : form.billableHours}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value);
                    setForm({ ...form, billableHours: isNaN(val) ? 0 : val });
                  }}
                  placeholder="0.0"
                  className="flex-1"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={toggleTimer}
                  disabled={!form.caseId || !form.activityType}
                >
                  Start Timer
                </Button>
              </div>
            )}

            {!isTiming && form.billableHours > 0 && (
              <div className="text-[10px] text-muted-foreground mt-1">
                Or use timer above for stopwatch (rounds UP to nearest 0.1h)
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Checkbox
              id="openCourt"
              checked={!!form.isOpenCourt}
              onCheckedChange={(checked) => setForm({ ...form, isOpenCourt: !!checked })}
            />
            <Label htmlFor="openCourt" className="text-sm cursor-pointer">This time was spent in open court</Label>
          </div>

          {/* Estimated Bill - now editable to allow manual override of calculated amount */}
          <div>
            <Label>Estimated Bill</Label>
            <Input
              type="number"
              step="0.01"
              value={billAmount !== '' ? billAmount : calculatedBill.toFixed(2)}
              onChange={(e) => setBillAmount(e.target.value)}
              className="mt-1.5"
            />
            <p className="text-[10px] text-muted-foreground mt-0.5">
              {billAmount !== '' ? 'Manually overridden' : 'Billable Hours × Activity Rate (from your Activity Rates settings)'}
              {billAmount !== '' && ` (calc: ${formatCurrency(calculatedBill)})`}
            </p>
          </div>

          <div>
            <Label>Description</Label>
            <Textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="What happened? Be specific for the invoice monster."
              className="mt-1.5"
              rows={2}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSubmit}>{existingEntry ? 'Update Entry' : 'Log Time'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
