'use client';

import { useState, useEffect } from 'react';
import { useAppStore } from '@/stores/useAppStore';
import { showToast } from './Toast';

interface LogExpenseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOptimisticAdd?: (tempEntry: any) => void;
  onSuccess?: () => void;
}

export default function LogExpenseModal({ isOpen, onClose, onOptimisticAdd, onSuccess }: LogExpenseModalProps) {
  const allCases = useAppStore((state) => state.cases);
  const addExpense = useAppStore((state) => state.addExpense);
  const [selectedCase, setSelectedCase] = useState('');
  const [expenseType, setExpenseType] = useState('Parking');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);

  // Use the exact same data source as the Dashboard’s Open Cases section and Log Time form (Zustand store / Dexie)
  const cases = allCases.filter((c: any) => c.status === 'Open');

  useEffect(() => {
    if (!isOpen) return;

    const storeCases = useAppStore.getState().cases;
    const openNow = storeCases.filter((c: any) => c.status === 'Open');
    console.log('[LogExpenseModal] dialog opened. store.cases.length=', storeCases.length, ' open filtered=', openNow.length);
    console.log('[LogExpenseModal] open cases list for dropdown:', openNow.map((c: any) => ({ id: c.id, caseNumber: c.caseNumber, last: c.respondentLastName, first: c.respondentFirstName, status: c.status })));

    // If still empty here, force a reload from Dexie (defensive)
    if (openNow.length === 0 && storeCases.length === 0) {
      useAppStore.getState().loadAllData().catch(() => {});
    }

    // Reset form when opening (ensure blank, etc.)
    setSelectedCase('');
    setExpenseType('Parking');
    setAmount('');
    setDescription('');
  }, [isOpen]);

  const handleLogExpense = async () => {
    const amountNum = parseFloat(amount);
    const desc = description.trim();

    if (!selectedCase) {
      showToast('Please select a case', 'error');
      return;
    }
    if (isNaN(amountNum) || amountNum <= 0) {
      showToast('Amount must be greater than 0', 'error');
      return;
    }
    if (!desc) {
      showToast('Description is required', 'error');
      return;
    }

    setLoading(true);

    // Create optimistic expense in format expected by ExpensesRealtime (for display)
    const tempId = 'temp-exp-' + Date.now();
    const selectedCaseObj = cases.find(c => c.id === selectedCase);
    const optimisticCases = selectedCaseObj ? {
      case_number: selectedCaseObj.caseNumber,
      title: `${selectedCaseObj.respondentLastName || ''}, ${selectedCaseObj.respondentFirstName || ''}`.replace(/^, |, $/, '').trim(),
    } : undefined;

    const optimisticEntry = {
      id: tempId,
      case_id: selectedCase,
      type: expenseType,
      amount: amountNum,
      description: desc,
      date: new Date().toISOString().split('T')[0],
      cases: optimisticCases,
      _optimistic: true,
    };

    if (onOptimisticAdd) {
      onOptimisticAdd(optimisticEntry);
    }

    try {
      // Use store action for reliable Dexie save + sync queue (same as Log Time)
      await addExpense({
        caseId: selectedCase,
        date: new Date().toISOString().split('T')[0],
        expenseType: expenseType,
        amount: amountNum,
        description: desc,
      });
      // Store handles local save, queue, and its own success toast

      showToast('Expense logged successfully!');
      onClose();
      if (onSuccess) onSuccess();

      // Reset form
      setSelectedCase('');
      setExpenseType('Parking');
      setAmount('');
      setDescription('');

    } catch (err: any) {
      console.error('Failed to log expense (store addExpense):', err);
      showToast('Failed to log expense. Please try again.', 'error');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 flex items-end z-50">
      <div className="bg-zinc-950 w-full max-w-md mx-auto rounded-t-3xl flex flex-col overflow-hidden max-h-[85dvh]" style={{ maxHeight: 'min(85dvh, calc(100dvh - 20px))' }}>
        <div className="px-6 pt-6 pb-2 flex justify-between items-center flex-shrink-0">
          <h2 className="text-2xl font-bold">Log Expense</h2>
          <button onClick={onClose} className="text-xl">✕</button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 pb-6 space-y-6" style={{ paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom))' }}>
          <div>
            <label className="block text-sm text-zinc-400 mb-2">Case</label>
            <select value={selectedCase} onChange={e => setSelectedCase(e.target.value)} className="w-full bg-zinc-900 border border-zinc-700 rounded-2xl p-4">
              <option value="">Select a case...</option>
              {cases.map(c => (
                <option key={c.id} value={c.id}>
                  {c.respondentLastName}, {c.respondentFirstName} — {c.caseNumber}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm text-zinc-400 mb-2">Type</label>
            <select value={expenseType} onChange={e => setExpenseType(e.target.value)} className="w-full bg-zinc-900 border border-zinc-700 rounded-2xl p-4">
              {['Parking', 'Certified mail', 'Copies for court', 'Postage', 'Round trip mileage', 'Other'].map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-sm text-zinc-400 mb-2">Amount</label>
            <input type="number" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} className="w-full bg-zinc-900 border border-zinc-700 rounded-2xl p-3 text-base text-center" placeholder="0.00" inputMode="decimal" />
          </div>

          <div>
            <label className="block text-sm text-zinc-400 mb-2">Description / Receipt Note</label>
            <textarea value={description} onChange={e => setDescription(e.target.value)} className="w-full bg-zinc-900 border border-zinc-700 rounded-2xl p-4 h-24" placeholder="Parking at courthouse garage. Receipt #4821" />
          </div>

          <button onClick={handleLogExpense} disabled={loading || !selectedCase} className="w-full bg-white text-black py-5 rounded-3xl text-xl font-medium mt-8 disabled:opacity-50">
            {loading ? 'Logging...' : 'Log Expense'}
          </button>
        </div>
      </div>
    </div>
  );
}
