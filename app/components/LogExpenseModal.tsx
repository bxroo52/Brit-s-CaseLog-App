'use client';

import { useState, useEffect } from 'react';
import { useAppStore } from '@/stores/useAppStore';
import { showToast } from './Toast';
import CaseSelector from '@/components/CaseSelector';

interface LogExpenseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOptimisticAdd?: (tempEntry: any) => void;
  onSuccess?: () => void;
}

export default function LogExpenseModal({ isOpen, onClose, onOptimisticAdd, onSuccess }: LogExpenseModalProps) {
  // Exact copy of working Case select logic from TimeLogDialog.tsx for Log Expense
  const { cases, addExpense } = useAppStore();
  const [selectedCase, setSelectedCase] = useState('');
  const [expenseType, setExpenseType] = useState('Parking');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);

  const openCases = cases.filter((c) => c.status === 'Open');

  // For selector: prefer open cases, but always include the case being edited (even if now closed)
  const selectorCases = (() => {
    let list = [...openCases];
    const currentId = selectedCase;  // for new, may be empty; can extend if needed
    if (currentId) {
      const currentCase = cases.find((c) => c.id === currentId);
      if (currentCase && !list.some((c) => c.id === currentCase.id)) {
        list = [currentCase, ...list];
      }
    }
    return list.length > 0 ? list : openCases;
  })();

  // Temporary manual refresh (as per request)
  const refreshCases = () => {
    console.log('[LogExpenseModal] manual refresh triggered');
    useAppStore.getState().loadAllData().catch(() => {});
  };

  useEffect(() => {
    if (!isOpen) return;

    const store = useAppStore.getState();
    const openNow = (store.cases || []).filter((c: any) => c.status === 'Open');
    const allLen = (store.cases || []).length;
    console.log('[LogExpenseModal] dialog opened. store.cases.length=', allLen, ' open filtered=', openNow.length);
    console.log('[LogExpenseModal] open cases list for dropdown:', openNow.map((c: any) => ({ id: c.id, caseNumber: c.caseNumber, last: c.respondentLastName, first: c.respondentFirstName, status: c.status })));

    // If still empty here, force a reload from Dexie (defensive)
    if (openNow.length === 0 && allLen === 0) {
      store.loadAllData?.().catch(() => {});
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
    const selectedCaseObj = openCases.find(c => c.id === selectedCase) || selectorCases.find(c => c.id === selectedCase);
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

  // Right before rendering the Case select (exact same source as LogTimeModal)
  console.log('[LogExpenseModal] right before rendering the Case select, cases array being used:', cases);

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
            <CaseSelector
              key={`case-sel-${selectorCases.map((c: any) => c.id).join('|') || 'empty'}`}
              selectedCaseId={selectedCase}
              onChange={(caseId) => setSelectedCase(caseId)}
              cases={selectorCases}
            />
            {openCases.length === 0 && (
              <div className="text-xs text-amber-400 mt-1">No open cases. Create one first using the + New Case button.</div>
            )}
            <button type="button" onClick={refreshCases} className="text-xs text-blue-400 hover:underline mt-1">🔄 Refresh open cases (temp)</button>
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
