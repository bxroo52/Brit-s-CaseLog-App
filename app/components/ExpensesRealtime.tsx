'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { showToast } from './Toast';

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
      <h3 className="font-bold mb-4">Recent Expenses (Live)</h3>

      {allExpenses.length === 0 && <p className="text-zinc-400">No expenses logged yet.</p>}

      {allExpenses.map((expense, index) => {
        const isOptimistic = expense._optimistic;
        return (
          <div key={expense.id || index} className={`flex justify-between py-4 border-b border-zinc-800 ${isOptimistic ? 'opacity-70' : ''}`}>
            <div>
              <div className="font-medium flex items-center gap-2">
                {expense.cases?.case_number} {expense.cases?.title}
                {isOptimistic && <span className="text-xs bg-yellow-600 px-2 py-0.5 rounded">Saving...</span>}
              </div>
              <div className="text-sm text-zinc-400">{expense.type}</div>
              {expense.description && <div className="text-xs text-zinc-500 mt-1">{expense.description}</div>}
            </div>
            <div className="text-right font-semibold">
              ${expense.amount?.toFixed(2)}
            </div>
          </div>
        );
      })}
    </div>
  );
}
