'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';

interface OpenCasesRealtimeProps {
  onNewCase?: () => void;
  onExport?: () => void;
}

export default function OpenCasesRealtime({ onNewCase, onExport }: OpenCasesRealtimeProps) {
  const [cases, setCases] = useState<any[]>([]);

  // Load initial data
  useEffect(() => {
    async function load() {
      if (!supabase) {
        setCases([]);
        return;
      }
      const { data } = await supabase
        .from('cases')
        .select('*')
        .eq('status', 'Open')
        .order('created_at', { ascending: false });
      setCases(data || []);
    }
    load();
  }, []);

  // Realtime subscription
  useEffect(() => {
    if (!supabase) return;
    const channel = supabase
      .channel('cases_realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'cases' },
        (payload) => {
          if (payload.eventType === 'INSERT' && payload.new.status === 'Open') {
            setCases(prev => [payload.new, ...prev]);
          }
          if (payload.eventType === 'UPDATE') {
            setCases(prev =>
              prev.map(c => (c.id === payload.new.id ? { ...c, ...payload.new } : c))
                .filter(c => c.status === 'Open')
            );
          }
          if (payload.eventType === 'DELETE') {
            setCases(prev => prev.filter(c => c.id !== payload.old.id));
          }
        }
      )
      .subscribe();

    return () => { supabase!.removeChannel(channel); };
  }, []);

  return (
    <div>
      <h2 className="text-xl font-bold mb-4">Open Cases</h2>
      {(onNewCase || onExport) && (
        <div className="flex gap-2 mb-4">
          {onNewCase && (
            <Button onClick={onNewCase} className="gap-2"><Plus /> New Case</Button>
          )}
          {onExport && (
            <Button onClick={onExport} variant="outline" className="gap-2">
              Export XLSX (by Last Name)
            </Button>
          )}
        </div>
      )}
      {cases.length === 0 && <p className="text-zinc-400">No open cases.</p>}
      {cases.map(c => {
        const name = c.respondent_name || (c.respondentLastName ? `${c.respondentLastName}, ${c.respondentFirstName || ''}` : '');
        return (
          <div key={c.id} className="bg-zinc-800 rounded-xl p-4 mb-3">
            <div className="font-medium">{name} — {c.case_number || c.caseNumber}</div>
            <div className="text-sm text-zinc-400">{c.status}</div>
          </div>
        );
      })}
    </div>
  );
}
