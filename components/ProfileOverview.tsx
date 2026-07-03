'use client';

import { useState, useEffect } from 'react';
import { useAppStore } from '@/stores/useAppStore';

export default function ProfileOverview({ onEdit }: { onEdit: () => void }) {
  const { profile: storeProfile } = useAppStore();
  const [profile, setProfile] = useState({
    name: '',
    email: '',
    phone: '',
  });

  // Load from store (the app's real data source)
  useEffect(() => {
    if (storeProfile) {
      setProfile({
        name: storeProfile.name || '',
        email: storeProfile.email || '',
        phone: storeProfile.phone || '',
      });
    }
  }, [storeProfile]);

  return (
    <div className="bg-[#1C1C1E] rounded-3xl p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-semibold">Profile Overview</h2>
        <button onClick={onEdit} className="text-[#0A84FF] font-medium">Edit</button>
      </div>

      <div className="space-y-6">
        <div>
          <div className="text-sm text-gray-400">Name</div>
          <div className="text-xl font-medium mt-1 text-white">{profile.name || '—'}</div>
        </div>

        <div>
          <div className="text-sm text-gray-400">Email</div>
          <div className="text-xl font-medium mt-1 text-white">{profile.email || '—'}</div>
        </div>

        <div>
          <div className="text-sm text-gray-400">Phone</div>
          <div className="text-xl font-medium mt-1 text-white">{profile.phone || '—'}</div>
        </div>
      </div>
    </div>
  );
}
