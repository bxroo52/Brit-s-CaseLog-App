'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export default function LogTimeModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [cases, setCases] = useState<any[]>([]);
  const [selectedCase, setSelectedCase] = useState('');

  useEffect(() => {
    if (!isOpen) return;

    async function load() {
      if (!supabase) {
        console.log('Supabase not configured');
        setCases([]);
        return;
      }
      const { data, error } = await supabase
        .from('cases')
        .select('*');
      console.log('Cases loaded:', data, error);
      setCases(data || []);
    }
    load();
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 flex items-end z-50">
      <div className="bg-zinc-950 w-full rounded-t-3xl p-6 text-white">
        <h2 className="text-2xl font-bold mb-6">Log Time</h2>
        <select value={selectedCase} onChange={e => setSelectedCase(e.target.value)} className="w-full p-4 bg-zinc-900">
          <option value="">Select Case</option>
          {cases.map(c => <option key={c.id} value={c.id}>{c.case_number} {c.title}</option>)}
        </select>
        <button onClick={onClose} className="mt-8 w-full bg-white text-black py-4">Close</button>
      </div>
    </div>
  );
}
