'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export default function LogTimeModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [cases, setCases] = useState<any[]>([]);
  const [selectedCase, setSelectedCase] = useState('');
  const [selectedActivity, setSelectedActivity] = useState('Contact');
  const [hours, setHours] = useState('1');

  useEffect(() => {
    if (!isOpen) return;

    async function loadCases() {
      if (!supabase) {
        setCases([]);
        return;
      }
      const { data } = await supabase
        .from('cases')
        .select('id, case_number, title')
        .order('created_at', { ascending: false });
      setCases(data || []);
    }
    loadCases();
  }, [isOpen]);

  const handleLog = async () => {
    console.log('Logging time for case:', selectedCase);
    // TODO: save to time_entries
    alert('Time logged!');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 flex items-end z-50">
      <div className="bg-zinc-950 w-full rounded-t-3xl p-6 text-white max-h-[90vh] overflow-auto">
        <h2 className="text-2xl font-bold mb-6">Log Time</h2>

        <div className="space-y-6">
          <div>
            <label className="block text-sm text-zinc-400 mb-2">Case</label>
            <select 
              value={selectedCase} 
              onChange={(e) => setSelectedCase(e.target.value)}
              className="w-full bg-zinc-900 border border-zinc-700 rounded-2xl p-4 text-lg"
            >
              <option value="">Select a case...</option>
              {cases.map(c => (
                <option key={c.id} value={c.id}>
                  {c.title} — {c.case_number}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm text-zinc-400 mb-2">Activity</label>
            <select 
              value={selectedActivity} 
              onChange={(e) => setSelectedActivity(e.target.value)}
              className="w-full bg-zinc-900 border border-zinc-700 rounded-2xl p-4 text-lg"
            >
              {['Contact','Court','Research','Report Writing','Drive Time','Wait Time','Other'].map(a => (
                <option key={a} value={a}>{a}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm text-zinc-400 mb-2">Billable Hours</label>
            <input
              type="number"
              step="0.25"
              value={hours}
              onChange={(e) => setHours(e.target.value)}
              className="w-full bg-zinc-900 border border-zinc-700 rounded-2xl p-6 text-5xl text-center"
            />
          </div>
        </div>

        <button onClick={handleLog} className="w-full bg-white text-black py-5 rounded-3xl text-xl font-medium mt-10">
          Log Time
        </button>
      </div>
    </div>
  );
}
