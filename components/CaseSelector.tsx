'use client';

import { Case } from '@/types';

interface Props {
  selectedCaseId: string;
  onChange: (id: string) => void;
  cases: Case[];
}

export default function CaseSelector({ selectedCaseId, onChange, cases }: Props) {
  const selected = cases.find(c => c.id === selectedCaseId);

  console.log('Available cases:', cases); // ← Check your console for real data

  return (
    <div className="space-y-1">
      <label className="block text-sm font-medium text-gray-400">Case</label>
      
      <div className="relative">
        <select
          value={selectedCaseId}
          onChange={(e) => {
            console.log('Selected case ID:', e.target.value);
            onChange(e.target.value);
          }}
          className="w-full bg-[#2C2C2E] border border-[#3A3A3C] rounded-2xl px-4 py-4 text-white appearance-none opacity-0"
          required
        >
          <option value="">Select Case...</option>
          {cases.map((c) => {
            const displayName = `${c.respondentLastName || 'Unknown'}, ${c.respondentFirstName || ''}`.trim();
            return (
              <option key={c.id} value={c.id}>
                {displayName} — {c.caseNumber}
              </option>
            );
          })}
        </select>
        
        {/* Visual selected display */}
        <div className="absolute inset-0 pointer-events-none flex items-center px-4 rounded-2xl border border-[#3A3A3C]">
          <div className="flex-1">
            <div className="font-medium text-white">
              {selected 
                ? `${selected.respondentLastName}, ${selected.respondentFirstName}`
                : 'No case selected'}
            </div>
            {selected && <div className="text-xs text-gray-500">{selected.caseNumber}</div>}
          </div>
          <div className="text-[#0A84FF]">▼</div>
        </div>
      </div>
    </div>
  );
}
