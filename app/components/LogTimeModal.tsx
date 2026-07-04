'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { showToast } from './Toast';

interface LogTimeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOptimisticAdd?: (tempEntry: any) => void;
  onSuccess?: () => void;
}

export default function LogTimeModal({ isOpen, onClose, onOptimisticAdd, onSuccess }: LogTimeModalProps) {
  const [cases, setCases] = useState<any[]>([]);
  const [selectedCase, setSelectedCase] = useState('');
  const [selectedActivity, setSelectedActivity] = useState('Contact');
  const [hours, setHours] = useState('1');
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
        .eq('status', 'Open')
        .order('created_at', { ascending: false });
      setCases(data || []);
    }
    loadCases();
  }, [isOpen]);

  const handleLogTime = async () => {
    if (!selectedCase) {
      showToast('Please select a case', 'error');
      return;
    }

    if (!supabase) {
      showToast('Supabase not configured', 'error');
      setLoading(false);
      return;
    }

    setLoading(true);

    // Create optimistic entry
    const tempId = 'temp-' + Date.now();
    const optimisticEntry = {
      id: tempId,
      case_id: selectedCase,
      activity_type: selectedActivity,
      hours: parseFloat(hours),
      rate: 50,
      description: description.trim(),
      date: new Date().toISOString().split('T')[0],
      cases: cases.find(c => c.id === selectedCase),
      _optimistic: true, // flag for UI
    };

    // Optimistic UI update (instant)
    if (onOptimisticAdd) {
      onOptimisticAdd(optimisticEntry);
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not logged in');

      const { data: rateData } = await supabase.from('hourly_rates').select('rate').eq('user_id', user.id).single();
      const rate = rateData?.rate || 50;

      const { error } = await supabase.from('time_entries').insert({
        user_id: user.id,
        case_id: selectedCase,
        activity_type: selectedActivity,
        hours: parseFloat(hours),
        rate: rate,
        description: description.trim(),
        date: new Date().toISOString().split('T')[0],
      });

      if (error) throw error;

      showToast('Time logged successfully!');
      onClose();
      if (onSuccess) onSuccess();

      // Reset form
      setSelectedCase('');
      setSelectedActivity('Contact');
      setHours('1');
      setDescription('');

    } catch (err: any) {
      showToast('Failed to log time. Please try again.', 'error');
      // Rollback of optimistic temp would be handled by parent if onError callback existed
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 flex items-end z-50">
      <div className="bg-zinc-950 w-full rounded-t-3xl p-6 text-white">
        <h2 className="text-2xl font-bold mb-6">Log Time</h2>

        <div className="space-y-6">
          <div>
            <label className="block text-sm text-zinc-400 mb-2">Case</label>
            <select value={selectedCase} onChange={e => setSelectedCase(e.target.value)} className="w-full bg-zinc-900 border border-zinc-700 rounded-2xl p-4 text-lg">
              <option value="">Select a case...</option>
              {cases.map(c => <option key={c.id} value={c.id}>{c.case_number} - {c.title}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-sm text-zinc-400 mb-2">Activity</label>
            <select value={selectedActivity} onChange={e => setSelectedActivity(e.target.value)} className="w-full bg-zinc-900 border border-zinc-700 rounded-2xl p-4 text-lg">
              {['Contact','Court','Research','Report Writing','Drive Time','Wait Time','Other'].map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-sm text-zinc-400 mb-2">Billable Hours</label>
            <input type="number" step="0.25" value={hours} onChange={e => setHours(e.target.value)} className="w-full bg-zinc-900 border border-zinc-700 rounded-2xl p-6 text-5xl text-center" />
          </div>

          <div>
            <label className="block text-sm text-zinc-400 mb-2">Description / Notes</label>
            <textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="What was done?" className="w-full bg-zinc-900 border border-zinc-700 rounded-2xl p-4 h-24" />
          </div>
        </div>

        <button onClick={handleLogTime} disabled={loading || !selectedCase} className="w-full bg-white text-black py-5 rounded-3xl text-xl font-medium mt-10 disabled:opacity-50">
          {loading ? 'Logging...' : 'Log Time'}
        </button>
      </div>
    </div>
  );
}
