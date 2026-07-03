'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

const activityTypes = [
  'Contact', 'Court', 'Research', 'Report Writing',
  'Drive Time', 'Wait Time', 'Other'
];

export default function RatesSettings() {
  const [rates, setRates] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function loadRates() {
      if (!supabase) return;
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from('hourly_rates')
        .select('activity_type, hourly_rate')
        .eq('user_id', user.id);

      const loaded: Record<string, string> = {};
      data?.forEach(r => {
        if (r.hourly_rate !== null) {
          loaded[r.activity_type] = r.hourly_rate.toFixed(2);
        }
      });
      setRates(loaded);
    }
    loadRates();
  }, []);

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
      hourly_rate: rate ? parseFloat(rate) : null
    }));

    const { error } = await supabase
      .from('hourly_rates')
      .upsert(updates, { onConflict: 'user_id,activity_type' });

    if (!error) {
      alert('Rates saved successfully!');
    } else {
      console.error(error);
      alert('Error saving rates');
    }
    setLoading(false);
  };

  return (
    <div className="p-6 max-w-md mx-auto bg-zinc-950 text-white min-h-screen">
      <h2 className="text-lg mb-1">Set hourly rates</h2>
      <p className="text-zinc-400 text-sm mb-6">
        These apply to all future time logs.
      </p>

      <div className="space-y-6">
        {activityTypes.map(type => (
          <div key={type} className="flex items-center justify-between">
            <span className="text-lg">{type}</span>
            <div className="flex items-center gap-2">
              <span className="text-zinc-400">$</span>
              <input
                type="number"
                step="0.01"
                placeholder="0.00"
                value={rates[type] || ''}
                onChange={(e) => handleChange(type, e.target.value)}
                className="bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-3 w-32 text-right text-lg focus:outline-none focus:border-white"
              />
            </div>
          </div>
        ))}
      </div>

      <div className="mt-10 space-y-4">
        <button
          onClick={handleSave}
          disabled={loading}
          className="w-full bg-white text-black py-4 rounded-2xl font-medium text-lg disabled:opacity-50"
        >
          {loading ? 'Saving...' : 'Save Rates'}
        </button>
        <button className="w-full py-4 text-zinc-400">Cancel</button>
      </div>
    </div>
  );
}
