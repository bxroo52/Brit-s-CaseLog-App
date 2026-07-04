'use client';

import { useState, useEffect } from 'react';
import { useAppStore } from '@/stores/useAppStore';

export default function ProfileModal({ isOpen, onClose, onProfileUpdated }: { 
  isOpen: boolean; 
  onClose: () => void; 
  onProfileUpdated?: () => void;
}) {
  const { profile: storeProfile, saveProfile, loadProfile } = useAppStore();
  const [localProfile, setLocalProfile] = useState({ name: '', email: '', phone: '' });
  const [loading, setLoading] = useState(false);

  // Load from Zustand/Dexie (works offline + after saves). Supabase enrichment happens in store loadProfile.
  useEffect(() => {
    if (!isOpen) return;
    const p = storeProfile as any;
    setLocalProfile({
      name: p?.name || '',
      email: p?.email || '',
      phone: p?.phone || '',
    });
  }, [isOpen, storeProfile]);

  const handleSave = async () => {
    setLoading(true);
    try {
      // Always save via store: this writes to Zustand + Dexie, and also upserts Supabase 'profiles' (if configured + authed)
      await saveProfile({
        name: localProfile.name,
        email: localProfile.email,
        phone: localProfile.phone,
      });
      // Re-load to pick up any merge/enrichment from Supabase side (name/email/phone only)
      if (loadProfile) {
        await loadProfile();
      }
    } catch (e) {
      console.error('Failed to save profile:', e);
      // Continue to close; local save should have succeeded via Dexie at minimum
    } finally {
      setLoading(false);
      onClose();
      if (onProfileUpdated) onProfileUpdated();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 flex items-end z-50">
      <div className="bg-zinc-950 w-full rounded-t-3xl p-6 text-white">
        <div className="flex justify-between mb-6">
          <h2 className="text-2xl font-bold">Profile Overview</h2>
          <button onClick={onClose}>✕</button>
        </div>

        <div className="space-y-6">
          <div>
            <label className="block text-sm mb-1">Name</label>
            <input value={localProfile.name} onChange={e => setLocalProfile(p => ({...p, name: e.target.value}))} className="w-full bg-zinc-900 border border-zinc-700 rounded-2xl p-4" />
          </div>
          <div>
            <label className="block text-sm mb-1">Email</label>
            <input value={localProfile.email} onChange={e => setLocalProfile(p => ({...p, email: e.target.value}))} className="w-full bg-zinc-900 border border-zinc-700 rounded-2xl p-4" />
          </div>
          <div>
            <label className="block text-sm mb-1">Phone</label>
            <input value={localProfile.phone} onChange={e => setLocalProfile(p => ({...p, phone: e.target.value}))} className="w-full bg-zinc-900 border border-zinc-700 rounded-2xl p-4" />
          </div>
        </div>

        <button onClick={handleSave} disabled={loading} className="w-full bg-white text-black py-4 rounded-3xl mt-8 text-lg font-medium">
          {loading ? 'Saving...' : 'Save Profile'}
        </button>
        <button onClick={onClose} className="w-full py-4 text-zinc-400 mt-2">Close</button>
      </div>
    </div>
  );
}
