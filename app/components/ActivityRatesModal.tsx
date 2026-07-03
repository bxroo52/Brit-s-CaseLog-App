'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

const activityTypes = ['Contact', 'Court', 'Research', 'Report Writing', 'Drive Time', 'Wait Time', 'Other'];

export default function ActivityRatesModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [rates, setRates] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setRates({}); // reset when closed
      return;
    }

    // Start completely blank every time
    const blankRates: Record<string, string> = {};
    activityTypes.forEach(type => blankRates[type] = '');
    setRates(blankRates);

    // Optional: load saved in background (uncomment if you want to load previous saves)
    // async function load() { ... }
    // load();
  }, [isOpen]);

  const handleChange = (type: string, value: string) => {
    setRates(prev => ({ ...prev, [type]: value }));
  };

  const handleSave = async () => {
    setLoading(true);
    if (!supabase) {
      alert('Supabase not configured');
      setLoading(false);
      onClose();
      return;
    }
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const updates = Object.entries(rates)
        .filter(([, v]) => v.trim() !== '')
        .map(([activity_type, rateStr]) => ({
          user_id: user.id,
          activity_type,
          hourly_rate: parseFloat(rateStr),
        }));
      if (updates.length > 0) {
        await supabase.from('hourly_rates').upsert(updates, { onConflict: 'user_id,activity_type' });
      }
    }
    onClose();
    setLoading(false);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 flex items-end z-50">
      <div className="bg-zinc-900 w-full rounded-t-3xl p-6 max-h-[90vh] overflow-auto text-white">
        <h2 className="text-2xl font-bold mb-2 text-white">Activity Rates</h2>
        <p className="text-zinc-400 text-sm mb-8">Set the hourly rate for each activity type. These apply to all future time logs.</p>

        <div className="space-y-8">
          {activityTypes.map((name) => (
            <div key={name} className="flex items-center justify-between border-b border-zinc-700 pb-6">
              <span className="text-xl font-semibold text-white">{name}</span>
              <div className="flex items-center gap-3">
                <span className="text-2xl text-white">$</span>
                <input
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={rates[name] || ''}
                  onChange={(e) => handleChange(name, e.target.value)}
                  className="bg-zinc-800 border border-zinc-600 rounded-2xl px-6 py-4 w-40 text-right text-2xl text-white placeholder-zinc-400 font-medium focus:border-white focus:outline-none"
                />
              </div>
            </div>
          ))}
        </div>

        <div className="mt-12 space-y-4">
          <button onClick={handleSave} disabled={loading} className="w-full bg-white text-black py-5 rounded-3xl font-semibold text-xl">
            {loading ? 'Saving...' : 'Save Rates'}
          </button>
          <button onClick={onClose} className="w-full py-5 text-zinc-400 text-xl">Cancel</button>
        </div>
      </div>
    </div>
  );
}
