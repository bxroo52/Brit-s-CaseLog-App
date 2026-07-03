'use client';

export default function Settings() {
  return (
    <div className="min-h-screen bg-zinc-950 text-white p-6">
      <h1 className="text-3xl font-bold mb-8">Settings</h1>
      
      <div className="bg-zinc-900 rounded-2xl p-6 space-y-6">
        <div>
          <h2 className="text-lg font-semibold mb-2">Activity Rates</h2>
          <p className="text-zinc-400">Manage hourly rates for time logging.</p>
        </div>
        
        {/* Add more settings here later */}
      </div>

      <p className="text-center text-zinc-500 mt-12 text-sm">App is permanently in Dark Mode.</p>
    </div>
  );
}
