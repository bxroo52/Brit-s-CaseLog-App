'use client';

import { useState } from 'react';
import { Case } from '@/types';

interface CaseSelectorProps {
  selectedCaseId: string;
  onChange: (caseId: string) => void;
  cases: Case[]; // pass your loaded cases here (e.g. open cases)
}

export default function CaseSelector({ selectedCaseId, onChange, cases }: CaseSelectorProps) {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredCases = cases.filter((c) =>
    `${c.respondentLastName} ${c.respondentFirstName}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.caseNumber.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Ensure currently selected case is always available in the options even if filtered out
  const displayCases = (() => {
    const selected = cases.find((c) => c.id === selectedCaseId);
    if (selected && !filteredCases.some((c) => c.id === selectedCaseId)) {
      return [selected, ...filteredCases];
    }
    return filteredCases;
  })();

  const selectedCase = cases.find((c) => c.id === selectedCaseId);

  return (
    <div className="relative">
      <label className="block text-sm font-medium text-gray-400 mb-1.5">Case</label>

      <div className="bg-[#2C2C2E] border border-[#3A3A3C] rounded-xl p-4 relative">
        {/* Display selected case nicely */}
        <div className="flex justify-between items-center">
          <div>
            <div className="font-medium text-white">
              {selectedCase
                ? `${selectedCase.respondentLastName}, ${selectedCase.respondentFirstName}`
                : 'Select Case'}
            </div>
            <div className="text-xs text-gray-500 mt-0.5">{selectedCase?.caseNumber || ''}</div>
          </div>
          <span className="text-[#0A84FF]">▼</span>
        </div>

        {/* Searchable dropdown (native select for reliability + iOS feel) */}
        <select
          value={selectedCaseId}
          onChange={(e) => onChange(e.target.value)}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer bg-transparent text-white"
        >
          <option value="">Select a case...</option>
          {displayCases.map((c) => (
            <option key={c.id} value={c.id}>
              {c.respondentLastName}, {c.respondentFirstName} — {c.caseNumber}
            </option>
          ))}
        </select>
      </div>

      {/* Optional: Inline search for large lists */}
      {cases.length > 5 && (
        <input
          type="text"
          placeholder="Search cases by name or number..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="mt-2 w-full bg-[#2C2C2E] border border-[#3A3A3C] rounded-xl px-4 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#0A84FF]"
        />
      )}
    </div>
  );
}
