'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { EXPENSE_TYPES } from '@/lib/constants';
import { ExpenseFormData, Case } from '@/types';
import { useAppStore } from '@/stores/useAppStore';
import { toast } from '@/app/components/Toast';
import { format } from 'date-fns';

interface ExpenseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultCaseId?: string;
  existing?: any;
}

export function ExpenseDialog({ open, onOpenChange, defaultCaseId, existing }: ExpenseDialogProps) {
  const allCases = useAppStore((state) => state.cases);
  const addExpense = useAppStore((state) => state.addExpense);
  const editExpense = useAppStore((state) => state.editExpense);

  const [form, setForm] = useState<ExpenseFormData>({
    caseId: defaultCaseId || '',
    date: format(new Date(), 'yyyy-MM-dd'),
    expenseType: 'Parking',
    description: '',
    amount: 0,
  });

  const openCases = allCases.filter((c) => c.status === 'Open');

  useEffect(() => {
    if (open) {
      const storeCases = useAppStore.getState().cases;
      const openNow = storeCases.filter((c: any) => c.status === 'Open');
      console.log('[ExpenseDialog] dialog opened. store.cases.length=', storeCases.length, ' open filtered=', openNow.length);
      console.log('[ExpenseDialog] open cases list for dropdown:', openNow.map((c: any) => ({ id: c.id, caseNumber: c.caseNumber, last: c.respondentLastName, status: c.status })));
      if (openNow.length === 0 && storeCases.length === 0) {
        useAppStore.getState().loadAllData().catch(() => {});
      }
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    if (existing) {
      setForm({
        caseId: existing.caseId,
        date: existing.date,
        expenseType: existing.expenseType,
        description: existing.description,
        amount: existing.amount,
      });
    } else {
      // For new log expense, always start with blank description (no default/pre-filled text)
      // and correct case if provided. This ensures clean state even if dialog component persists.
      // Populate using current open cases when the dialog opens (matching LogTimeModal behavior).
      // Use a fresh snapshot in case the render's openCases is momentarily stale.
      const freshOpen = useAppStore.getState().cases.filter((c: any) => c.status === 'Open');
      setForm({
        caseId: defaultCaseId || (freshOpen[0]?.id ?? ''),
        date: format(new Date(), 'yyyy-MM-dd'),
        expenseType: 'Parking',
        description: '',
        amount: 0,
      });
    }
  }, [open, existing, defaultCaseId]);

  // Auto-populate first open case for new Log Expense if none selected yet (e.g. cases loaded after open)
  useEffect(() => {
    if (open && !existing && !form.caseId && openCases.length > 0) {
      setForm((f) => ({
        ...f,
        caseId: defaultCaseId || openCases[0].id,
      }));
    }
  }, [open, existing, form.caseId, openCases.length, defaultCaseId]);

  const handleSubmit = async () => {
    if (!form.caseId) return toast.error('Select a case');
    if (!form.description.trim()) return toast.error('Description required.');
    if (form.amount <= 0) return toast.error('Amount must be > 0.');

    try {
      if (existing) {
        await editExpense(existing.id, form);
        toast.success('Expense updated.');
      } else {
        await addExpense(form);
        toast.success('Expense logged. The invoice monster is slightly less hungry.');
      }
      onOpenChange(false);
      reset();
    } catch {
      toast.error('Failed to save expense.');
    }
  };

  const reset = () => {
    setForm({
      caseId: defaultCaseId || (openCases[0]?.id ?? ''),
      date: format(new Date(), 'yyyy-MM-dd'),
      expenseType: 'Parking',
      description: '',
      amount: 0,
    });
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) reset(); onOpenChange(o); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{existing ? 'Edit Expense' : 'Log Expense'}</DialogTitle>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-y-auto space-y-4">
          {/* Direct Case select (like Log Time) using store data to ensure all open cases show */}
          <div>
            <Label>Case</Label>
            <select
              value={form.caseId}
              onChange={(e) => setForm({ ...form, caseId: e.target.value })}
              className="mt-1.5 w-full bg-background border border-input rounded-lg px-3 py-2 text-sm"
              required
            >
              <option value="">Select a case...</option>
              {openCases.map((c) => {
                const displayName = `${c.respondentLastName || 'Unknown'}, ${c.respondentFirstName || ''}`.trim();
                return (
                  <option key={c.id} value={c.id}>
                    {displayName} — {c.caseNumber}
                  </option>
                );
              })}
            </select>
          </div>

          <div className="flex gap-3">
            <div>
              <Label>Date</Label>
              <Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className="mt-1.5 w-28" />
            </div>
            <div className="flex-1">
              <Label>Type</Label>
              <Select value={form.expenseType} onValueChange={(v) => setForm({ ...form, expenseType: v as any })}>
                <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {EXPENSE_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
              {form.expenseType === 'Mileage' && (
                <p className="text-xs text-muted-foreground mt-1">Enter total mileage reimbursement amount below. Record miles in description.</p>
              )}
            </div>
          </div>

          <div>
            <Label>Amount</Label>
            <div className="relative mt-1.5">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none">$</span>
              <Input
                type="text"
                inputMode="decimal"
                pattern="[0-9]*\.?[0-9]*"
                value={form.amount === 0 ? '' : form.amount.toString()}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === '') {
                    setForm({ ...form, amount: 0 });
                  } else {
                    const num = parseFloat(val.replace(',', '.'));
                    setForm({ ...form, amount: isNaN(num) ? 0 : num });
                  }
                }}
                placeholder="0.00"
                className="pl-7 h-9 text-base"  // normal size (not gigantic/large like some log inputs)
              />
            </div>
          </div>

          <div>
            <Label>Description / Receipt Note</Label>
            <div className="flex flex-wrap gap-1.5 mb-1.5">
              {['Parking at courthouse', 'Certified mail', 'Copies for court', 'Postage', 'Round trip mileage'].map((phrase) => (
                <button
                  key={phrase}
                  type="button"
                  onClick={() => setForm({ ...form, description: form.description ? form.description + ' ' + phrase : phrase })}
                  className="text-sm px-3 py-1 rounded-full bg-muted hover:bg-muted/80 border active:bg-muted/60"
                >
                  {phrase}
                </button>
              ))}
            </div>
            <Textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Parking at courthouse garage. Receipt #4821"
              className="mt-1.5"
              rows={2}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSubmit}>{existing ? 'Update' : 'Log Expense'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
