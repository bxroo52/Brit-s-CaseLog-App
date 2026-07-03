'use client';

import { useState, useEffect } from 'react';
import { useAppStore } from '@/stores/useAppStore';
import { ACTIVITY_TYPES } from '@/lib/constants';

export default function ActivityRatesModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const { activityRates, saveActivityRate, loadActivityRates } = useAppStore();
  const [rates, setRates] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  // Load from Dexie/IndexedDB (via store) when modal opens. Never auto-seed.
  // Blank strings for activities that have never had a rate explicitly saved.
  useEffect(() => {
    if (!isOpen) return;

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
        // on any error, start completely blank
        const blank: Record<string, string> = {};
        ACTIVITY_TYPES.forEach((t) => { blank[t] = ''; });
        setRates(blank);
      }
    }
    loadRates();
  }, [isOpen]);

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
    } catch (e) {
      console.error('Failed saving rates', e);
      // still close; data in storage is what matters
    }
    setLoading(false);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 flex items-end z-50">
      <div className="bg-zinc-900 w-full rounded-t-3xl p-6 max-h-[90vh] overflow-auto text-white">
        <h2 className="text-2xl font-bold mb-2 text-white">Activity Rates</h2>
        <p className="text-zinc-400 text-sm mb-8">Set the hourly rate for each activity type. These apply to all future time logs.</p>

        <div className="space-y-8">
          {ACTIVITY_TYPES.map((name) => (
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
