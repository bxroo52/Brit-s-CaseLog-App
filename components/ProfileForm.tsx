'use client';

import { useState, useEffect } from 'react';
import { useAppStore } from '@/stores/useAppStore';
import { ACTIVITY_TYPES } from '@/lib/constants';

export default function ProfileForm({ onSave, onClose }: { 
  onSave: (data: any) => void; 
  onClose: () => void; 
}) {
  const { profile, activityRates } = useAppStore();

  const [formData, setFormData] = useState(() => {
    const initialRates: Record<string, string> = {
      Contact: '',
      Court: '',
      Research: '',
      'Report Writing': '',
      'Drive Time': '',
      'Wait Time': '',
      Other: '',
    };

    ACTIVITY_TYPES.forEach((activity) => {
      const found = activityRates.find((r) => r.activityName === activity);
      if (found) {
        initialRates[activity] = String(found.hourlyRate);
      }
    });

    return {
      name: profile?.name || '',
      email: profile?.email || '',
      phone: profile?.phone || '',
      rates: initialRates,
    };
  });

  // Keep in sync if store updates while form is open
  useEffect(() => {
    setFormData(prev => {
      const newRates = { ...prev.rates };

      ACTIVITY_TYPES.forEach((activity) => {
        const found = activityRates.find((r) => r.activityName === activity);
        if (found) {
          newRates[activity] = String(found.hourlyRate);
        }
      });

      return {
        ...prev,
        name: profile?.name || prev.name,
        email: profile?.email || prev.email,
        phone: profile?.phone || prev.phone,
        rates: newRates,
      };
    });
  }, [profile, activityRates]);

  const handleRateChange = (activity: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      rates: { ...prev.rates, [activity]: value }
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const processedRates = Object.fromEntries(
      Object.entries(formData.rates).map(([k, v]) => [k, v === '' ? 0 : parseFloat(v) || 0])
    );
    onSave({ ...formData, rates: processedRates });
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-end z-50">
      <div className="bg-[#1C1C1E] w-full max-w-md rounded-t-3xl p-6 text-white max-h-[90vh] overflow-auto">
        <div className="flex justify-between mb-6">
          <h2 className="text-2xl font-semibold">Profile Overview</h2>
          <button onClick={onClose} className="text-3xl">×</button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1.5">Name</label>
            <input type="text" value={formData.name} onChange={e => setFormData(p => ({...p, name: e.target.value}))} placeholder="Enter your full name" className="w-full bg-[#2C2C2E] border border-[#3A3A3C] rounded-2xl px-4 py-3" />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1.5">Email</label>
            <input type="email" value={formData.email} onChange={e => setFormData(p => ({...p, email: e.target.value}))} placeholder="your@email.com" className="w-full bg-[#2C2C2E] border border-[#3A3A3C] rounded-2xl px-4 py-3" />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1.5">Phone</label>
            <input type="tel" value={formData.phone} onChange={e => setFormData(p => ({...p, phone: e.target.value}))} placeholder="(907) 555-0123" className="w-full bg-[#2C2C2E] border border-[#3A3A3C] rounded-2xl px-4 py-3" />
          </div>

          {/* Blank Activity Rates */}
          <div>
            <h3 className="font-semibold mb-1">Activity Rates</h3>
            <p className="text-sm text-gray-400 mb-4">Set your hourly rate for each activity type (used in Log Time).</p>

            {Object.entries(formData.rates).map(([activity, rate]) => (
              <div key={activity} className="flex items-center justify-between py-3 border-b border-[#3A3A3C]">
                <span className="text-white">{activity}</span>
                <div className="flex items-center gap-2">
                  <span className="text-gray-400">$</span>
                  <input
                    type="number"
                    value={rate}
                    onChange={(e) => handleRateChange(activity, e.target.value)}
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    className="w-24 bg-[#2C2C2E] border border-[#3A3A3C] rounded-xl px-3 py-2 text-right placeholder-gray-500"
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="pt-6 space-y-3">
            <button type="submit" className="w-full bg-white text-black font-semibold py-4 rounded-2xl">Save Profile</button>
            <button type="button" onClick={onClose} className="w-full border border-gray-600 py-4 rounded-2xl">Close</button>
          </div>
        </form>
      </div>
    </div>
  );
}
