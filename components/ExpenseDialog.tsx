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
import { toast } from 'sonner';
import { format } from 'date-fns';

interface ExpenseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultCaseId?: string;
  existing?: any;
}

export function ExpenseDialog({ open, onOpenChange, defaultCaseId, existing }: ExpenseDialogProps) {
  const { cases, addExpense, editExpense, getCaseById } = useAppStore();
  const openCases = cases.filter((c) => c.status === 'Open');

  const [form, setForm] = useState<ExpenseFormData>({
    caseId: defaultCaseId || (openCases[0]?.id ?? ''),
    date: format(new Date(), 'yyyy-MM-dd'),
    expenseType: 'Parking',
    description: '',
    amount: 0,
  });

  useEffect(() => {
    if (existing) {
      setForm({
        caseId: existing.caseId,
        date: existing.date,
        expenseType: existing.expenseType,
        description: existing.description,
        amount: existing.amount,
      });
    } else if (defaultCaseId) {
      setForm((f) => ({ ...f, caseId: defaultCaseId }));
    }
  }, [existing, defaultCaseId]);

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
          <div>
            <Label>Case</Label>
            <Select value={form.caseId} onValueChange={(v) => v && setForm({ ...form, caseId: v })}>
              <SelectTrigger className="mt-1.5">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {openCases.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{`${c.respondentFirstName} ${c.respondentLastName}`} — {c.caseNumber}</SelectItem>
                ))}
              </SelectContent>
            </Select>
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
                <div className="mt-2 space-y-2 text-xs">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-xs">Miles</Label>
                      <Input
                        type="text"
                        inputMode="decimal"
                        placeholder="14"
                        className="h-9 text-sm"
                        onChange={(e) => {
                          const miles = parseFloat(e.target.value) || 0;
                          const rate = parseFloat((document.getElementById('mileage-rate') as HTMLInputElement)?.value) || 0.67;
                          const calc = miles * rate;
                          setForm({ ...form, amount: calc });
                        }}
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Rate $/mi</Label>
                      <Input
                        id="mileage-rate"
                        type="text"
                        inputMode="decimal"
                        defaultValue="0.67"
                        placeholder="0.67"
                        className="h-9 text-sm"
                        onChange={(e) => {
                          const milesEl = document.querySelector('input[placeholder="14"]') as HTMLInputElement;
                          const miles = parseFloat(milesEl?.value) || 0;
                          const rate = parseFloat(e.target.value) || 0.67;
                          setForm({ ...form, amount: miles * rate });
                        }}
                      />
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">Auto-fills amount. Update description with actual miles + rate used.</p>
                </div>
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
                className="pl-7"
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
