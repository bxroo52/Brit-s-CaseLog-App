'use client';

import { useState } from 'react';

export default function ProfileForm({ onSave, onClose }: { 
  onSave: (data: any) => void; 
  onClose: () => void; 
}) {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({ name: formData.name, email: formData.email, phone: formData.phone });
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

          <div className="pt-6 space-y-3">
            <button type="submit" className="w-full bg-white text-black font-semibold py-4 rounded-2xl">Save Profile</button>
            <button type="button" onClick={onClose} className="w-full border border-gray-600 py-4 rounded-2xl">Close</button>
          </div>
        </form>
      </div>
    </div>
  );
}
