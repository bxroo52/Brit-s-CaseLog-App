'use client';

import { useState, useEffect } from 'react';
import { useAppStore } from '@/stores/useAppStore';
import { ACTIVITY_TYPES } from '@/lib/constants';

export default function RatesSettings() {
  const { activityRates, saveActivityRate, loadActivityRates } = useAppStore();
  const [rates, setRates] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function loadRates() {
      try {
        await loadActivityRates().catch(() => {});
        const currentRates = useAppStore.getState().activityRates;
        const loaded: Record<string, string> = {};
        ACTIVITY_TYPES.forEach((type) => {
          const found = currentRates.find((r) => r.activityName === type);
          loaded[type] = found ? found.hourlyRate.toString() : '';
        });
        setRates(loaded);
      } catch {
        const blank: Record<string, string> = {};
        ACTIVITY_TYPES.forEach((t) => { blank[t] = ''; });
        setRates(blank);
      }
    }
    loadRates();
  }, []);

  const handleChange = (type: string, value: string) => {
    setRates((prev) => ({ ...prev, [type]: value }));
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      const entries = Object.entries(rates).filter(([, v]) => v.trim() !== '');
      for (const [activityName, rateStr] of entries) {
        const num = parseFloat(rateStr);
        if (!isNaN(num)) {
          await saveActivityRate(activityName, num);
        }
      }
      alert('Rates saved successfully!');
    } catch (e) {
      console.error('Failed saving rates', e);
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
        {ACTIVITY_TYPES.map((type) => (
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
