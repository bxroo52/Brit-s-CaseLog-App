'use client';

import { useState } from 'react';
import { Case } from '@/types';
import { useAppStore } from '@/stores/useAppStore';

interface LogTimeFormProps {
  cases: Case[];
  onSubmit: (data: any) => Promise<void>;
  onCancel: () => void;
  defaultCaseId?: string;
}

export default function LogTimeForm({ cases, onSubmit, onCancel, defaultCaseId }: LogTimeFormProps) {
  const [selectedCaseId, setSelectedCaseId] = useState(defaultCaseId || '');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [activity, setActivity] = useState('Contact');
  const [billableHours, setBillableHours] = useState('');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { activityRates: storeRates } = useAppStore();

  const selectedCase = cases.find(c => c.id === selectedCaseId);
  const hours = parseFloat(billableHours) || 0;
  const rate = storeRates.find(r => r.activityName === activity)?.hourlyRate ?? 0;
  const estimatedBill = (hours * rate).toFixed(2);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCaseId || !billableHours) return alert("Select a case and enter hours");

    setIsSubmitting(true);
    try {
      await onSubmit({ caseId: selectedCaseId, date, activity, billableHours: hours, description });
      onCancel();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-end z-50">
      <div className="bg-[#1C1C1E] w-full max-w-md rounded-t-3xl p-6 text-white">
        <div className="flex justify-between mb-6">
          <h2 className="text-2xl font-semibold">Log Time</h2>
          <button onClick={onCancel} className="text-3xl">×</button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Case */}
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1.5">Case</label>
            <select value={selectedCaseId} onChange={e => setSelectedCaseId(e.target.value)} className="w-full bg-[#2C2C2E] border border-[#3A3A3C] rounded-2xl px-4 py-4" required>
              <option value="">No case selected</option>
              {cases.map(c => (
                <option key={c.id} value={c.id}>
                  {c.respondentLastName}, {c.respondentFirstName} — {c.caseNumber}
                </option>
              ))}
            </select>
          </div>

          {/* Date + Activity */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1.5">Date</label>
              <input type="date" value={date} onChange={e => setDate(e.target.value)} className="w-full bg-[#2C2C2E] border border-[#3A3A3C] rounded-2xl px-4 py-3" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1.5">Activity</label>
              <select value={activity} onChange={e => setActivity(e.target.value)} className="w-full bg-[#2C2C2E] border border-[#3A3A3C] rounded-2xl px-4 py-3">
                <option value="Contact">Contact</option>
                <option value="Court">Court</option>
                <option value="Research">Research</option>
                <option value="Report Writing">Report Writing</option>
                <option value="Drive Time">Drive Time</option>
                <option value="Wait Time">Wait Time</option>
                <option value="Other">Other</option>
              </select>
            </div>
          </div>

          {/* Billable Hours */}
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1.5">Billable Hours</label>
            <input 
              type="number" 
              value={billableHours} 
              onChange={e => setBillableHours(e.target.value)} 
              step="0.25" 
              min="0"
              placeholder="0"
              className="w-full bg-[#2C2C2E] border border-[#3A3A3C] rounded-2xl px-4 py-3 text-3xl font-light" 
            />
          </div>

          {/* Estimated Bill */}
          <div className="bg-[#2C2C2E] rounded-2xl p-4">
            <div className="text-sm text-gray-400">Estimated Bill</div>
            <div className="text-3xl font-light mt-1">
              {rate === 0 ? 'Set activity rate first' : `$${estimatedBill}`}
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1.5">Description</label>
            <textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="What happened? Be specific for the invoice monster." rows={4} className="w-full bg-[#2C2C2E] border border-[#3A3A3C] rounded-2xl px-4 py-3" />
          </div>

          <div className="pt-4 space-y-3">
            <button type="submit" disabled={isSubmitting || !billableHours || rate === 0} className="w-full bg-white text-black py-4 rounded-2xl font-semibold">Log Time</button>
            <button type="button" onClick={onCancel} className="w-full border border-gray-600 py-4 rounded-2xl">Cancel</button>
          </div>
        </form>
      </div>
    </div>
  );
}
