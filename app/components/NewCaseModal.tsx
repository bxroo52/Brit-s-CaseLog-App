'use client';

import { useState } from 'react';
import { useAppStore } from '@/stores/useAppStore';

export default function NewCaseModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const { addCase } = useAppStore();

  const [form, setForm] = useState({
    first_name: '',
    last_name: '',
    case_number: '',
    assignment_type: 'Initial',
    status: 'Open',
    first_time_billing: false,
    notes: '',
  });

  const handleChange = (field: string, value: string | boolean) => {
    if (field === 'case_number') {
      // Force uppercase
      value = (value as string).toUpperCase();
    }
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async () => {
    const caseData = {
      respondentFirstName: form.first_name,
      respondentLastName: form.last_name,
      caseNumber: form.case_number,
      assignmentType: form.assignment_type as any,
      status: form.status as any,
      firstTimeBilling: form.first_time_billing,
      notes: form.notes,
    };
    try {
      await addCase(caseData);
      alert('Case created!');
      onClose();
    } catch (e) {
      alert('Error creating case');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 flex items-end z-50">
      <div className="bg-zinc-950 w-full rounded-t-3xl p-6 text-white">
        <div className="flex justify-between mb-6">
          <h2 className="text-2xl font-bold">New Case</h2>
          <button onClick={onClose}>✕</button>
        </div>

        <div className="space-y-5">
          <div>
            <label className="block text-sm mb-1">First Name</label>
            <input 
              value={form.first_name} 
              onChange={e => handleChange('first_name', e.target.value)} 
              className="w-full bg-zinc-900 border border-zinc-700 rounded-2xl p-4" 
              placeholder="First Name" 
            />
          </div>

          <div>
            <label className="block text-sm mb-1">Last Name</label>
            <input 
              value={form.last_name} 
              onChange={e => handleChange('last_name', e.target.value)} 
              className="w-full bg-zinc-900 border border-zinc-700 rounded-2xl p-4" 
              placeholder="Last Name" 
            />
          </div>

          <div>
            <label className="block text-sm mb-1">Case Number</label>
            <input 
              value={form.case_number} 
              onChange={e => handleChange('case_number', e.target.value)} 
              className="w-full bg-zinc-900 border border-zinc-700 rounded-2xl p-4 uppercase" 
              placeholder="3AN-24-00123" 
              style={{ textTransform: 'uppercase' }}
            />
          </div>

          <div>
            <label className="block text-sm mb-1">Assignment Type</label>
            <select 
              value={form.assignment_type} 
              onChange={e => handleChange('assignment_type', e.target.value)} 
              className="w-full bg-zinc-900 border border-zinc-700 rounded-2xl p-4"
            >
              <option>Initial</option>
              <option>Review</option>
              <option>Three year</option>
            </select>
          </div>

          <div>
            <label className="block text-sm mb-1">Status</label>
            <select 
              value={form.status} 
              onChange={e => handleChange('status', e.target.value)} 
              className="w-full bg-zinc-900 border border-zinc-700 rounded-2xl p-4"
            >
              <option>Open</option>
              <option>Closed</option>
            </select>
          </div>

          <div className="flex items-center gap-3">
            <input 
              type="checkbox" 
              checked={form.first_time_billing} 
              onChange={e => handleChange('first_time_billing', e.target.checked)} 
            />
            <span>First time billing for this case</span>
          </div>

          <div>
            <label className="block text-sm mb-1">Case Notes (optional)</label>
            <textarea 
              value={form.notes} 
              onChange={e => handleChange('notes', e.target.value)} 
              className="w-full bg-zinc-900 border border-zinc-700 rounded-2xl p-4 h-24" 
              placeholder="Special instructions, prior contacts, etc." 
            />
          </div>
        </div>

        <button onClick={handleSubmit} className="w-full bg-blue-600 text-white py-4 rounded-3xl mt-8 text-lg font-medium">
          Create Case
        </button>
      </div>
    </div>
  );
}
