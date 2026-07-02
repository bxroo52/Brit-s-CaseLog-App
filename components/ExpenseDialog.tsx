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

        <div className="space-y-4">
          <div>
            <Label>Case</Label>
            <Select value={form.caseId} onValueChange={(v) => v && setForm({ ...form, caseId: v })}>
              <SelectTrigger className="mt-1.5">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {openCases.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.respondentName} — {c.caseNumber}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Date</Label>
              <Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className="mt-1.5" />
            </div>
            <div>
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
                      <Label className="text-[10px]">Miles</Label>
                      <Input
                        type="text"
                        inputMode="decimal"
                        placeholder="14"
                        className="h-8 text-xs"
                        onChange={(e) => {
                          const miles = parseFloat(e.target.value) || 0;
                          const rate = parseFloat((document.getElementById('mileage-rate') as HTMLInputElement)?.value) || 0.67;
                          const calc = miles * rate;
                          setForm({ ...form, amount: calc });
                        }}
                      />
                    </div>
                    <div>
                      <Label className="text-[10px]">Rate $/mi</Label>
                      <Input
                        id="mileage-rate"
                        type="text"
                        inputMode="decimal"
                        defaultValue="0.67"
                        placeholder="0.67"
                        className="h-8 text-xs"
                        onChange={(e) => {
                          const milesEl = document.querySelector('input[placeholder="14"]') as HTMLInputElement;
                          const miles = parseFloat(milesEl?.value) || 0;
                          const rate = parseFloat(e.target.value) || 0.67;
                          setForm({ ...form, amount: miles * rate });
                        }}
                      />
                    </div>
                  </div>
                  <p className="text-[10px] text-muted-foreground">Auto-fills amount. Update description with actual miles + rate used.</p>
                </div>
              )}
            </div>
          </div>

          <div>
            <Label>Amount</Label>
            <div className="relative mt-1.5">
              <span className="absolute left-3 top-2.5 text-muted-foreground">$</span>
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
            <div className="flex flex-wrap gap-1 mb-1.5">
              {['Parking at courthouse', 'Certified mail', 'Copies for court', 'Postage', 'Round trip mileage'].map((phrase) => (
                <button
                  key={phrase}
                  type="button"
                  onClick={() => setForm({ ...form, description: form.description ? form.description + ' ' + phrase : phrase })}
                  className="text-[10px] px-2 py-0.5 rounded-full bg-muted hover:bg-muted/80 border"
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
