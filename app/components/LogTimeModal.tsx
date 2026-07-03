'use client';

import { useState, useEffect } from 'react';
import { useAppStore } from '@/stores/useAppStore';

export default function LogTimeModal({ isOpen, onClose, defaultCaseId }: { isOpen: boolean; onClose: () => void; defaultCaseId?: string }) {
  const [selectedCase, setSelectedCase] = useState('');
  const [selectedActivity, setSelectedActivity] = useState('Contact');
  const [hours, setHours] = useState('1');
  const [description, setDescription] = useState('');

  const { cases: allCases, addTimeEntry } = useAppStore();
  const openCases = allCases.filter((c: any) => c.status === 'Open');

  useEffect(() => {
    if (isOpen && defaultCaseId) {
      setSelectedCase(defaultCaseId);
    }
  }, [isOpen, defaultCaseId]);

  const handleLog = async () => {
    if (!selectedCase) {
      alert('Please select a case');
      return;
    }
    const h = parseFloat(hours);
    if (isNaN(h) || h <= 0) {
      alert('Please enter valid billable hours');
      return;
    }

    const today = new Date().toISOString().slice(0, 10);

    try {
      await addTimeEntry({
        caseId: selectedCase,
        date: today,
        activityType: selectedActivity,
        billableHours: h,
        description: description.trim(),
      });
      alert('Time logged!');
      onClose();
      // reset for next time
      setSelectedCase('');
      setHours('1');
      setDescription('');
    } catch (e) {
      console.error(e);
      alert('Failed to log time');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 flex items-end z-50">
      <div className="bg-zinc-950 w-full rounded-t-3xl p-6 text-white max-h-[90vh] overflow-auto">
        <h2 className="text-2xl font-bold mb-6">Log Time</h2>

        <div className="space-y-6">
          <div>
            <label className="block text-sm text-zinc-400 mb-2">Case</label>
            <select 
              value={selectedCase} 
              onChange={(e) => setSelectedCase(e.target.value)}
              className="w-full bg-zinc-900 border border-zinc-700 rounded-2xl p-4 text-lg"
            >
              <option value="">Select a case...</option>
              {openCases.map((c: any) => (
                <option key={c.id} value={c.id}>
                  {c.respondentLastName}, {c.respondentFirstName} — {c.caseNumber}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm text-zinc-400 mb-2">Activity</label>
            <select 
              value={selectedActivity} 
              onChange={(e) => setSelectedActivity(e.target.value)}
              className="w-full bg-zinc-900 border border-zinc-700 rounded-2xl p-4 text-lg"
            >
              {['Contact','Court','Research','Report Writing','Drive Time','Wait Time','Other'].map(a => (
                <option key={a} value={a}>{a}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm text-zinc-400 mb-2">Billable Hours</label>
            <input
              type="number"
              step="0.25"
              value={hours}
              onChange={(e) => setHours(e.target.value)}
              className="w-full bg-zinc-900 border border-zinc-700 rounded-2xl p-6 text-5xl text-center"
            />
          </div>

          <div>
            <label className="block text-sm text-zinc-400 mb-2">Description / Notes</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add a note about this time entry…"
              rows={3}
              className="w-full bg-zinc-900 border border-zinc-700 rounded-2xl p-4 text-sm"
            />
          </div>
        </div>

        <button onClick={handleLog} className="w-full bg-white text-black py-5 rounded-3xl text-xl font-medium mt-10">
          Log Time
        </button>
      </div>
    </div>
  );
}
