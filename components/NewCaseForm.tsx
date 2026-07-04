'use client';

import { useState } from 'react';
import { NewCaseFormData, AssignmentType, CaseStatus } from '@/types';
import { toast } from '@/app/components/Toast';

interface NewCaseFormProps {
  onSubmit: (data: NewCaseFormData) => Promise<void>;
  onClose: () => void;
  existingCase?: any;
  onDelete?: () => void;
}

export default function NewCaseForm({ onSubmit, onClose, existingCase, onDelete }: NewCaseFormProps) {
  const [formData, setFormData] = useState<NewCaseFormData>({
    respondentFirstName: existingCase?.respondentFirstName || '',
    respondentLastName: existingCase?.respondentLastName || '',
    // Always start completely blank for new case (no default/prefill value)
    caseNumber: existingCase ? (existingCase.caseNumber || '') : '',
    assignmentType: existingCase?.assignmentType || 'Initial',
    status: existingCase?.status || 'Open',
    firstTimeBilling: existingCase?.firstTimeBilling ?? false,
    notes: existingCase?.notes || existingCase?.caseNotes || '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleChange = (field: keyof NewCaseFormData, value: string | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.respondentLastName.trim()) {
      toast.error('Last Name is required');
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit(formData);
      // success handled by optimistic + toast in store (or caller)
      onClose();
    } catch (error) {
      console.error('Failed to create case:', error);
      toast.error('Failed to save case. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-end justify-center z-50">
      <div className="bg-[#1C1C1E] w-full max-w-md rounded-t-3xl p-6 text-white">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-semibold">{existingCase ? 'Edit Case' : 'New Case'}</h2>
          <button onClick={onClose} className="text-3xl leading-none">×</button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* === SEPARATE FIRST & LAST NAME FIELDS === */}
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1.5">First Name</label>
            <input
              type="text"
              value={formData.respondentFirstName}
              onChange={(e) => handleChange('respondentFirstName', e.target.value)}
              placeholder="First Name"
              className="w-full bg-[#2C2C2E] border border-[#3A3A3C] rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-[#0A84FF]"
              autoCapitalize="words"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1.5">Last Name</label>
            <input
              type="text"
              value={formData.respondentLastName}
              onChange={(e) => handleChange('respondentLastName', e.target.value)}
              placeholder="Last Name"
              className="w-full bg-[#2C2C2E] border border-[#3A3A3C] rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-[#0A84FF]"
              autoCapitalize="words"
              required
            />
          </div>

          {/* Case Number */}
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1.5">Case Number</label>
            <input
              type="text"
              value={formData.caseNumber}
              onChange={(e) => handleChange('caseNumber', e.target.value)}
              placeholder="3AN-24-00123"
              className="w-full bg-[#2C2C2E] border border-[#3A3A3C] rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-[#0A84FF]"
            />
          </div>

          {/* Assignment Type */}
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1.5">Assignment Type</label>
            <select
              value={formData.assignmentType}
              onChange={(e) => handleChange('assignmentType', e.target.value as AssignmentType)}
              className="w-full bg-[#2C2C2E] border border-[#3A3A3C] rounded-xl px-4 py-3 text-white focus:outline-none focus:border-[#0A84FF]"
            >
              <option value="Initial">Initial</option>
              <option value="Follow-up">Follow-up</option>
              <option value="Review">Review</option>
              <option value="Other">Other</option>
            </select>
          </div>

          {/* Status */}
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1.5">Status</label>
            <select
              value={formData.status}
              onChange={(e) => handleChange('status', e.target.value as CaseStatus)}
              className="w-full bg-[#2C2C2E] border border-[#3A3A3C] rounded-xl px-4 py-3 text-white focus:outline-none focus:border-[#0A84FF]"
            >
              <option value="Open">Open</option>
              <option value="On Hold">On Hold</option>
              <option value="Completed">Completed</option>
              <option value="Closed">Closed</option>
            </select>
          </div>

          {/* First time billing checkbox */}
          <div className="flex items-center gap-3 pt-1">
            <input
              type="checkbox"
              id="firstTimeBilling"
              checked={formData.firstTimeBilling}
              onChange={(e) => handleChange('firstTimeBilling', e.target.checked)}
              className="w-5 h-5 accent-[#0A84FF]"
            />
            <label htmlFor="firstTimeBilling" className="text-sm text-gray-300">
              First time billing for this case
            </label>
          </div>

          {/* Case Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1.5">Case Notes (optional)</label>
            <textarea
              value={formData.notes}
              onChange={(e) => handleChange('notes', e.target.value)}
              placeholder="Special instructions, prior contacts, etc."
              rows={3}
              className="w-full bg-[#2C2C2E] border border-[#3A3A3C] rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-[#0A84FF] resize-y"
            />
          </div>

          {/* Create Button */}
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full mt-4 bg-[#0A84FF] hover:bg-[#007AFF] active:bg-[#0066CC] transition-colors text-white font-semibold py-4 rounded-2xl text-lg disabled:opacity-60"
          >
            {isSubmitting ? (existingCase ? 'Updating...' : 'Creating Case...') : (existingCase ? 'Update Case' : 'Create Case')}
          </button>

          {/* Delete Button + Confirmation - only for editing */}
          {existingCase && (
            <div className="pt-6">
              <button
                type="button"
                onClick={() => {
                  if (confirm("Are you absolutely sure you want to delete this case? This action cannot be undone.")) {
                    onDelete?.();
                  }
                }}
                className="w-full bg-red-600/90 hover:bg-red-600 active:bg-red-700 text-white font-semibold py-4 rounded-2xl"
              >
                Delete Case
              </button>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}
