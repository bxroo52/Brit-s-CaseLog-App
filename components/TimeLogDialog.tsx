'use client';

import { useState, useEffect } from 'react';
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
  const { cases, addTimeEntry, editTimeEntry, getCaseById, getActivityRate, activityRates } = useAppStore();

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

  const [isTiming, setIsTiming] = useState(false);
  const [timerStart, setTimerStart] = useState<Date | null>(null);
  const [liveHours, setLiveHours] = useState(0);

  // Activity rate: for new use current settings; for edit, prefer historical snapshot if activity unchanged
  const effectiveActivity = form.activityType || 'Contact';
  const currentActivityRate = getActivityRate(effectiveActivity);
  const historicalRate = existingEntry && existingEntry.activityType === effectiveActivity 
    ? (existingEntry.activityRate ?? existingEntry.hourlyRate) 
    : null;
  const displayRate = historicalRate ?? currentActivityRate;
  const estimatedBill = (form.billableHours || 0) * displayRate;

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
    } else if (defaultCaseId) {
      setForm((f) => ({ ...f, caseId: defaultCaseId }));
    }
  }, [existingEntry, defaultCaseId]);

  // Live timer
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isTiming && timerStart) {
      interval = setInterval(() => {
        const elapsed = (Date.now() - timerStart.getTime()) / 1000 / 60 / 60;
        setLiveHours(Math.max(0, elapsed));
        setForm((f) => ({ ...f, billableHours: Math.max(f.billableHours, Math.round(elapsed * 10) / 10) }));
      }, 3000);
    }
    return () => clearInterval(interval);
  }, [isTiming, timerStart]);

  const toggleTimer = () => {
    if (!isTiming) {
      const now = new Date();
      setTimerStart(now);
      setIsTiming(true);
      toast.info('Timer started. Go do the thing.');
    } else {
      setIsTiming(false);
      setTimerStart(null);
      toast.success('Timer stopped. Log it before you forget.');
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

    try {
      if (existingEntry) {
        await editTimeEntry(existingEntry.id, {
          ...form,
          billableHours: form.billableHours,
        } as any);
        toast.success('Time entry updated.');
      } else {
        await addTimeEntry({
          ...form,
          billableHours: form.billableHours,
        });
        toast.success('Logged. Tiny logs beat giant catch-up sessions.');
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
    setTimerStart(null);
    setLiveHours(0);
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
            <div className="flex items-center justify-between">
              <Label>Billable Hours</Label>
              <Button
                type="button"
                variant={isTiming ? 'destructive' : 'outline'}
                size="sm"
                onClick={toggleTimer}
                className="gap-1.5 h-8 text-xs"
              >
                {isTiming ? <Square className="h-3 w-3" /> : <Play className="h-3 w-3" />}
                {isTiming ? 'Stop Timer' : 'Start Timer'}
              </Button>
            </div>
            <div className="flex items-center gap-2 mt-1.5">
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
              />
            </div>
            {isTiming && (
              <div className="text-[10px] text-amber-600 mt-1">Timer running — values update live. Stop when done.</div>
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

          {/* Estimated Bill using Activity Rate - auto updates, read-only */}
          <div>
            <Label>Estimated Bill</Label>
            <div className="mt-1.5 px-3 py-2 rounded-md border bg-muted/30 font-mono text-sm tabular-nums">
              {formatCurrency(estimatedBill)}
            </div>
            <p className="text-[10px] text-muted-foreground mt-0.5">Billable Hours × Activity Rate (from your Activity Rates settings)</p>
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
