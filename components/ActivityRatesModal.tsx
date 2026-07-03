'use client';

import { useState, useEffect } from 'react';
import { useAppStore } from '@/stores/useAppStore';
import { ACTIVITY_TYPES } from '@/lib/constants';

export default function ActivityRatesModal({ onSave, onClose }: { 
  onSave: (rates: Record<string, number>) => void; 
  onClose: () => void; 
}) {
  const { activityRates } = useAppStore();

  const [rates, setRates] = useState<Record<string, string>>({
    Contact: '0.00',
    Court: '0.00',
    Research: '0.00',
    'Report Writing': '0.00',
    'Drive Time': '0.00',
    'Wait Time': '0.00',
    Other: '0.00',
  });

  // Preload from store
  useEffect(() => {
    const loaded: Record<string, string> = {
      Contact: '0.00',
      Court: '0.00',
      Research: '0.00',
      'Report Writing': '0.00',
      'Drive Time': '0.00',
      'Wait Time': '0.00',
      Other: '0.00',
    };

    ACTIVITY_TYPES.forEach((activity) => {
      const found = activityRates.find((r) => r.activityName === activity);
      if (found) {
        loaded[activity] = found.hourlyRate.toFixed(2);
      }
    });
    setRates(loaded);
  }, [activityRates]);

  const handleChange = (activity: string, value: string) => {
    setRates(prev => ({ ...prev, [activity]: value }));
  };

  const handleSave = () => {
    const processed = Object.fromEntries(
      Object.entries(rates).map(([k, v]) => [k, parseFloat(v) || 0])
    );
    onSave(processed);
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-end z-50">
      <div className="bg-[#1C1C1E] w-full max-w-md rounded-t-3xl p-6 text-white">
        <div className="flex justify-between mb-6">
          <h2 className="text-2xl font-semibold">Activity Rates</h2>
          <button onClick={onClose} className="text-3xl">×</button>
        </div>

        <p className="text-sm text-gray-400 mb-8">Set the hourly rate for each activity type. These apply to all future time logs.</p>

        {Object.entries(rates).map(([activity, value]) => (
          <div key={activity} className="flex items-center justify-between py-4 border-b border-[#3A3A3C]">
            <span className="text-white">{activity}</span>
            <div className="flex items-center gap-2">
              <span className="text-gray-400">$</span>
              <input
                type="number"
                value={value}
                onChange={(e) => handleChange(activity, e.target.value)}
                step="0.01"
                min="0"
                className="w-28 bg-[#2C2C2E] border border-[#3A3A3C] rounded-xl px-4 py-2 text-right"
              />
            </div>
          </div>
        ))}

        <div className="pt-8 space-y-3">
          <button onClick={handleSave} className="w-full bg-white text-black py-4 rounded-2xl font-semibold">Save Rates</button>
          <button onClick={onClose} className="w-full border border-gray-600 py-4 rounded-2xl">Cancel</button>
        </div>
      </div>
    </div>
  );
}
