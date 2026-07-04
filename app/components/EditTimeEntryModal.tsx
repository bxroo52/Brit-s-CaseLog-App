'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { showToast } from './Toast';

export default function EditTimeEntryModal({ entry, onClose }: { entry: any; onClose: () => void }) {
  const [hours, setHours] = useState(entry.hours?.toString() || '');
  const [description, setDescription] = useState(entry.description || '');
  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    if (!supabase) {
      showToast('Supabase not configured', 'error');
      setLoading(false);
      return;
    }
    setLoading(true);
    const { error } = await supabase
      .from('time_entries')
      .update({
        hours: parseFloat(hours),
        description: description.trim(),
      })
      .eq('id', entry.id);

    if (error) {
      showToast('Failed to update', 'error');
    } else {
      showToast('Entry updated');
      onClose();
    }
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-end z-50">
      <div className="bg-zinc-950 w-full rounded-t-3xl p-6 text-white">
        <h2 className="text-2xl font-bold mb-6">Edit Time Entry</h2>

        <div className="space-y-6">
          <div>
            <label className="block text-sm mb-2">Hours</label>
            <input type="number" step="0.25" value={hours} onChange={e => setHours(e.target.value)} className="w-full bg-zinc-900 p-4 rounded-2xl text-4xl text-center" />
          </div>

          <div>
            <label className="block text-sm mb-2">Description</label>
            <textarea value={description} onChange={e => setDescription(e.target.value)} className="w-full bg-zinc-900 p-4 rounded-2xl h-24" />
          </div>
        </div>

        <button onClick={handleSave} disabled={loading} className="w-full bg-white text-black py-4 rounded-3xl mt-8">
          {loading ? 'Saving...' : 'Save Changes'}
        </button>
        <button onClick={onClose} className="w-full py-4 text-zinc-400">Cancel</button>
      </div>
    </div>
  );
}
