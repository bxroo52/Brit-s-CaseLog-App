'use client';

import { useState, useEffect } from 'react';
import { useAppStore } from '@/stores/useAppStore';

export default function ProfileForm({ 
  onSave, 
  onClose 
}: { 
  onSave: (data: any) => void; 
  onClose: () => void; 
}) {
  const { profile, activityRates } = useAppStore();

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    rates: {
      Contact: 0,
      Court: 0,
      Research: 0,
      'Report Writing': 0,
      'Drive Time': 0,
      'Wait Time': 0,
      Other: 0,
    } as Record<string, number>,
  });

  // Preload from store when available
  useEffect(() => {
    if (profile) {
      setFormData(prev => ({
        ...prev,
        name: profile.name || '',
        email: profile.email || '',
        phone: profile.phone || '',
      }));
    }

    if (activityRates && activityRates.length > 0) {
      const loadedRates: Record<string, number> = { ...formData.rates };
      activityRates.forEach(r => {
        if (r.activityName in loadedRates) {
          loadedRates[r.activityName] = r.hourlyRate;
        }
      });
      setFormData(prev => ({
        ...prev,
        rates: loadedRates,
      }));
    }
  }, [profile, activityRates]);

  const handleRateChange = (activity: string, value: string) => {
    const num = parseFloat(value) || 0;
    setFormData(prev => ({
      ...prev,
      rates: { ...prev.rates, [activity]: num }
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-end z-50">
      <div className="bg-[#1C1C1E] w-full max-w-md rounded-t-3xl p-6 text-white max-h-[90vh] overflow-auto">
        <div className="flex justify-between mb-6">
          <h2 className="text-2xl font-semibold">Your Info (for Invoices)</h2>
          <button onClick={onClose} className="text-3xl">×</button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1.5">Name</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              placeholder="Enter your full name"
              className="w-full bg-[#2C2C2E] border border-[#3A3A3C] rounded-2xl px-4 py-3"
            />
          </div>

          {/* Email */}
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1.5">Email</label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
              placeholder="your@email.com"
              className="w-full bg-[#2C2C2E] border border-[#3A3A3C] rounded-2xl px-4 py-3"
            />
          </div>

          {/* Phone */}
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1.5">Phone</label>
            <input
              type="tel"
              value={formData.phone}
              onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
              placeholder="(907) 555-0123"
              className="w-full bg-[#2C2C2E] border border-[#3A3A3C] rounded-2xl px-4 py-3"
            />
          </div>

          {/* Activity Rates - ALL DEFAULT TO 0 */}
          <div>
            <h3 className="font-semibold mb-1">Activity Rates</h3>
            <p className="text-sm text-gray-400 mb-4">
              Set your hourly rate for each activity type (used in Log Time).
            </p>

            {Object.entries(formData.rates).map(([activity, rate]) => (
              <div key={activity} className="flex items-center justify-between py-3 border-b border-[#3A3A3C] last:border-none">
                <span className="text-white">{activity}</span>
                <div className="flex items-center gap-2">
                  <span className="text-gray-400">$</span>
                  <input
                    type="number"
                    value={rate}
                    onChange={(e) => handleRateChange(activity, e.target.value)}
                    step="0.01"
                    min="0"
                    className="w-24 bg-[#2C2C2E] border border-[#3A3A3C] rounded-xl px-3 py-2 text-right text-white"
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="pt-4 space-y-3">
            <button
              type="submit"
              className="w-full bg-white text-black font-semibold py-4 rounded-2xl"
            >
              Save Profile
            </button>
            <button
              type="button"
              onClick={onClose}
              className="w-full border border-gray-600 py-4 rounded-2xl"
            >
              Close
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
