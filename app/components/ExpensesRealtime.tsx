'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { showToast } from './Toast';
import { formatDate } from '@/lib/format';

interface ExpensesRealtimeProps {
  optimisticEntries?: any[];
  onClearOptimistic?: () => void;
}

export default function ExpensesRealtime({ optimisticEntries = [], onClearOptimistic }: ExpensesRealtimeProps) {
  const [expenses, setExpenses] = useState<any[]>([]);

  useEffect(() => {
    const load = async () => {
      if (!supabase) {
        setExpenses([]);
        return;
      }
      const { data } = await supabase
        .from('expenses')
        .select('*, cases(case_number, title)')
        .order('date', { ascending: false })
        .limit(100);
      setExpenses(data || []);
    };
    load();

    if (!supabase) return;
    const channel = supabase
      .channel('expenses_live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'expenses' }, (payload) => {
        if (payload.eventType === 'INSERT') {
          setExpenses(prev => {
            const filtered = prev.filter(e => !e._optimistic || e.case_id !== payload.new.case_id);
            return [payload.new, ...filtered];
          });
          if (onClearOptimistic) onClearOptimistic();
        }
        if (payload.eventType === 'UPDATE') {
          setExpenses(prev => prev.map(e => e.id === payload.new.id ? { ...e, ...payload.new } : e));
        }
        if (payload.eventType === 'DELETE') {
          setExpenses(prev => prev.filter(e => e.id !== payload.old.id));
        }
      })
      .subscribe();

    return () => { supabase!.removeChannel(channel); };
  }, [onClearOptimistic]);

  const allExpenses = [...optimisticEntries, ...expenses];

  return (
    <div className="bg-zinc-900 rounded-2xl p-6">
      <h3 className="font-bold mb-4">Recent Expenses</h3>

      {allExpenses.length === 0 && <p className="text-zinc-400">No expenses logged yet.</p>}

      {allExpenses.map((expense, index) => {
        const isOptimistic = expense._optimistic;
        const amount = (expense.amount || 0).toFixed(2);
        return (
          <div 
            key={expense.id || index} 
            className={`py-1 border-b border-zinc-800 text-[9px] leading-tight ${isOptimistic ? 'opacity-70' : ''}`}
          >
            <div className="text-[8px] text-zinc-500 mb-0.5">{formatDate(expense.date, 'M/d')}</div>
            <div className="font-semibold text-[10px] leading-tight mb-0.5 text-zinc-100 break-words">
              {expense.cases?.case_number} — {expense.cases?.title}
              {isOptimistic && <span className="text-[7px] ml-1 bg-yellow-600 px-0.5 rounded">Saving</span>}
            </div>
            <div className="text-zinc-400 text-[8px] mb-0.5">
              {expense.type}
            </div>
            <div className="font-semibold text-[10px] mb-0.5">${amount}</div>
            {expense.description && <div className="text-zinc-500 text-[8px] leading-tight mb-0.5 break-words">{expense.description}</div>}
          </div>
        );
      })}
    </div>
  );
}
