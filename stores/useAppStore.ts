/**
 * CaseLog - Zustand Store
 * Single source of truth synced with Dexie/IndexedDB.
 * All mutations go through here -> DB + local state.
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { toast } from '@/app/components/Toast';
import { announce } from '@/lib/utils';
import {
  Case,
  TimeEntry,
  Expense,
  UserProfile,
  CaseFormData,
  TimeEntryFormData,
  ExpenseFormData,
  ActivityRate,
  RateChangeLog,
  CaseStatus,
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
  createExpense,
  updateExpense,
  deleteExpense,
  getAllExpenses,
  getUserProfile,
  updateUserProfile,
  getActivityRates,
  setActivityRate,
  logRateChange,
  getRateChangeLogs,
  buildMonthlyBillingSummary,
  queueChange,
  db,
} from '@/lib/db';
import { getBillingMonth, roundToNearestTenth, calculateAmount } from '@/lib/db';
import { DEFAULT_HOURLY_RATE } from '@/lib/constants';
import { format } from 'date-fns';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';

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
  statusFilter: 'All' | CaseStatus;
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

  // Auth
  user: any | null;
  isAuthenticated: boolean;

  // UI Prefs (persisted)
  notificationsEnabled: boolean;

  // Active running timer (persisted to survive refresh/background)
  activeTimer: {
    isRunning: boolean;
    startTimestamp: number | null; // unix ms
    elapsedAtStop: number | null; // seconds when stopped (for recovery/display)
    caseId: string | null;
    activityType: string | null;
  };

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

  // Timer actions (for Log Time stopwatch)
  startTimer: (caseId: string, activityType: string) => void;
  stopTimer: () => number; // returns elapsed seconds
  resetTimer: () => void;
  getElapsedSeconds: () => number;
  getBilledHours: () => number; // rounded up to 0.1
  getActiveTimer: () => AppState['activeTimer'];
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

  // Activity Rates
  activityRates: ActivityRate[];
  rateChangeLogs: RateChangeLog[];
  loadActivityRates: () => Promise<void>;
  saveActivityRate: (activityName: string, hourlyRate: number) => Promise<void>;
  getActivityRate: (activityName: string) => number;
  loadRateChangeLogs: () => Promise<void>;

  // Billing
  setSelectedMonth: (month: string) => void;
  loadBillingSummary: (month: string) => Promise<void>;
  generateBilling: (month: string) => Promise<void>; // prepares summary (no marking)

  // Filters / UI
  setSearchTerm: (term: string) => void;
  setStatusFilter: (filter: 'All' | CaseStatus) => void;
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

  // Debug: explore/clear IndexedDB
  debugInspectDB: () => Promise<any>;
  debugClearDB: () => Promise<void>;

  // Auth
  initAuth: () => Promise<void>;
  signUp: (email: string, password: string, userId?: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  setUser: (user: any | null) => void;

  // UI Prefs actions
  setNotificationsEnabled: (enabled: boolean) => void;
  claimLegacyDataForCurrentUser: () => Promise<void>;

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

      // Activity Rates
      activityRates: [],
      rateChangeLogs: [],

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

      user: null,
      isAuthenticated: false,

      // UI Prefs
      notificationsEnabled: false,

      // Timer
      activeTimer: {
        isRunning: false,
        startTimestamp: null,
        elapsedAtStop: null,
        caseId: null,
        activityType: null,
      },

      // ---- Load ----
      loadAllData: async () => {
        set({ isLoading: true });
        try {
          const currentUserId = get().user?.id;
          const [casesRaw, timeEntriesRaw, expenses] = await Promise.all([
            getAllCases(currentUserId),
            getAllTimeEntries(currentUserId),
            getAllExpenses(currentUserId),
          ]);
          const cases = casesRaw.map((c: any) => ({
            ...c,
            respondentName: c.respondentName || `${c.respondentFirstName || ''} ${c.respondentLastName || ''}`.trim(),
          })) as any;
          // Backfill new fields for legacy entries (preserve historical)
          const timeEntries = timeEntriesRaw.map((t: any) => ({
            ...t,
            activityRate: t.activityRate ?? t.hourlyRate ?? DEFAULT_HOURLY_RATE,
            totalAmount: t.totalAmount ?? t.amount ?? 0,
          })) as any;
          set({ cases, timeEntries, expenses, isLoading: false });
          // also load rates (non-blocking if fails)
          get().loadActivityRates().catch(() => {});
          get().refreshSyncStatus();
        } catch (e) {
          console.error('Failed to load data', e);
          set({ isLoading: false });
        }
      },

      loadProfile: async () => {
        const currentUserId = get().user?.id;
        let profile = await getUserProfile(currentUserId);

        // Try to enrich/merge with Supabase profiles table if available
        if (supabase && currentUserId) {
          try {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
              const { data: supabaseProfile } = await supabase
                .from('profiles')
                .select('name, email, phone')
                .eq('id', user.id)
                .single();
              if (supabaseProfile) {
                profile = {
                  ...profile,
                  name: supabaseProfile.name || profile.name,
                  email: supabaseProfile.email || profile.email,
                  phone: supabaseProfile.phone || profile.phone,
                };
              }
            }
          } catch (e) {
            // ignore, use local
          }
        }

        set({ profile });
      },

      // ---- Activity Rates ----
      loadActivityRates: async () => {
        const currentUserId = get().user?.id;
        let rates = await getActivityRates(currentUserId);
        // Do not auto-seed defaults (50/25 or 0) here.
        // Rates should only exist if the user has explicitly set them.
        // getActivityRate will fallback to DEFAULT_HOURLY_RATE (0) if none set.
        set({ activityRates: rates });
        // also refresh logs
        const logs = await getRateChangeLogs(currentUserId);
        set({ rateChangeLogs: logs });
      },

      saveActivityRate: async (activityName, hourlyRate) => {
        const currentUserId = get().user?.id;
        await setActivityRate(activityName, hourlyRate, currentUserId);
        // reload rates + logs (DB logs the change)
        const rates = await getActivityRates(currentUserId);
        const logs = await getRateChangeLogs(currentUserId);
        set({ activityRates: rates, rateChangeLogs: logs });
      },

      getActivityRate: (activityName) => {
        const rates = get().activityRates;
        const found = rates.find(r => r.activityName === activityName);
        return found ? found.hourlyRate : DEFAULT_HOURLY_RATE;
      },

      loadRateChangeLogs: async () => {
        const currentUserId = get().user?.id;
        const logs = await getRateChangeLogs(currentUserId);
        set({ rateChangeLogs: logs });
      },

      // ---- Cases ----
      addCase: async (data: CaseFormData) => {
        // Quick create pattern - optimistic UI first
        const now = new Date().toISOString();
        const currentUserId = get().user?.id;
        const respondentName = `${data.respondentLastName || ''}, ${data.respondentFirstName || ''}`.trim().replace(/^, |, $/, '');
        const newCase = {
          id: crypto.randomUUID(),
          userId: currentUserId,
          ...data,
          respondentName,
          createdAt: now,
          updatedAt: now,
          synced: false,
          isDeleted: false,
        } as any;

        // Optimistic: update UI immediately
        set((state) => ({ cases: [newCase, ...state.cases] }));

        try {
          await db.cases.add(newCase);
          await queueChange('upsert', 'cases', newCase.id, newCase);
          get().refreshSyncStatus();
          // refresh billing preview with new case
          get().loadBillingSummary(get().selectedMonth).catch(() => {});

          toast.success('Case created.');
          return newCase;
        } catch (e: any) {
          // Rollback optimistic add
          set((state) => ({
            cases: state.cases.filter((c: any) => c.id !== newCase.id),
          }));
          const msg = e?.message || 'Failed to create case. Please try again.';
          toast.error(msg);
          throw e;
        }
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
        // Validate required fields
        if (!data.caseId) {
          const err = new Error('Case is required');
          console.error('addTimeEntry validation failed:', err);
          toast.error(err.message);
          throw err;
        }
        if (!data.activityType) {
          const err = new Error('Activity is required');
          console.error('addTimeEntry validation failed:', err);
          toast.error(err.message);
          throw err;
        }
        if (typeof data.billableHours !== 'number' || data.billableHours <= 0) {
          const err = new Error('Billable Hours must be > 0');
          console.error('addTimeEntry validation failed:', err);
          toast.error(err.message);
          throw err;
        }
        if (!data.description || !data.description.trim()) {
          const err = new Error('Description is required');
          console.error('addTimeEntry validation failed:', err);
          toast.error(err.message);
          throw err;
        }
        if (!data.date) {
          const err = new Error('Date is required');
          console.error('addTimeEntry validation failed:', err);
          toast.error(err.message);
          throw err;
        }

        // In Quick Log save - direct Dexie + queue pattern
        const rounded = roundToNearestTenth(data.billableHours);
        const billingMonth = getBillingMonth(data.date);

        // Use activity rate (never case rate for time logging now)
        const rate = get().getActivityRate(data.activityType);
        const providedAmount = (data as any).amount ?? (data as any).totalAmount;
        const amount = providedAmount !== undefined ? providedAmount : calculateAmount(rounded, rate);
        const currentUserId = get().user?.id;

        const newEntry = {
          id: crypto.randomUUID(),
          userId: currentUserId,
          ...data,
          billableHoursRounded: rounded,
          hourlyRate: rate,           // compat
          amount,                     // compat
          activityRate: rate,
          totalAmount: amount,
          billingMonth,
          billingStatus: 'Pending' as const,
          isOpenCourt: data.isOpenCourt ?? (data.activityType === 'Court'),
          updatedAt: new Date().toISOString(),
          synced: false,
          isDeleted: false,
        };

        // Optimistic: update UI immediately
        set((state) => ({ timeEntries: [newEntry, ...state.timeEntries] }));

        try {
          await db.timeEntries.add(newEntry);
          await queueChange('upsert', 'timeEntries', newEntry.id, newEntry);
          get().refreshSyncStatus();
          toast.success('Time entry saved.');
          return newEntry;
        } catch (e: any) {
          console.error('addTimeEntry failed (Dexie/queue):', e);
          // Rollback
          set((state) => ({
            timeEntries: state.timeEntries.filter((t: any) => t.id !== newEntry.id),
          }));
          const msg = e?.message || (typeof e === 'string' ? e : 'Failed to save time entry. Please try again.');
          toast.error(msg);
          throw e;
        }
      },

      editTimeEntry: async (id, updates) => {
        const existing = get().timeEntries.find(t => t.id === id);
        let finalUpdates = { ...updates };
        if (updates.activityType || updates.billableHours !== undefined) {
          const newAct = updates.activityType || existing?.activityType;
          const hours = updates.billableHours !== undefined ? updates.billableHours : existing?.billableHours;
          if (newAct && hours !== undefined) {
            // Preserve historical rate if activity not changed; only use current setting if activity is new/changed
            const isActivityChanging = !!updates.activityType && updates.activityType !== existing?.activityType;
            const rate = isActivityChanging ? get().getActivityRate(newAct) : (existing?.activityRate ?? existing?.hourlyRate ?? get().getActivityRate(newAct));
            const rounded = roundToNearestTenth(hours);
            const computedAmount = calculateAmount(rounded, rate);
            const providedAmount = updates.amount !== undefined ? updates.amount : (updates.totalAmount !== undefined ? updates.totalAmount : undefined);
            finalUpdates = {
              ...finalUpdates,
              activityType: newAct,
              billableHours: hours,
              billableHoursRounded: rounded,
              hourlyRate: rate,
              amount: providedAmount !== undefined ? providedAmount : computedAmount,
              activityRate: rate,
              totalAmount: providedAmount !== undefined ? providedAmount : computedAmount,
              isOpenCourt: (updates as any).isOpenCourt ?? (newAct === 'Court'),
            } as any;
          }
        } else if (updates.amount !== undefined || updates.totalAmount !== undefined) {
          // Allow amount override even if hours/activity not changed
          if (updates.amount !== undefined) finalUpdates.amount = updates.amount;
          if (updates.totalAmount !== undefined) finalUpdates.totalAmount = updates.totalAmount;
        }
        const updated = await updateTimeEntry(id, finalUpdates);
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
        const currentUserId = get().user?.id;
        return getPendingTimeEntriesForMonth(month, currentUserId);
      },

      // ---- Timer (Log Time stopwatch, one at a time, persisted) ----
      startTimer: (caseId, activityType) => {
        const now = Date.now();
        set((state) => ({
          activeTimer: {
            isRunning: true,
            startTimestamp: now,
            elapsedAtStop: null,
            caseId,
            activityType,
          },
        }));
      },

      stopTimer: () => {
        const timer = get().activeTimer;
        let elapsedSec = 0;
        if (timer.isRunning && timer.startTimestamp) {
          elapsedSec = Math.floor((Date.now() - timer.startTimestamp) / 1000);
        }
        set((state) => ({
          activeTimer: {
            ...state.activeTimer,
            isRunning: false,
            elapsedAtStop: elapsedSec,
          },
        }));
        return elapsedSec;
      },

      resetTimer: () => {
        set((state) => ({
          activeTimer: {
            isRunning: false,
            startTimestamp: null,
            elapsedAtStop: null,
            caseId: null,
            activityType: null,
          },
        }));
      },

      getElapsedSeconds: () => {
        const timer = get().activeTimer;
        if (timer.isRunning && timer.startTimestamp) {
          return Math.floor((Date.now() - timer.startTimestamp) / 1000);
        }
        return timer.elapsedAtStop || 0;
      },

      getBilledHours: () => {
        const elapsedSec = get().getElapsedSeconds();
        const hours = elapsedSec / 3600;
        // Always round UP to nearest 0.1h as specified: Math.ceil(hours * 10) / 10
        // For partial time in 6-minute brackets.
        // Examples: 0s->0.0, 120s(2m)->0.0, 180s(3m)->0.1, 360s(6m)->0.1, 3720s(1h2m)->1.0, 3780s(1h3m)->1.1, 3840s(1h4m)->1.1
        return Math.ceil(hours * 10) / 10;
      },

      getActiveTimer: () => get().activeTimer,

      // ---- Expenses ----
      addExpense: async (data) => {
        // Optimistic UI first for instant feedback
        const currentUserId = get().user?.id;
        const newExpense = {
          id: crypto.randomUUID(),
          userId: currentUserId,
          ...data,
          updatedAt: new Date().toISOString(),
          synced: false,
          isDeleted: false,
        };

        // Optimistic update
        set((state) => ({ expenses: [newExpense, ...state.expenses] }));

        try {
          await db.expenses.add(newExpense);
          await queueChange('upsert', 'expenses', newExpense.id, newExpense);
          get().refreshSyncStatus();
          toast.success('Expense saved.');
          return newExpense;
        } catch (e: any) {
          // Rollback
          set((state) => ({
            expenses: state.expenses.filter((e: any) => e.id !== newExpense.id),
          }));
          const msg = e?.message || 'Failed to save expense. Please try again.';
          toast.error(msg);
          throw e;
        }
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
        const currentUserId = get().user?.id;
        const prevProfile = get().profile;
        // Optimistic update immediately
        const optimistic = {
          ...(prevProfile || { id: currentUserId || 'profile', updatedAt: new Date().toISOString() }),
          ...updates,
          updatedAt: new Date().toISOString(),
        } as UserProfile;
        set({ profile: optimistic });

        try {
          const updated = await updateUserProfile(updates, currentUserId);
          set({ profile: updated });

          // Also sync basic fields (no photo) to Supabase profiles table if available
          if (supabase) {
            try {
              const { data: { user } } = await supabase.auth.getUser();
              if (user) {
                await supabase.from('profiles').upsert({
                  id: user.id,
                  name: updated.name || updates.name || '',
                  email: updated.email || updates.email || '',
                  phone: updated.phone || updates.phone || '',
                });
              }
            } catch (e) {
              // ignore sync error, local is primary
            }
          }

          toast.success('Profile saved.');
        } catch (e: any) {
          // Rollback
          set({ profile: prevProfile });
          const msg = e?.message || 'Failed to save profile. Please try again.';
          toast.error(msg);
          throw e;
        }
      },

      // ---- Billing ----
      setSelectedMonth: (month) => {
        set({ selectedMonth: month });
      },

      loadBillingSummary: async (month) => {
        const currentUserId = get().user?.id;
        const summary = await buildMonthlyBillingSummary(month, currentUserId);
        set({ billingSummary: summary });
      },

      generateBilling: async (month) => {
        set({ isGenerating: true });
        try {
          const currentUserId = get().user?.id;
          // Build summary ONLY (no auto-marking as Billed)
          const summary = await buildMonthlyBillingSummary(month, currentUserId);
          set({
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

      // ---- Auth actions (Supabase) ----
      setUser: (user) => set({ user, isAuthenticated: !!user }),

      setNotificationsEnabled: (enabled) => set({ notificationsEnabled: enabled }),

      // Claim any legacy (pre-userId) data for the current logged-in user for isolation
      claimLegacyDataForCurrentUser: async () => {
        const uid = get().user?.id;
        if (!uid) return;
        const now = new Date().toISOString();
        await db.cases.filter((c: any) => !c.userId).modify({ userId: uid, updatedAt: now, synced: false });
        await db.timeEntries.filter((e: any) => !e.userId).modify({ userId: uid, updatedAt: now, synced: false });
        await db.expenses.filter((e: any) => !e.userId).modify({ userId: uid, updatedAt: now, synced: false });

        // Migrate legacy profile (id='profile') to this user's profile id for persistence across logins
        const legacyProfile = await db.profile.get('profile');
        if (legacyProfile) {
          const userProfile = await db.profile.get(uid);
          if (!userProfile || !userProfile.name) {
            await db.profile.put({ ...legacyProfile, id: uid });
            // keep legacy or delete; keep for safety
          }
        }
      },

      signUp: async (email, password, userId) => {
        if (!isSupabaseConfigured || !supabase) {
          toast.error('Supabase not configured. Auth requires Supabase.');
          return;
        }
        try {
          const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: {
              data: { userId: userId || '' },
            },
          });
          if (error) throw error;

          // Sign-up is configured to be instant (no email confirmation required).
          // Supabase will return a session immediately when email confirmations are disabled.
          const user = data.session?.user || data.user;
          if (user) {
            set({ user, isAuthenticated: true });
            if (userId) {
              await get().saveProfile({ name: userId });
            }
            await get().claimLegacyDataForCurrentUser();
            // Load user's (newly created) data
            await get().loadAllData();
            await get().loadProfile();
            toast.success('Account created and logged in!');
          }
        } catch (e: any) {
          let msg = e.message || 'Sign up failed.';
          const lower = msg.toLowerCase();
          if (lower.includes('rate limit') || lower.includes('too many') || lower.includes('email rate')) {
            msg = 'Too many attempts. Please wait a moment and try again.';
          }
          throw new Error(msg);
        }
      },

      signIn: async (email, password) => {
        if (!isSupabaseConfigured || !supabase) {
          toast.error('Supabase not configured. Auth requires Supabase.');
          return;
        }
        try {
          const { data, error } = await supabase.auth.signInWithPassword({ email, password });
          if (error) throw error;
          if (data.user) {
            set({ user: data.user, isAuthenticated: true });
            await get().claimLegacyDataForCurrentUser();
            // Load only this user's data (cases, entries, expenses)
            await get().loadAllData();
            await get().loadProfile();
            toast.success('Logged in successfully.');
          }
        } catch (e: any) {
          toast.error(e.message || 'Login failed.');
          throw e;
        }
      },

      signOut: async () => {
        if (supabase) {
          await supabase.auth.signOut();
        }
        set({ user: null, isAuthenticated: false, cases: [], timeEntries: [], expenses: [], activityRates: [], rateChangeLogs: [], profile: null });
        toast('Signed out.');
      },

      resetPassword: async (email) => {
        if (!isSupabaseConfigured || !supabase) {
          toast.error('Supabase not configured.');
          return;
        }
        try {
          const { error } = await supabase.auth.resetPasswordForEmail(email, {
            redirectTo: `${window.location.origin}/`, // or a reset page
          });
          if (error) throw error;
          toast.success('Check your email for reset link.');
        } catch (e: any) {
          toast.error(e.message || 'Failed to send reset email.');
          throw e;
        }
      },

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
        set({ cases: [], timeEntries: [], expenses: [], activityRates: [], rateChangeLogs: [], pendingChangesCount: 0 });
        toast('Local data wiped.');
        announce('Local data wiped.', false);
      },

      debugInspectDB: async () => {
        const tables: Record<string, number> = {};
        for (const table of db.tables) {
          try {
            tables[table.name] = await table.count();
          } catch (e) {
            tables[table.name] = -1;
          }
        }
        console.log('[CaseLog Debug] IndexedDB tables:', tables);
        const summary = Object.entries(tables).map(([k, v]) => `${k}: ${v}`).join(' | ');
        toast(`IndexedDB: ${summary} (see console for details)`);
        // Also log sample for profile
        try {
          const prof = await db.profile.toArray();
          console.log('[CaseLog Debug] Profile records:', prof);
        } catch {}
        return tables;
      },

      debugClearDB: async () => {
        if (!confirm('DANGER: This will DELETE the entire IndexedDB (all tables including profile). App will reload. Continue?')) return;
        try {
          await db.delete();
          toast('IndexedDB cleared. Reloading...');
          setTimeout(() => window.location.reload(), 500);
        } catch (e) {
          toast.error('Failed to clear DB: ' + e);
        }
      },

      initAuth: async () => {
        if (!isSupabaseConfigured || !supabase) {
          // For offline-only, allow demo mode or require config? For now, require Supabase for auth.
          // If no Supabase, perhaps stay unauth and force login error.
          set({ user: null, isAuthenticated: false });
          return;
        }
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          set({ user: session.user, isAuthenticated: true });
          await get().claimLegacyDataForCurrentUser();
          // Ensure we load only this user's data (in case initial loadAll ran pre-auth)
          await get().loadAllData();
          await get().loadProfile();
        }
        // Listen for auth changes (e.g. login via listener, or token refresh)
        supabase.auth.onAuthStateChange((_event, session) => {
          if (session?.user) {
            set({ user: session.user, isAuthenticated: true });
            get().claimLegacyDataForCurrentUser().then(() => {
              get().loadAllData().catch(() => {});
              get().loadProfile().catch(() => {});
            }).catch(() => {});
          } else {
            set({ user: null, isAuthenticated: false });
            // Clear in-memory on signout via listener
            set({ cases: [], timeEntries: [], expenses: [], profile: null });
          }
        });
      },

      seedDemoData: async () => {
        const { cases } = get();
        if (cases.length > 0) return;

        const currentUserId = get().user?.id;
        const demoCase = await createCase({
          userId: currentUserId,
          respondentFirstName: 'Smith',
          respondentLastName: 'Jordan',
          caseNumber: '3AN-25-00487',
          assignmentType: 'Review',
          status: 'Open',
          hourlyRate: 0,
          firstTimeBilling: true,
          caseNotes: 'Initial contact scheduled next week.',
        });

        const today = new Date().toISOString().slice(0, 10);
        await createTimeEntry({
          userId: currentUserId,
          caseId: demoCase.id,
          date: today,
          activityType: 'Home Visit',
          billableHours: 1.75,
          description: 'Home visit - discussed compliance and medication schedule.',
          startTime: '09:15',
          endTime: '11:00',
        } as any);

        await createTimeEntry({
          userId: currentUserId,
          caseId: demoCase.id,
          date: today,
          activityType: 'Report Writing',
          billableHours: 0.8,
          description: 'Drafted review summary.',
        } as any);

        await createExpense({
          userId: currentUserId,
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
              (c.respondentFirstName + ' ' + c.respondentLastName).toLowerCase().includes(q) ||
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
            const rate = c.hourlyRate ?? 0;
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
              (c.respondentFirstName + ' ' + c.respondentLastName).toLowerCase().includes(q) ||
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
            const rate = c.hourlyRate ?? 0;
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
        notificationsEnabled: state.notificationsEnabled,
        activeTimer: state.activeTimer,
      }),
    }
  )
);

// Convenience: load data on first mount from outside (see layout or root)
export async function initializeAppData() {
  const store = useAppStore.getState();
  await Promise.all([store.loadAllData(), store.loadProfile(), store.initAuth()]);
}
