/**
 * CaseLog - Zustand Store
 * Single source of truth synced with Dexie/IndexedDB.
 * All mutations go through here -> DB + local state.
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { toast } from 'sonner';
import { announce } from '@/lib/utils';
import {
  Case,
  TimeEntry,
  Expense,
  UserProfile,
  CaseFormData,
  TimeEntryFormData,
  ExpenseFormData,
} from '@/types';
import {
  createCase,
  updateCase,
  deleteCase,
  getAllCases,
  createTimeEntry,
  updateTimeEntry,
  deleteTimeEntry,
  getAllTimeEntries,
  getPendingTimeEntriesForMonth,
  markTimeEntriesAsBilled,
  createExpense,
  updateExpense,
  deleteExpense,
  getAllExpenses,
  getUserProfile,
  updateUserProfile,
  buildMonthlyBillingSummary,
  queueChange,
  db,
} from '@/lib/db';
import { getBillingMonth, roundToNearestTenth, calculateAmount } from '@/lib/db';
import { format } from 'date-fns';

interface AppState {
  // Data
  cases: Case[];
  timeEntries: TimeEntry[];
  expenses: Expense[];
  profile: UserProfile | null;

  // UI State
  isLoading: boolean;
  selectedMonth: string; // "2026-06"
  currentCaseId: string | null;
  searchTerm: string;
  statusFilter: 'All' | 'Open' | 'Closed';
  assignmentFilter: string[];
  dateFilterField: 'createdAt' | 'updatedAt';
  dateFilterFrom: string;
  dateFilterTo: string;
  hourlyRateMin: number | '';
  hourlyRateMax: number | '';

  // Billing
  billingSummary: any | null;
  isGenerating: boolean;

  // Sync state (exposed for UI)
  isOnline: boolean;
  isSyncing: boolean;
  pendingChangesCount: number;
  lastSync: string | null;

  // Actions - Cases
  loadAllData: () => Promise<void>;
  addCase: (data: CaseFormData) => Promise<Case>;
  editCase: (id: string, updates: Partial<CaseFormData>) => Promise<void>;
  removeCase: (id: string) => Promise<void>;
  setCurrentCase: (id: string | null) => void;

  // Actions - Time
  addTimeEntry: (data: TimeEntryFormData & { hourlyRate?: number }) => Promise<TimeEntry>;
  editTimeEntry: (id: string, updates: Partial<TimeEntry>) => Promise<void>;
  removeTimeEntry: (id: string) => Promise<void>;
  getTimeForCase: (caseId: string) => TimeEntry[];
  getPendingForMonth: (month: string) => Promise<TimeEntry[]>;

  // Actions - Expenses
  addExpense: (data: ExpenseFormData) => Promise<Expense>;
  editExpense: (id: string, updates: Partial<ExpenseFormData>) => Promise<void>;
  removeExpense: (id: string) => Promise<void>;
  getExpensesForCase: (caseId: string) => Expense[];

  // Profile
  loadProfile: () => Promise<void>;
  saveProfile: (updates: Partial<UserProfile>) => Promise<void>;

  // Billing
  setSelectedMonth: (month: string) => void;
  loadBillingSummary: (month: string) => Promise<void>;
  generateBilling: (month: string) => Promise<void>; // marks billed + prepares summary

  // Filters / UI
  setSearchTerm: (term: string) => void;
  setStatusFilter: (filter: 'All' | 'Open' | 'Closed') => void;
  setAssignmentFilter: (types: string[]) => void;
  setDateFilter: (field: 'createdAt' | 'updatedAt', from: string, to: string) => void;
  setHourlyRateFilter: (min: number | '', max: number | '') => void;
  clearAllFilters: () => void;

  // Demo seed
  seedDemoData: () => Promise<void>;

  // Sync actions
  refreshSyncStatus: () => Promise<void>;
  syncNow: () => Promise<void>;
  clearLocalData: () => Promise<void>;

  // Derived
  getOpenCases: () => Case[];
  getFilteredOpenCases: () => Case[];
  getFilteredCases: () => Case[];
  getCaseById: (id: string) => Case | undefined;
}

const currentMonth = format(new Date(), 'yyyy-MM');

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      cases: [],
      timeEntries: [],
      expenses: [],
      profile: null,

      isLoading: false,
      selectedMonth: currentMonth,
      currentCaseId: null,
      searchTerm: '',
      statusFilter: 'All',
      assignmentFilter: [],
      dateFilterField: 'updatedAt',
      dateFilterFrom: '',
      dateFilterTo: '',
      hourlyRateMin: '',
      hourlyRateMax: '',

      billingSummary: null,
      isGenerating: false,

      isOnline: true,
      isSyncing: false,
      pendingChangesCount: 0,
      lastSync: null,

      // ---- Load ----
      loadAllData: async () => {
        set({ isLoading: true });
        try {
          const [cases, timeEntries, expenses] = await Promise.all([
            getAllCases(),
            getAllTimeEntries(),
            getAllExpenses(),
          ]);
          set({ cases, timeEntries, expenses, isLoading: false });
          get().refreshSyncStatus();
        } catch (e) {
          console.error('Failed to load data', e);
          set({ isLoading: false });
        }
      },

      loadProfile: async () => {
        const profile = await getUserProfile();
        set({ profile });
      },

      // ---- Cases ----
      addCase: async (data: CaseFormData) => {
        // Quick create pattern - direct Dexie + queue
        const now = new Date().toISOString();
        const newCase = {
          id: crypto.randomUUID(),
          ...data,
          createdAt: now,
          updatedAt: now,
          synced: false,
          isDeleted: false,
        } as any;

        await db.cases.add(newCase);
        set((state) => ({ cases: [newCase, ...state.cases] }));
        await queueChange('upsert', 'cases', newCase.id, newCase);
        get().refreshSyncStatus();
        // refresh billing preview with new case
        get().loadBillingSummary(get().selectedMonth).catch(() => {});
        // UI updates instantly from Dexie
        return newCase;
      },

      editCase: async (id, updates) => {
        const updated = await updateCase(id, updates as any);
        set((state) => ({
          cases: state.cases.map((c) => (c.id === id ? updated : c)),
        }));
        queueChange('upsert', 'cases', id, updated);
        get().refreshSyncStatus();
        // refresh billing preview with edited case
        get().loadBillingSummary(get().selectedMonth).catch(() => {});
      },

      removeCase: async (id) => {
        await deleteCase(id);
        set((state) => ({
          cases: state.cases.filter((c) => c.id !== id),
          timeEntries: state.timeEntries.filter((t) => t.caseId !== id),
          expenses: state.expenses.filter((e) => e.caseId !== id),
          currentCaseId: state.currentCaseId === id ? null : state.currentCaseId,
        }));
        queueChange('delete', 'cases', id, { id });
        get().refreshSyncStatus();
        // refresh billing preview after delete
        get().loadBillingSummary(get().selectedMonth).catch(() => {});
      },

      setCurrentCase: (id) => set({ currentCaseId: id }),

      // ---- Time ----
      addTimeEntry: async (data) => {
        // In Quick Log save - direct Dexie + queue pattern
        const rounded = roundToNearestTenth(data.billableHours);
        const billingMonth = getBillingMonth(data.date);

        const caseRecord = await db.cases.get(data.caseId);
        const rate = caseRecord?.hourlyRate ?? (data as any).hourlyRate ?? 0;

        const amount = calculateAmount(rounded, rate);

        const newEntry = {
          id: crypto.randomUUID(),
          ...data,
          billableHoursRounded: rounded,
          hourlyRate: rate,
          amount,
          billingMonth,
          billingStatus: 'Pending' as const,
          updatedAt: new Date().toISOString(),
          synced: false,
          isDeleted: false,
        };

        await db.timeEntries.add(newEntry);
        set((state) => ({ timeEntries: [newEntry, ...state.timeEntries] }));
        await queueChange('upsert', 'timeEntries', newEntry.id, newEntry);
        get().refreshSyncStatus();
        // UI updates instantly from Dexie
        return newEntry;
      },

      editTimeEntry: async (id, updates) => {
        const updated = await updateTimeEntry(id, updates);
        set((state) => ({
          timeEntries: state.timeEntries.map((t) => (t.id === id ? updated : t)),
        }));
        queueChange('upsert', 'timeEntries', id, updated);
        get().refreshSyncStatus();
      },

      removeTimeEntry: async (id) => {
        await deleteTimeEntry(id);
        set((state) => ({
          timeEntries: state.timeEntries.filter((t) => t.id !== id),
        }));
        queueChange('delete', 'timeEntries', id, { id });
        get().refreshSyncStatus();
      },

      getTimeForCase: (caseId) => {
        return get().timeEntries
          .filter((t) => t.caseId === caseId)
          .sort((a, b) => b.date.localeCompare(a.date));
      },

      getPendingForMonth: async (month) => {
        return getPendingTimeEntriesForMonth(month);
      },

      // ---- Expenses ----
      addExpense: async (data) => {
        // In Quick Log save - direct Dexie + queue pattern
        const newExpense = {
          id: crypto.randomUUID(),
          ...data,
          updatedAt: new Date().toISOString(),
          synced: false,
          isDeleted: false,
        };

        await db.expenses.add(newExpense);
        set((state) => ({ expenses: [newExpense, ...state.expenses] }));
        await queueChange('upsert', 'expenses', newExpense.id, newExpense);
        get().refreshSyncStatus();
        // UI updates instantly from Dexie
        return newExpense;
      },

      editExpense: async (id, updates) => {
        const updated = await updateExpense(id, updates);
        set((state) => ({
          expenses: state.expenses.map((e) => (e.id === id ? updated : e)),
        }));
        queueChange('upsert', 'expenses', id, updated);
        get().refreshSyncStatus();
      },

      removeExpense: async (id) => {
        await deleteExpense(id);
        set((state) => ({
          expenses: state.expenses.filter((e) => e.id !== id),
        }));
        queueChange('delete', 'expenses', id, { id });
        get().refreshSyncStatus();
      },

      getExpensesForCase: (caseId) => {
        return get().expenses
          .filter((e) => e.caseId === caseId)
          .sort((a, b) => b.date.localeCompare(a.date));
      },

      // ---- Profile ----
      saveProfile: async (updates) => {
        const updated = await updateUserProfile(updates);
        set({ profile: updated });
      },

      // ---- Billing ----
      setSelectedMonth: (month) => {
        set({ selectedMonth: month });
      },

      loadBillingSummary: async (month) => {
        const summary = await buildMonthlyBillingSummary(month);
        set({ billingSummary: summary });
      },

      generateBilling: async (month) => {
        set({ isGenerating: true });
        try {
          // Build clean data
          const summary = await buildMonthlyBillingSummary(month);

          // Mark pending time entries for the month as Billed
          await markTimeEntriesAsBilled(month);

          // Reload time entries so UI reflects Billed status
          const freshTimes = await getAllTimeEntries();
          set({
            timeEntries: freshTimes,
            billingSummary: summary,
            isGenerating: false,
          });
        } catch (e) {
          console.error('Billing generation failed', e);
          set({ isGenerating: false });
          throw e;
        }
      },

      // ---- Filters ----
      setSearchTerm: (term) => set({ searchTerm: term }),
      setStatusFilter: (filter) => set({ statusFilter: filter }),
      setAssignmentFilter: (types) => set({ assignmentFilter: types }),
      setDateFilter: (field, from, to) => set({ dateFilterField: field, dateFilterFrom: from, dateFilterTo: to }),
      setHourlyRateFilter: (min, max) => set({ hourlyRateMin: min, hourlyRateMax: max }),
      clearAllFilters: () => set({ searchTerm: '', statusFilter: 'All', assignmentFilter: [], dateFilterFrom: '', dateFilterTo: '', hourlyRateMin: '', hourlyRateMax: '' }),

      // ---- Sync actions implementation ----
      refreshSyncStatus: async () => {
        const { getPendingQueueCount, getIsOnline } = await import('@/lib/sync');
        const count = await getPendingQueueCount();
        set({ pendingChangesCount: count, isOnline: getIsOnline() });
      },

      syncNow: async () => {
        const { syncNow: runSync, getPendingQueueCount } = await import('@/lib/sync');
        set({ isSyncing: true });
        try {
          const result = await runSync();
          const count = await getPendingQueueCount();
          set({ isSyncing: false, pendingChangesCount: count, lastSync: new Date().toISOString() });
          await get().loadAllData();
          if (result?.processed > 0 || result?.pulled > 0) {
            const msg = `Synced ${result.processed || 0} • pulled ${result.pulled || 0}`;
            toast.success(msg);
            announce(msg, false);
          }
        } catch (e) {
          set({ isSyncing: false });
          toast.error('Sync failed (local data safe)');
          announce('Sync failed (local data safe)', true);
        }
      },

      clearLocalData: async () => {
        const { clearAllLocalData } = await import('@/lib/sync');
        if (!confirm('Permanently delete ALL local cases, logs and queue?')) return;
        await clearAllLocalData();
        set({ cases: [], timeEntries: [], expenses: [], pendingChangesCount: 0 });
        toast('Local data wiped.');
        announce('Local data wiped.', false);
      },

      seedDemoData: async () => {
        const { cases } = get();
        if (cases.length > 0) return;

        const demoCase = await createCase({
          respondentName: 'Smith, Jordan',
          caseNumber: '3AN-25-00487',
          assignmentType: 'Review',
          status: 'Open',
          hourlyRate: 92,
          firstTimeBilling: true,
          caseNotes: 'Initial contact scheduled next week.',
        });

        const today = new Date().toISOString().slice(0, 10);
        await createTimeEntry({
          caseId: demoCase.id,
          date: today,
          activityType: 'Home Visit',
          billableHours: 1.75,
          description: 'Home visit - discussed compliance and medication schedule.',
          startTime: '09:15',
          endTime: '11:00',
        } as any);

        await createTimeEntry({
          caseId: demoCase.id,
          date: today,
          activityType: 'Report Writing',
          billableHours: 0.8,
          description: 'Drafted review summary.',
        } as any);

        await createExpense({
          caseId: demoCase.id,
          date: today,
          expenseType: 'Mileage',
          description: 'Round trip to residence - 14 miles',
          amount: 9.8,
          updatedAt: new Date().toISOString(),
          synced: false,
          isDeleted: false,
        } as any);

        await get().loadAllData();
      },

      // ---- Derived ----
      getOpenCases: () => get().cases.filter((c) => c.status === 'Open'),

      getFilteredOpenCases: () => {
        const { cases, searchTerm, assignmentFilter, dateFilterField, dateFilterFrom, dateFilterTo, hourlyRateMin, hourlyRateMax } = get();
        let result = cases.filter((c) => c.status === 'Open');

        if (assignmentFilter.length > 0) {
          result = result.filter((c) => assignmentFilter.includes(c.assignmentType));
        }

        if (searchTerm.trim()) {
          const q = searchTerm.toLowerCase().trim();
          result = result.filter(
            (c) =>
              c.respondentName.toLowerCase().includes(q) ||
              c.caseNumber.toLowerCase().includes(q) ||
              (c.caseNotes || '').toLowerCase().includes(q)
          );
        }

        const parseDate = (d: string) => d ? new Date(d + 'T00:00:00') : null;
        const fromDate = parseDate(dateFilterFrom);
        const toDate = parseDate(dateFilterTo);
        if (fromDate || toDate) {
          result = result.filter((c) => {
            const caseDate = new Date( (dateFilterField === 'createdAt' ? c.createdAt : c.updatedAt) );
            if (fromDate && caseDate < fromDate) return false;
            if (toDate && caseDate > toDate) return false;
            return true;
          });
        }

        if (hourlyRateMin !== '' || hourlyRateMax !== '') {
          result = result.filter((c) => {
            const rate = c.hourlyRate;
            if (hourlyRateMin !== '' && rate < hourlyRateMin) return false;
            if (hourlyRateMax !== '' && rate > hourlyRateMax) return false;
            return true;
          });
        }

        return result;
      },

      getFilteredCases: () => {
        const { cases, searchTerm, statusFilter, assignmentFilter, dateFilterField, dateFilterFrom, dateFilterTo, hourlyRateMin, hourlyRateMax } = get();
        let result = [...cases];

        if (statusFilter !== 'All') {
          result = result.filter((c) => c.status === statusFilter);
        }

        if (assignmentFilter.length > 0) {
          result = result.filter((c) => assignmentFilter.includes(c.assignmentType));
        }

        if (searchTerm.trim()) {
          const q = searchTerm.toLowerCase().trim();
          result = result.filter(
            (c) =>
              c.respondentName.toLowerCase().includes(q) ||
              c.caseNumber.toLowerCase().includes(q) ||
              (c.caseNotes || '').toLowerCase().includes(q)
          );
        }

        // Date range filter
        const parseDate = (d: string) => d ? new Date(d + 'T00:00:00') : null;
        const fromDate = parseDate(dateFilterFrom);
        const toDate = parseDate(dateFilterTo);
        if (fromDate || toDate) {
          result = result.filter((c) => {
            const caseDate = new Date( (dateFilterField === 'createdAt' ? c.createdAt : c.updatedAt) );
            if (fromDate && caseDate < fromDate) return false;
            if (toDate && caseDate > toDate) return false;
            return true;
          });
        }

        // Hourly rate range
        if (hourlyRateMin !== '' || hourlyRateMax !== '') {
          result = result.filter((c) => {
            const rate = c.hourlyRate;
            if (hourlyRateMin !== '' && rate < hourlyRateMin) return false;
            if (hourlyRateMax !== '' && rate > hourlyRateMax) return false;
            return true;
          });
        }

        return result.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
      },

      getCaseById: (id) => get().cases.find((c) => c.id === id),
    }),
    {
      name: 'caselog-ui-state',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        // Only persist UI prefs, not full data (data is in Dexie)
        selectedMonth: state.selectedMonth,
        searchTerm: state.searchTerm,
        statusFilter: state.statusFilter,
        assignmentFilter: state.assignmentFilter,
        dateFilterField: state.dateFilterField,
        dateFilterFrom: state.dateFilterFrom,
        dateFilterTo: state.dateFilterTo,
        hourlyRateMin: state.hourlyRateMin,
        hourlyRateMax: state.hourlyRateMax,
      }),
    }
  )
);

// Convenience: load data on first mount from outside (see layout or root)
export async function initializeAppData() {
  const store = useAppStore.getState();
  await Promise.all([store.loadAllData(), store.loadProfile()]);
}
