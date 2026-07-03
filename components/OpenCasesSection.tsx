'use client';

import { Case } from '@/types';

interface Props {
  openCases: Case[];
  onNewCase: () => void;
  onManageAll?: () => void;
  onEditCase?: (id: string) => void;
  onLogTime?: (id: string) => void;
  onLogExpense?: (id: string) => void;
}

export default function OpenCasesSection({ openCases, onNewCase, onManageAll, onEditCase, onLogTime, onLogExpense }: Props) {
  return (
    <div className="bg-[#1C1C1E] rounded-3xl p-6">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-xl font-semibold">Open Cases</h3>
        <button
          onClick={onManageAll}
          className="text-[#0A84FF] text-sm"
        >
          Manage all →
        </button>
      </div>

      <input
        type="text"
        placeholder="Search open cases by name or number..."
        className="w-full bg-[#2C2C2E] border border-[#3A3A3C] rounded-2xl px-5 py-3 mb-5 text-sm"
      />

      <div className="space-y-3 mb-6">
        {openCases.length > 0 ? (
          openCases.map((c) => (
            <div 
              key={c.id} 
              onClick={() => onEditCase?.(c.id)}
              className="bg-[#2C2C2E] rounded-2xl p-4 flex justify-between items-center cursor-pointer active:bg-[#3A3A3C]"
            >
              <div>
                <div className="font-medium">{c.respondentLastName}, {c.respondentFirstName}</div>
                <div className="text-sm text-gray-400">{c.caseNumber} • {c.assignmentType}</div>
                <div className="text-xs text-gray-500 mt-1"></div>
              </div>
              <div className="flex flex-col items-end gap-2">
                <div className="bg-green-500/20 text-green-400 text-xs px-3 py-1 rounded-full">Open</div>
                <div className="flex gap-2 text-xs">
                  <button 
                    onClick={(e) => { e.stopPropagation(); onLogTime?.(c.id); }} 
                    className="bg-[#0A84FF]/10 text-[#0A84FF] px-4 py-1 rounded-xl"
                  >
                    + Time
                  </button>
                  <button 
                    onClick={(e) => { e.stopPropagation(); onLogExpense?.(c.id); }} 
                    className="bg-[#0A84FF]/10 text-[#0A84FF] px-4 py-1 rounded-xl"
                  >
                    + Exp
                  </button>
                </div>
              </div>
            </div>
          ))
        ) : (
          <p className="text-center text-gray-500 py-8">No open cases yet...</p>
        )}
      </div>

      {/* Prominent New Case Button */}
      <button
        onClick={onNewCase}
        className="w-full bg-white text-black font-semibold py-4 rounded-2xl flex items-center justify-center gap-2 active:bg-gray-200"
      >
        <span className="text-2xl leading-none">+</span> New Case
      </button>
    </div>
  );
}
