'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAppStore } from '@/stores/useAppStore';
import ProfileModal from './ProfileModal';

export default function ProfileOverview() {
  const { loadProfile: loadStoreProfile } = useAppStore();
  const [profile, setProfile] = useState({ name: '', email: '', phone: '' });
  const [showModal, setShowModal] = useState(false);

  const loadProfile = async () => {
    if (!supabase) {
      setProfile({ name: '', email: '', phone: '' });
      return;
    }
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from('profiles')
      .select('name, email, phone')
      .eq('id', user.id)
      .single();

    if (data) {
      setProfile(data);
    } else {
      setProfile({ name: '', email: user.email || '', phone: '' });
    }
    // also refresh store for billing etc.
    loadStoreProfile?.();
  };

  useEffect(() => {
    loadProfile();
  }, []);

  // Realtime profile updates
  useEffect(() => {
    let channel: any;
    (async () => {
      if (!supabase) return;
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      channel = supabase
        .channel('profile_realtime')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'profiles', filter: `id=eq.${user.id}` },
          (payload) => {
            if (payload.new) {
              setProfile(payload.new as any);
              loadStoreProfile?.();
            }
          }
        )
        .subscribe();
    })();

    return () => {
      if (channel) supabase!.removeChannel(channel);
    };
  }, [loadStoreProfile]);

  return (
    <>
      <ProfileModal 
        isOpen={showModal} 
        onClose={() => setShowModal(false)} 
        onProfileUpdated={loadProfile} 
      />
    </>
  );
}
