'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

export default function DashboardStatsRealtime() {
  const [stats, setStats] = useState({
    openCases: 0,
    thisMonthHours: 0,
    thisMonthAmount: 0,
  });

  const calculateStats = async () => {
    if (!supabase) return;

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

    const [{ count: openCases }, { data: timeEntries }] = await Promise.all([
      supabase.from('cases').select('*', { count: 'exact', head: true }).eq('status', 'Open'),
      supabase.from('time_entries').select('hours, rate').gte('date', startOfMonth),
    ]);

    const thisMonthHours = timeEntries?.reduce((sum, e) => sum + (e.hours || 0), 0) || 0;
    const thisMonthAmount = timeEntries?.reduce((sum, e) => sum + ((e.hours || 0) * (e.rate || 50)), 0) || 0;

    setStats({ openCases: openCases || 0, thisMonthHours, thisMonthAmount });
  };

  useEffect(() => {
    calculateStats();

    if (!supabase) return;

    // Subscribe to changes that affect stats
    const channel = supabase
      .channel('dashboard_stats')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cases' }, calculateStats)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'time_entries' }, calculateStats)
      .subscribe();

    return () => { supabase!.removeChannel(channel); };
  }, []);

  return (
    <div className="grid grid-cols-2 gap-4">
      <div className="bg-zinc-900 rounded-2xl p-6">
        <div className="text-sm text-zinc-400">Open Cases</div>
        <div className="text-4xl font-bold mt-2">{stats.openCases}</div>
      </div>
      <div className="bg-zinc-900 rounded-2xl p-6">
        <div className="text-sm text-zinc-400">This Month Logged</div>
        <div className="text-4xl font-bold mt-2">${stats.thisMonthAmount.toFixed(2)}</div>
        <div className="text-sm text-zinc-400">{stats.thisMonthHours} hours</div>
      </div>
    </div>
  );
}
