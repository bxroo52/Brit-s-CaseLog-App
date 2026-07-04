'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useAppStore } from '@/stores/useAppStore';
import { toast } from '@/app/components/Toast';

export default function ProfileModal({ isOpen, onClose, onProfileUpdated }: { 
  isOpen: boolean; 
  onClose: () => void; 
  onProfileUpdated?: () => void;
}) {
  const { profile: storeProfile, saveProfile, loadProfile } = useAppStore();
  const [localProfile, setLocalProfile] = useState({ name: '', email: '', phone: '', photoDataUrl: undefined as string | undefined });
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load from Zustand/Dexie (works offline + after saves). Supabase enrichment happens in store loadProfile.
  useEffect(() => {
    if (!isOpen) return;
    const p = storeProfile as any;
    setLocalProfile({
      name: p?.name || '',
      email: p?.email || '',
      phone: p?.phone || '',
      photoDataUrl: p?.photoDataUrl || undefined,
    });
  }, [isOpen, storeProfile]);

  // Resize image to small avatar size (data URL). Keeps file tiny for local storage.
  async function resizeToDataUrl(file: File, maxSize = 160): Promise<string> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const reader = new FileReader();
      reader.onload = (ev) => {
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let { width, height } = img;
          if (width > height) {
            if (width > maxSize) { height = Math.round(height * maxSize / width); width = maxSize; }
          } else {
            if (height > maxSize) { width = Math.round(width * maxSize / height); height = maxSize; }
          }
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) return reject('Canvas error');
          ctx.drawImage(img, 0, 0, width, height);
          // Use jpeg for smaller size, 0.85 quality
          resolve(canvas.toDataURL('image/jpeg', 0.85));
        };
        img.onerror = reject;
        img.src = ev.target?.result as string;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image too large (max 5MB).');
      return;
    }
    try {
      const dataUrl = await resizeToDataUrl(file);
      setLocalProfile(p => ({ ...p, photoDataUrl: dataUrl }));
    } catch (err) {
      toast.error('Could not process image.');
    } finally {
      // allow re-select same file
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const removePhoto = () => {
    setLocalProfile(p => ({ ...p, photoDataUrl: undefined }));
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      // Always save via store: this writes to Zustand + Dexie, and also upserts Supabase 'profiles' (if configured + authed)
      await saveProfile({
        name: localProfile.name,
        email: localProfile.email,
        phone: localProfile.phone,
        photoDataUrl: localProfile.photoDataUrl,
      } as any);
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
          {/* Profile Photo */}
          <div>
            <label className="block text-sm mb-1">Photo</label>
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-full overflow-hidden bg-zinc-800 border border-zinc-700 flex-shrink-0">
                {localProfile.photoDataUrl ? (
                  <img src={localProfile.photoDataUrl} alt="Profile" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-zinc-400 text-xl font-medium">
                    {localProfile.name ? localProfile.name.split(/\s+/).map(w => w[0]).slice(0,2).join('').toUpperCase() : '👤'}
                  </div>
                )}
              </div>
              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-xl text-sm"
                >
                  {localProfile.photoDataUrl ? 'Change photo' : 'Upload photo'}
                </button>
                {localProfile.photoDataUrl && (
                  <button type="button" onClick={removePhoto} className="px-4 py-1 text-xs text-red-400 hover:text-red-300">Remove</button>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handlePhotoChange}
                />
              </div>
            </div>
            <p className="text-[10px] text-zinc-500 mt-1">Small photo stored locally (shown in dashboard &amp; settings).</p>
          </div>

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
