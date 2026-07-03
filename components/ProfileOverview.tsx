'use client';

import { useAppStore } from '@/stores/useAppStore';

export default function ProfileOverview({ onEdit }: { onEdit: () => void }) {
  const { profile } = useAppStore();
  const user = {
    name: profile?.name || '',
    email: profile?.email || '',
    phone: profile?.phone || '',
  };

  return (
    <div className="bg-[#1C1C1E] rounded-3xl p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-semibold">Profile Overview</h2>
        <button onClick={onEdit} className="text-[#0A84FF]">Edit</button>
      </div>

      <div className="space-y-6">
        <div>
          <div className="text-sm text-gray-400">Name</div>
          <div className="text-xl font-medium mt-1">{user.name || '—'}</div>
        </div>
        <div>
          <div className="text-sm text-gray-400">Email</div>
          <div className="text-xl font-medium mt-1">{user.email || '—'}</div>
        </div>
        <div>
          <div className="text-sm text-gray-400">Phone</div>
          <div className="text-xl font-medium mt-1">{user.phone || '—'}</div>
        </div>
      </div>

      {/* Rates summary if needed */}
    </div>
  );
}
