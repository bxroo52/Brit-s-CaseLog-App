'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

const activityTypes = [
  { name: 'Contact', defaultRate: 50 },
  { name: 'Court', defaultRate: 50 },
  { name: 'Research', defaultRate: 50 },
  { name: 'Report Writing', defaultRate: 50 },
  { name: 'Drive Time', defaultRate: 25 },
  { name: 'Wait Time', defaultRate: 25 },
  { name: 'Other', defaultRate: 50 }
];

export default function ActivityRatesModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [rates, setRates] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    const defaults: Record<string, string> = {};
    activityTypes.forEach(({ name, defaultRate }) => {
      defaults[name] = defaultRate.toFixed(2);
    });
    setRates(defaults);
  }, [isOpen]);

  const handleChange = (type: string, value: string) => {
    setRates(prev => ({ ...prev, [type]: value }));
  };

  const handleSave = async () => {
    setLoading(true);
    if (!supabase) {
      alert('Supabase not configured');
      setLoading(false);
      return;
    }
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      return;
    }

    const updates = Object.entries(rates).map(([activity_type, rate]) => ({
      user_id: user.id,
      activity_type,
      hourly_rate: parseFloat(rate),
    }));

    await supabase.from('hourly_rates').upsert(updates, { onConflict: 'user_id,activity_type' });
    setLoading(false);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 flex items-end z-50">
      <div className="bg-zinc-950 w-full rounded-t-3xl p-6 max-h-[90vh] overflow-auto">
        <h2 className="text-lg mb-1">Activity Rates</h2>
        <p className="text-zinc-400 text-sm mb-6">Set the hourly rate for each activity type. These apply to all future time logs.</p>

        <div className="space-y-6">
          {activityTypes.map(({ name }) => (
            <div key={name} className="flex items-center justify-between">
              <span className="text-lg">{name}</span>
              <div className="flex items-center gap-2">
                <span className="text-zinc-400">$</span>
                <input
                  type="number"
                  step="0.01"
                  value={rates[name] || ''}
                  onChange={(e) => handleChange(name, e.target.value)}
                  className="bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-3 w-32 text-right text-lg"
                />
              </div>
            </div>
          ))}
        </div>

        <div className="mt-10 space-y-4">
          <button onClick={handleSave} disabled={loading} className="w-full bg-white text-black py-4 rounded-2xl font-medium">
            {loading ? 'Saving...' : 'Save Rates'}
          </button>
          <button onClick={onClose} className="w-full py-4 text-zinc-400">Cancel</button>
        </div>
      </div>
    </div>
  );
}
