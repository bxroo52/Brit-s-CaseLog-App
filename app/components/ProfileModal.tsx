'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export default function ProfileModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [profile, setProfile] = useState({
    name: '',
    email: '',
    phone: '',
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    async function loadProfile() {
      if (!supabase) {
        setProfile({ name: '', email: '', phone: '' });
        return;
      }
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        // Load from your profiles table or auth metadata
        const { data } = await supabase
          .from('profiles')
          .select('name, email, phone')
          .eq('id', user.id)
          .single();

        if (data) {
          setProfile({
            name: data.name || '',
            email: data.email || user.email || '',
            phone: data.phone || '',
          });
        } else {
          // Start blank if no profile yet
          setProfile({
            name: '',
            email: user.email || '',
            phone: '',
          });
        }
      }
    }
    loadProfile();
  }, [isOpen]);

  const handleSave = async () => {
    if (!supabase) {
      setLoading(false);
      onClose();
      return;
    }
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await supabase.from('profiles').upsert({
        id: user.id,
        name: profile.name,
        email: profile.email,
        phone: profile.phone,
      });
    }
    setLoading(false);
    onClose();
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
            <input 
              value={profile.name} 
              onChange={e => setProfile(p => ({ ...p, name: e.target.value }))} 
              placeholder="Enter your full name" 
              className="w-full bg-zinc-900 border border-zinc-700 rounded-2xl p-4" 
            />
          </div>

          <div>
            <label className="block text-sm mb-1">Email</label>
            <input 
              value={profile.email} 
              onChange={e => setProfile(p => ({ ...p, email: e.target.value }))} 
              placeholder="your@email.com" 
              className="w-full bg-zinc-900 border border-zinc-700 rounded-2xl p-4" 
            />
          </div>

          <div>
            <label className="block text-sm mb-1">Phone</label>
            <input 
              value={profile.phone} 
              onChange={e => setProfile(p => ({ ...p, phone: e.target.value }))} 
              placeholder="(907) 555-0123" 
              className="w-full bg-zinc-900 border border-zinc-700 rounded-2xl p-4" 
            />
          </div>
        </div>

        <button 
          onClick={handleSave} 
          disabled={loading}
          className="w-full bg-white text-black py-4 rounded-3xl mt-8 text-lg font-medium disabled:opacity-50"
        >
          {loading ? 'Saving...' : 'Save Profile'}
        </button>

        <button onClick={onClose} className="w-full py-4 text-zinc-400 mt-2">Close</button>
      </div>
    </div>
  );
}
