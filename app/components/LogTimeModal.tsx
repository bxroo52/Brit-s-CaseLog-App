'use client';

import { useState, useEffect } from 'react';
import { useAppStore } from '@/stores/useAppStore';
import { ACTIVITY_TYPES } from '@/lib/constants';

export default function LogTimeModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [selectedActivity, setSelectedActivity] = useState('Contact');
  const [hours, setHours] = useState('1');
  const [rate, setRate] = useState<number>(0);

  const { getActivityRate, loadActivityRates, activityRates } = useAppStore();

  // Pull rate from saved Dexie storage (via store), not Supabase. Fix duplicate $ in estimate.
  useEffect(() => {
    if (!isOpen) return;
    loadActivityRates().catch(() => {});
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const r = getActivityRate(selectedActivity);
    setRate(r);
  }, [isOpen, selectedActivity, activityRates]);

  const numEst = (parseFloat(hours) * rate).toFixed(2);
  const estimated = `$${numEst}`;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 flex items-end z-50">
      <div className="bg-zinc-950 w-full rounded-t-3xl p-6">
        <h2 className="text-2xl font-semibold mb-6">Log Time</h2>

        <div className="mb-6">
          <label className="text-sm text-zinc-400">Activity</label>
          <select value={selectedActivity} onChange={e => setSelectedActivity(e.target.value)} className="w-full bg-zinc-900 p-4 rounded-xl mt-1">
            {ACTIVITY_TYPES.map((a) => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>
        </div>

        <div className="mb-6">
          <label className="text-sm text-zinc-400">Billable Hours</label>
          <input type="number" step="0.25" value={hours} onChange={e => setHours(e.target.value)} className="w-full bg-zinc-900 p-6 text-5xl text-center rounded-xl" />
        </div>

        <div>
          <div className="text-sm text-zinc-400">Estimated Bill</div>
          <div className="text-5xl font-semibold">{estimated}</div>
          <div className="text-sm text-zinc-400">(${rate}/hr)</div>
        </div>

        <button onClick={onClose} className="w-full bg-white text-black py-5 rounded-2xl mt-10">Log Time</button>
      </div>
    </div>
  );
}
