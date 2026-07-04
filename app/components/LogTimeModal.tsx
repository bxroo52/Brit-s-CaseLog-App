'use client';

import { useState, useEffect } from 'react';
import { useAppStore } from '@/stores/useAppStore';
import { showToast } from './Toast';

interface LogTimeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOptimisticAdd?: (tempEntry: any) => void;
  onSuccess?: () => void;
}

export default function LogTimeModal({ isOpen, onClose, onOptimisticAdd, onSuccess }: LogTimeModalProps) {
  const { getOpenCases, addTimeEntry } = useAppStore();
  const [selectedCase, setSelectedCase] = useState('');
  const [selectedActivity, setSelectedActivity] = useState('Contact');
  const [hours, setHours] = useState('1');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);

  // Use the exact same data source as the Dashboard’s Open Cases section (Zustand store / Dexie)
  // which correctly populates respondent names and case numbers from the main app data.
  const cases = getOpenCases ? getOpenCases() : [];

  useEffect(() => {
    if (!isOpen) return;
    setSelectedCase('');
    setSelectedActivity('Contact');
    setHours('1');
    setDescription('');
  }, [isOpen]);

  const handleLogTime = async () => {
    const billableHoursNum = parseFloat(hours);
    const desc = description.trim();

    // Required fields check as per spec
    if (!selectedCase) {
      showToast('Please select a case', 'error');
      return;
    }
    if (!selectedActivity) {
      showToast('Please select an activity', 'error');
      return;
    }
    if (isNaN(billableHoursNum) || billableHoursNum <= 0) {
      showToast('Billable Hours must be greater than 0', 'error');
      return;
    }
    if (!desc) {
      showToast('Description is required', 'error');
      return;
    }

    setLoading(true);

    // Create optimistic entry in format expected by TimeEntriesRealtime (snake-ish keys for display)
    const tempId = 'temp-' + Date.now();
    const selectedCaseObj = cases.find(c => c.id === selectedCase);
    const optimisticCases = selectedCaseObj ? {
      case_number: selectedCaseObj.caseNumber,
      title: `${selectedCaseObj.respondentLastName || ''}, ${selectedCaseObj.respondentFirstName || ''}`.replace(/^, |, $/, '').trim(),
    } : undefined;

    const optimisticEntry = {
      id: tempId,
      case_id: selectedCase,
      activity_type: selectedActivity,
      hours: billableHoursNum,
      rate: 50,
      description: desc,
      date: new Date().toISOString().split('T')[0],
      cases: optimisticCases,
      _optimistic: true,
    };

    // Optimistic UI update (instant) for the live list
    if (onOptimisticAdd) {
      onOptimisticAdd(optimisticEntry);
    }

    try {
      // Use store action for reliable Dexie save + sync queue (instead of direct Supabase which was failing due to schema/FK/sync issues)
      await addTimeEntry({
        caseId: selectedCase,
        date: new Date().toISOString().split('T')[0],
        activityType: selectedActivity,
        billableHours: billableHoursNum,
        description: desc,
      });
      // Store handles rounding, local save, queue, and its own success toast ("Time entry saved.")

      showToast('Time logged successfully!');
      onClose();
      if (onSuccess) onSuccess();

      // Reset form
      setSelectedCase('');
      setSelectedActivity('Contact');
      setHours('1');
      setDescription('');

    } catch (err: any) {
      console.error('Failed to log time (store addTimeEntry):', err);
      // Store already showed error toast and rolled back; show the reported error too for now
      showToast('Failed to log time. Please try again.', 'error');
      // Note: optimistic temp may remain visible until manual clear or next success
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 flex items-end z-50">
      <div className="bg-zinc-950 w-full max-w-md mx-auto rounded-t-3xl flex flex-col overflow-hidden max-h-[85dvh]" style={{ maxHeight: 'min(85dvh, calc(100dvh - 20px))' }}>
        <div className="px-6 pt-6 pb-2 flex justify-between items-center flex-shrink-0">
          <h2 className="text-2xl font-bold">Log Time</h2>
          <button onClick={onClose} className="text-xl">✕</button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 pb-6 space-y-6" style={{ paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom))' }}>
          <div>
            <label className="block text-sm text-zinc-400 mb-2">Case</label>
            <select value={selectedCase} onChange={e => setSelectedCase(e.target.value)} className="w-full bg-zinc-900 border border-zinc-700 rounded-2xl p-4 text-lg">
              <option value="">Select a case...</option>
              {cases.map(c => (
                <option key={c.id} value={c.id}>
                  {c.respondentLastName}, {c.respondentFirstName} — {c.caseNumber}
                </option>
              ))}
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
            <input type="number" step="0.25" value={hours} onChange={e => setHours(e.target.value)} className="w-full bg-zinc-900 border border-zinc-700 rounded-2xl p-3 text-xl text-center" inputMode="decimal" />
          </div>

          <div>
            <label className="block text-sm text-zinc-400 mb-2">Description / Notes</label>
            <textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="What was done?" className="w-full bg-zinc-900 border border-zinc-700 rounded-2xl p-4 h-24" />
          </div>

          <button onClick={handleLogTime} disabled={loading || !selectedCase} className="w-full bg-white text-black py-5 rounded-3xl text-xl font-medium mt-10 disabled:opacity-50">
            {loading ? 'Logging...' : 'Log Time'}
          </button>
        </div>
      </div>
    </div>
  );
}
