'use client';

import { useState, useEffect } from 'react';
import { useAppStore } from '@/stores/useAppStore';
import { ACTIVITY_TYPES } from '@/lib/constants';

export default function ActivityRatesModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const { activityRates, saveActivityRate, loadActivityRates } = useAppStore();
  const [rates, setRates] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

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
    }
    setLoading(false);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 flex items-end z-50"> {/* iOS modal style */}
      <div className="bg-zinc-950 w-full rounded-t-3xl p-6 max-h-[90vh] overflow-auto">
        <h2 className="text-lg mb-1">Set hourly rates</h2>
        <p className="text-zinc-400 text-sm mb-6">These apply to all future time logs.</p>

        <div className="space-y-6">
          {ACTIVITY_TYPES.map((type) => (
            <div key={type} className="flex items-center justify-between">
              <span>{type}</span>
              <div className="flex items-center gap-2">
                <span className="text-zinc-400">$</span>
                <input
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={rates[type] || ''}
                  onChange={(e) => handleChange(type, e.target.value)}
                  className="bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-3 w-32 text-right"
                />
              </div>
            </div>
          ))}
        </div>

        <div className="mt-8 space-y-3">
          <button
            onClick={handleSave}
            disabled={loading}
            className="w-full bg-white text-black py-4 rounded-2xl font-medium"
          >
            {loading ? 'Saving...' : 'Save Rates'}
          </button>
          <button onClick={onClose} className="w-full py-4 text-zinc-400">Cancel</button>
        </div>
      </div>
    </div>
  );
}
