'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { showToast } from './Toast';
import EditTimeEntryModal from './EditTimeEntryModal';
import { formatDate } from '@/lib/format';

interface TimeEntriesRealtimeProps {
  optimisticEntries?: any[];
  onClearOptimistic?: () => void;
}

export default function TimeEntriesRealtime({ optimisticEntries = [], onClearOptimistic }: TimeEntriesRealtimeProps) {
  const [entries, setEntries] = useState<any[]>([]);
  const [editingEntry, setEditingEntry] = useState<any>(null);

  // Load + Realtime (same as before)
  useEffect(() => {
    const load = async () => {
      if (!supabase) {
        setEntries([]);
        return;
      }
      const { data } = await supabase
        .from('time_entries')
        .select('*, cases(case_number, title)')
        .order('date', { ascending: false })
        .limit(100);
      setEntries(data || []);
    };
    load();

    if (!supabase) return;
    const channel = supabase
      .channel('time_entries_live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'time_entries' }, (payload) => {
        if (payload.eventType === 'INSERT') {
          // Remove any matching optimistic entry
          setEntries(prev => {
            const filtered = prev.filter(e => !e._optimistic || e.case_id !== payload.new.case_id);
            return [payload.new, ...filtered];
          });
          if (onClearOptimistic) onClearOptimistic();
        }

        if (payload.eventType === 'UPDATE') {
          setEntries(prev =>
            prev.map(e => (e.id === payload.new.id ? { ...e, ...payload.new } : e))
          );
        }

        if (payload.eventType === 'DELETE') {
          setEntries(prev => prev.filter(e => e.id !== payload.old.id));
        }
      })
      .subscribe();

    return () => { supabase!.removeChannel(channel); };
  }, [onClearOptimistic]);

  // Merge real entries + optimistic entries
  const allEntries = [...optimisticEntries, ...entries];

  // Optimistic delete
  const handleDelete = async (id: string, isOptimistic = false) => {
    if (isOptimistic) {
      // Just remove from optimistic list
      showToast('Entry removed');
      return;
    }

    if (!supabase) {
      showToast('Supabase not configured', 'error');
      return;
    }

    const previous = [...entries];
    setEntries(prev => prev.filter(e => e.id !== id));

    const { error } = await supabase.from('time_entries').delete().eq('id', id);
    if (error) {
      setEntries(previous); // Rollback
      showToast('Failed to delete', 'error');
    } else {
      showToast('Entry deleted');
    }
  };

  return (
    <>
      <div className="bg-zinc-900 rounded-2xl p-6">
        <h3 className="font-bold mb-4">Recent Time (Live)</h3>

        {allEntries.length === 0 && <p className="text-zinc-400">No time logged yet.</p>}

        {allEntries.map((entry, index) => {
          const isOptimistic = entry._optimistic;
          const amount = (entry.amount ?? entry.totalAmount ?? ((entry.hours || 0) * (entry.rate || 50))).toFixed(2);
          return (
            <div 
              key={entry.id || index} 
              className={`py-1 border-b border-zinc-800 text-[9px] leading-tight ${isOptimistic ? 'opacity-70' : ''}`}
            >
              <div className="flex justify-between text-[9px] text-zinc-500">
                <span>{formatDate(entry.date, 'M/d')}</span>
                <span className="font-semibold text-zinc-300">${amount}</span>
              </div>
              <div className="font-medium truncate text-zinc-100">
                {entry.cases?.case_number} {entry.cases?.title}
                {isOptimistic && <span className="text-[7px] ml-1 bg-yellow-600 px-0.5 rounded">Saving</span>}
              </div>
              <div className="text-zinc-400 truncate">
                {entry.activity_type} • {entry.hours} hrs
              </div>
              {entry.description && <div className="text-zinc-500 truncate">{entry.description}</div>}
              {!isOptimistic && (
                <div className="flex gap-2 mt-0.5 text-blue-400 text-[8px]">
                  <button onClick={() => setEditingEntry(entry)} className="active:opacity-70">Edit</button>
                  <button onClick={() => handleDelete(entry.id, isOptimistic)} className="text-red-400 active:opacity-70">Del</button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {editingEntry && (
        <EditTimeEntryModal 
          entry={editingEntry} 
          onClose={() => setEditingEntry(null)} 
        />
      )}
    </>
  );
}
