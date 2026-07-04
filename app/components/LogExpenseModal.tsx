'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { showToast } from './Toast';

interface LogExpenseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOptimisticAdd?: (tempEntry: any) => void;
  onSuccess?: () => void;
}

export default function LogExpenseModal({ isOpen, onClose, onOptimisticAdd, onSuccess }: LogExpenseModalProps) {
  const [cases, setCases] = useState<any[]>([]);
  const [selectedCase, setSelectedCase] = useState('');
  const [expenseType, setExpenseType] = useState('Parking');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    async function loadCases() {
      if (!supabase) {
        setCases([]);
        return;
      }
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from('cases')
        .select('id, case_number, title')
        .eq('user_id', user.id)
        .eq('status', 'Open');
      setCases(data || []);
    }
    loadCases();
  }, [isOpen]);

  const handleLogExpense = async () => {
    if (!selectedCase || !amount) {
      showToast('Please select a case and enter amount', 'error');
      return;
    }

    if (!supabase) {
      showToast('Supabase not configured', 'error');
      setLoading(false);
      return;
    }

    setLoading(true);

    // Create optimistic expense
    const tempId = 'temp-exp-' + Date.now();
    const optimisticEntry = {
      id: tempId,
      case_id: selectedCase,
      type: expenseType,
      amount: parseFloat(amount),
      description: description.trim(),
      date: new Date().toISOString().split('T')[0],
      cases: cases.find(c => c.id === selectedCase),
      _optimistic: true,
    };

    if (onOptimisticAdd) {
      onOptimisticAdd(optimisticEntry);
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not logged in');

      const { error } = await supabase.from('expenses').insert({
        user_id: user.id,
        case_id: selectedCase,
        type: expenseType,
        amount: parseFloat(amount),
        description: description.trim(),
        date: new Date().toISOString().split('T')[0],
      });

      if (error) throw error;

      showToast('Expense logged successfully!');
      onClose();
      if (onSuccess) onSuccess();

      // Reset form
      setSelectedCase('');
      setExpenseType('Parking');
      setAmount('');
      setDescription('');

    } catch (err: any) {
      showToast('Failed to log expense. Please try again.', 'error');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 flex items-end z-50">
      <div className="bg-zinc-950 w-full rounded-t-3xl p-6 text-white">
        <h2 className="text-2xl font-bold mb-6">Log Expense</h2>

        <div className="space-y-6">
          <div>
            <label className="block text-sm text-zinc-400 mb-2">Case</label>
            <select value={selectedCase} onChange={e => setSelectedCase(e.target.value)} className="w-full bg-zinc-900 border border-zinc-700 rounded-2xl p-4">
              <option value="">Select a case...</option>
              {cases.map(c => <option key={c.id} value={c.id}>{c.case_number} - {c.title}</option>)}
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
            <input type="number" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} className="w-full bg-zinc-900 border border-zinc-700 rounded-2xl p-6 text-5xl text-center" placeholder="0.00" />
          </div>

          <div>
            <label className="block text-sm text-zinc-400 mb-2">Description / Receipt Note</label>
            <textarea value={description} onChange={e => setDescription(e.target.value)} className="w-full bg-zinc-900 border border-zinc-700 rounded-2xl p-4 h-24" placeholder="Parking at courthouse garage. Receipt #4821" />
          </div>
        </div>

        <button onClick={handleLogExpense} disabled={loading || !selectedCase} className="w-full bg-white text-black py-5 rounded-3xl text-xl font-medium mt-8 disabled:opacity-50">
          {loading ? 'Logging...' : 'Log Expense'}
        </button>
      </div>
    </div>
  );
}
