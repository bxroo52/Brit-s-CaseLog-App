/**
 * CaseLog Dexie + IndexedDB
 * Robust offline-first persistence layer.
 * All data lives here. No server. Works offline forever.
 */

import Dexie, { Table } from 'dexie';
import { Case, TimeEntry, Expense, UserProfile, SyncQueueItem, ActivityRate, RateChangeLog } from '@/types';

export type { SyncQueueItem } from '@/types';
import { format, parseISO } from 'date-fns';
import { DEFAULT_HOURLY_RATE } from '@/lib/constants';

export class CaseLogDB extends Dexie {
  cases!: Table<Case>;
  timeEntries!: Table<TimeEntry>;
  expenses!: Table<Expense>;
  activityRates!: Table<ActivityRate>;
  rateChangeLogs!: Table<RateChangeLog>;
  syncQueue!: Table<SyncQueueItem>;
  profile!: Table<UserProfile>;

  constructor() {
    super('CaseLogDB');
    this.version(1).stores({
      cases: 'id, respondentName, caseNumber, status, updatedAt, isDeleted, synced',
      timeEntries: 'id, caseId, date, activityType, billingMonth, updatedAt, isDeleted, synced',
      expenses: 'id, caseId, date, expenseType, updatedAt, isDeleted, synced',
      syncQueue: '++id, table, recordId, timestamp, retryCount',
      profile: 'id',
    });
    // v2: add userId for per-user data isolation (multi-user on same device / after login)
    this.version(2).stores({
      cases: 'id, userId, respondentName, caseNumber, status, updatedAt, isDeleted, synced',
      timeEntries: 'id, userId, caseId, date, activityType, billingMonth, updatedAt, isDeleted, synced',
      expenses: 'id, userId, caseId, date, expenseType, updatedAt, isDeleted, synced',
      syncQueue: '++id, table, recordId, timestamp, retryCount',
      profile: 'id',
    });
    // v3: add activityRates for per-activity hourly rates per user
    this.version(3).stores({
      cases: 'id, userId, respondentName, caseNumber, status, updatedAt, isDeleted, synced',
      timeEntries: 'id, userId, caseId, date, activityType, billingMonth, updatedAt, isDeleted, synced',
      expenses: 'id, userId, caseId, date, expenseType, updatedAt, isDeleted, synced',
      activityRates: 'id, userId, activityName, updatedAt',
      syncQueue: '++id, table, recordId, timestamp, retryCount',
      profile: 'id',
    });
    // v4: optimize ActivityRates with unique per-user compound index; add rateChangeLogs for audit; optimize TimeEntries with rate/amount fields
    this.version(4).stores({
      cases: 'id, userId, respondentName, caseNumber, status, updatedAt, isDeleted, synced',
      timeEntries: 'id, userId, caseId, date, activityType, activityRate, totalAmount, billingMonth, updatedAt, isDeleted, synced',
      expenses: 'id, userId, caseId, date, expenseType, updatedAt, isDeleted, synced',
      activityRates: 'id, [userId+activityName], userId, activityName, hourlyRate, updatedAt',
      rateChangeLogs: 'id, userId, activityName, changedAt',
      syncQueue: '++id, table, recordId, timestamp, retryCount',
      profile: 'id',
    });
  }
}

export const db = new CaseLogDB();

// ---- Helpers ----

export function getBillingMonth(date: string): string {
  // date is YYYY-MM-DD
  return date.substring(0, 7); // "2026-06"
}

export function roundToNearestTenth(hours: number): number {
  return Math.round(hours * 10) / 10;
}

export function calculateAmount(hoursRounded: number, rate: number): number {
  return Math.round(hoursRounded * rate * 100) / 100;
}

// ---- Case CRUD ----

export async function createCase(
  data: Omit<Case, 'id' | 'createdAt' | 'updatedAt' | 'synced' | 'isDeleted'> & { userId?: string }
): Promise<Case> {
  const now = new Date().toISOString();
  const respondentName = (data as any).respondentName || `${(data as any).respondentLastName || ''}, ${(data as any).respondentFirstName || ''}`.trim().replace(/^, |, $/, '');
  const newCase = {
    ...data,
    respondentName,
    id: crypto.randomUUID(),
    createdAt: now,
    updatedAt: now,
    synced: false,
    isDeleted: false,
  } as Case;
  await db.cases.add(newCase);
  return newCase;
}

export async function updateCase(id: string, updates: Partial<Omit<Case, 'id' | 'createdAt'>>): Promise<Case> {
  const existing = await db.cases.get(id);
  if (!existing) throw new Error('Case not found');

  const updated: Case = {
    ...existing,
    ...updates,
    updatedAt: new Date().toISOString(),
    synced: false,
  };
  await db.cases.put(updated);
  return updated;
}

export async function getCase(id: string): Promise<Case | undefined> {
  return db.cases.get(id);
}

export async function getAllCases(userId?: string): Promise<Case[]> {
  let rows: Case[];
  if (userId) {
    rows = await db.cases.where('userId').equals(userId).toArray();
    rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  } else {
    rows = await db.cases.orderBy('createdAt').reverse().toArray();
  }
  return rows.filter(c => !c.isDeleted);
}

export async function getOpenCases(userId?: string): Promise<Case[]> {
  let rows: Case[];
  if (userId) {
    rows = await db.cases.where('userId').equals(userId).and((c: any) => c.status === 'Open').toArray();
  } else {
    rows = await db.cases.where('status').equals('Open').toArray();
  }
  rows.sort((a, b) => (a.respondentLastName || '').localeCompare(b.respondentLastName || ''));
  return rows.filter(c => !c.isDeleted);
}

export async function deleteCase(id: string): Promise<void> {
  const now = new Date().toISOString();

  await db.cases.where({ id }).modify({ isDeleted: true, updatedAt: now, synced: false });
  await db.timeEntries.where('caseId').equals(id).modify({ isDeleted: true, updatedAt: now, synced: false });
  await db.expenses.where('caseId').equals(id).modify({ isDeleted: true, updatedAt: now, synced: false });
}

// ---- Time Entries ----

export async function createTimeEntry(
  data: Omit<TimeEntry, 'id' | 'billableHoursRounded' | 'amount' | 'billingMonth' | 'billingStatus'> & { userId?: string }
): Promise<TimeEntry> {
  const rounded = roundToNearestTenth(data.billableHours);
  const billingMonth = getBillingMonth(data.date);

  // Prefer passed activityRate or hourlyRate (for new feature), fallback to case or default
  let rate = (data as any).activityRate ?? (data as any).hourlyRate ?? 0;
  if (!rate) {
    const caseRecord = await db.cases.get(data.caseId);
    rate = caseRecord?.hourlyRate ?? DEFAULT_RATE;
  }
  const amount = calculateAmount(rounded, rate);

  const entry: TimeEntry = {
    ...data,
    id: crypto.randomUUID(),
    billableHoursRounded: rounded,
    hourlyRate: rate,
    amount,
    activityRate: (data as any).activityRate ?? rate,
    totalAmount: (data as any).totalAmount ?? amount,
    billingMonth,
    billingStatus: 'Pending',
    isOpenCourt: data.activityType === 'Court' || (data as any).isOpenCourt,
    updatedAt: new Date().toISOString(),
    synced: false,
    isDeleted: false,
  };

  await db.timeEntries.add(entry);
  return entry;
}

export async function updateTimeEntry(id: string, updates: Partial<TimeEntry>): Promise<TimeEntry> {
  const existing = await db.timeEntries.get(id);
  if (!existing) throw new Error('Time entry not found');

  let newData = { ...existing, ...updates };

  // Recompute rounded, amount if hours/date/rate changed. Use activityRate if present.
  if (updates.billableHours !== undefined || updates.date !== undefined || updates.hourlyRate !== undefined || updates.activityRate !== undefined) {
    const rounded = roundToNearestTenth(newData.billableHours);
    const billingMonth = getBillingMonth(newData.date);
    const rate = newData.activityRate ?? newData.hourlyRate ?? DEFAULT_RATE;

    newData.billableHoursRounded = rounded;
    newData.billingMonth = billingMonth;
    newData.hourlyRate = rate;
    newData.amount = calculateAmount(rounded, rate);
    newData.activityRate = rate;
    newData.totalAmount = calculateAmount(rounded, rate);
    newData.isOpenCourt = newData.activityType === 'Court' || newData.isOpenCourt;
  }

  const updated: TimeEntry = {
    ...newData,
    updatedAt: new Date().toISOString(),
    synced: false,
  } as TimeEntry;

  await db.timeEntries.put(updated);
  return updated;
}

export async function getTimeEntriesForCase(caseId: string): Promise<TimeEntry[]> {
  const rows = await db.timeEntries.where('caseId').equals(caseId).sortBy('date');
  return rows.filter(e => !e.isDeleted);
}

export async function getAllTimeEntries(userId?: string): Promise<TimeEntry[]> {
  let rows: TimeEntry[];
  if (userId) {
    rows = await db.timeEntries.where('userId').equals(userId).toArray();
    rows.sort((a, b) => b.date.localeCompare(a.date));
  } else {
    rows = await db.timeEntries.orderBy('date').reverse().toArray();
  }
  return rows.filter(e => !e.isDeleted);
}

export async function getPendingTimeEntriesForMonth(billingMonth: string, userId?: string): Promise<TimeEntry[]> {
  let rows: TimeEntry[];
  if (userId) {
    rows = await db.timeEntries
      .where('userId').equals(userId)
      .and((e: any) => e.billingMonth === billingMonth && e.billingStatus === 'Pending')
      .toArray();
  } else {
    rows = await db.timeEntries
      .where('billingMonth')
      .equals(billingMonth)
      .and((e) => e.billingStatus === 'Pending')
      .toArray();
  }
  return rows.filter(e => !e.isDeleted);
}

export async function getAllTimeForMonth(billingMonth: string, userId?: string): Promise<TimeEntry[]> {
  let rows: TimeEntry[];
  if (userId) {
    rows = await db.timeEntries
      .where('userId').equals(userId)
      .and((e: any) => e.billingMonth === billingMonth)
      .toArray();
  } else {
    rows = await db.timeEntries.where('billingMonth').equals(billingMonth).toArray();
  }
  return rows.filter(e => !e.isDeleted);
}

export async function markTimeEntriesAsBilled(billingMonth: string, userId?: string): Promise<number> {
  const pending = await getPendingTimeEntriesForMonth(billingMonth, userId);
  if (pending.length === 0) return 0;

  const ids = pending.map((e) => e.id);
  await db.timeEntries.where('id').anyOf(ids).modify({ billingStatus: 'Billed' });
  return pending.length;
}

export async function deleteTimeEntry(id: string): Promise<void> {
  const now = new Date().toISOString();
  await db.timeEntries.where({ id }).modify({ isDeleted: true, updatedAt: now, synced: false });
}

// ---- Expenses ----

export async function createExpense(data: Omit<Expense, 'id'> & { userId?: string }): Promise<Expense> {
  const expense: Expense = {
    ...data,
    id: crypto.randomUUID(),
    updatedAt: new Date().toISOString(),
    synced: false,
    isDeleted: false,
  };
  await db.expenses.add(expense);
  return expense;
}

export async function updateExpense(id: string, updates: Partial<Expense>): Promise<Expense> {
  const existing = await db.expenses.get(id);
  if (!existing) throw new Error('Expense not found');
  const updated: Expense = {
    ...existing,
    ...updates,
    updatedAt: new Date().toISOString(),
    synced: false,
  };
  await db.expenses.put(updated);
  return updated;
}

export async function getExpensesForCase(caseId: string): Promise<Expense[]> {
  const rows = await db.expenses.where('caseId').equals(caseId).sortBy('date');
  return rows.filter(e => !e.isDeleted);
}

export async function getAllExpenses(userId?: string): Promise<Expense[]> {
  let rows: Expense[];
  if (userId) {
    rows = await db.expenses.where('userId').equals(userId).toArray();
    rows.sort((a, b) => b.date.localeCompare(a.date));
  } else {
    rows = await db.expenses.orderBy('date').reverse().toArray();
  }
  return rows.filter(e => !e.isDeleted);
}

export async function getExpensesForMonth(billingMonth: string, userId?: string): Promise<Expense[]> {
  let all: Expense[];
  if (userId) {
    all = await db.expenses.where('userId').equals(userId).toArray();
  } else {
    all = await db.expenses.toArray();
  }
  return all.filter((e) => e.date.startsWith(billingMonth) && !e.isDeleted);
}

export async function deleteExpense(id: string): Promise<void> {
  const now = new Date().toISOString();
  await db.expenses.where({ id }).modify({ isDeleted: true, updatedAt: now, synced: false });
}

// ---- Profile (singleton) ----

const DEFAULT_PROFILE_ID = 'profile';

export async function getUserProfile(): Promise<UserProfile> {
  let profile = await db.profile.get(DEFAULT_PROFILE_ID);
  if (!profile) {
    profile = {
      id: DEFAULT_PROFILE_ID,
      name: '',  // user sets via Profile in Settings/Account; do not seed demo name
      title: 'Court Visitor',
      email: '',
      phone: '',
      address: '123 Court Plaza, Suite 204',
      cityStateZip: 'Anchorage, AK 99501',
      courtVisitorId: 'CV-48291',
      organization: 'Alaska Court System',
      invoiceNotes: 'Payment due within 30 days. Please reference the case number on all remittances. This statement is submitted for the Superior Court of the State of Alaska.',
      photoDataUrl: undefined,
      updatedAt: new Date().toISOString(),
    };
    await db.profile.put(profile);
  }
  return profile;
}

export async function updateUserProfile(updates: Partial<Omit<UserProfile, 'id'>>): Promise<UserProfile> {
  const existing = await getUserProfile();
  const updated: UserProfile = {
    ...existing,
    ...updates,
    updatedAt: new Date().toISOString(),
  };
  await db.profile.put(updated);
  return updated;
}

// ---- Activity Rates (per user, per activity) ----

const DEFAULT_RATE = DEFAULT_HOURLY_RATE;

export async function getActivityRates(userId?: string): Promise<ActivityRate[]> {
  let rows: ActivityRate[];
  if (userId) {
    rows = await db.activityRates.where('userId').equals(userId).toArray();
  } else {
    rows = await db.activityRates.toArray();
  }
  return rows;
}

export async function getActivityRate(activityName: string, userId?: string): Promise<number> {
  const rates = await getActivityRates(userId);
  const found = rates.find(r => r.activityName === activityName);
  if (found) return found.hourlyRate;
  // default
  return DEFAULT_RATE;
}

export async function setActivityRate(activityName: string, hourlyRate: number, userId?: string): Promise<ActivityRate> {
  const now = new Date().toISOString();
  // find existing
  const existingRates = await getActivityRates(userId);
  const existing = existingRates.find(r => r.activityName === activityName && (!userId || r.userId === userId || !r.userId));
  let rate: ActivityRate;
  let oldRate = DEFAULT_RATE;
  if (existing) {
    oldRate = existing.hourlyRate;
    rate = {
      ...existing,
      hourlyRate,
      updatedAt: now,
    };
    if (userId) rate.userId = userId;
    await db.activityRates.put(rate);
  } else {
    rate = {
      id: crypto.randomUUID(),
      userId,
      activityName,
      hourlyRate,
      updatedAt: now,
    };
    await db.activityRates.add(rate);
  }
  // Log the change only if rate actually changed
  if (oldRate !== hourlyRate) {
    await logRateChange(userId, activityName, oldRate, hourlyRate);
  }
  return rate;
}

export async function logRateChange(userId: string | undefined, activityName: string, oldRate: number, newRate: number): Promise<RateChangeLog> {
  const now = new Date().toISOString();
  const log: RateChangeLog = {
    id: crypto.randomUUID(),
    userId,
    activityName,
    oldRate,
    newRate,
    changedAt: now,
  };
  await db.rateChangeLogs.add(log);
  return log;
}

export async function getRateChangeLogs(userId?: string, limit = 20): Promise<RateChangeLog[]> {
  let logs: RateChangeLog[];
  if (userId) {
    logs = await db.rateChangeLogs.where('userId').equals(userId).toArray();
  } else {
    logs = await db.rateChangeLogs.toArray();
  }
  logs.sort((a, b) => b.changedAt.localeCompare(a.changedAt));
  return logs.slice(0, limit);
}

export async function initializeDefaultActivityRates(userId?: string) {
  const { ACTIVITY_TYPES } = await import('@/lib/constants');
  const existing = await getActivityRates(userId);
  const existingNames = new Set(existing.map(r => r.activityName));
  for (const name of ACTIVITY_TYPES) {
    if (!existingNames.has(name)) {
      await setActivityRate(name, DEFAULT_RATE, userId);
    }
  }
}

// ---- Aggregates & Billing ----

export async function getMonthlySummary(billingMonth: string): Promise<{
  timeEntries: TimeEntry[];
  expenses: Expense[];
  totalHoursRounded: number;
  totalTimeAmount: number;
  totalExpenses: number;
  grandTotal: number;
}> {
  const timeEntries = await getAllTimeForMonth(billingMonth);
  const expenses = await getExpensesForMonth(billingMonth);

  const totalHoursRounded = timeEntries.reduce((sum, e) => sum + e.billableHoursRounded, 0);
  const totalTimeAmount = timeEntries.reduce((sum, e) => sum + (e.totalAmount ?? e.amount), 0);
  const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);

  return {
    timeEntries,
    expenses,
    totalHoursRounded: Math.round(totalHoursRounded * 10) / 10,
    totalTimeAmount: Math.round(totalTimeAmount * 100) / 100,
    totalExpenses: Math.round(totalExpenses * 100) / 100,
    grandTotal: Math.round((totalTimeAmount + totalExpenses) * 100) / 100,
  };
}

export async function buildMonthlyBillingSummary(billingMonth: string, userId?: string): Promise<any> {
  // Returns structured data for PDF + UI preview. No humor here.
  // Data model enhancements for official templates (see generateInvoice.ts analysis):
  // - Captures per-case: respondentName, caseNumber, assignmentType, firstTimeBilling, appointmentDate, appointingJudge, natureOfCase
  // - Per time entry (via Activity Rates integration): activityType, billableHoursRounded, activityRate, totalAmount, description, isOpenCourt (for court/out totals)
  // - Expenses per caseId only if present.
  // - Chronological sort and respondent grouping done here.
  // - Integrates Activity Rates snapshots so no manual rate editing needed in exports.
  // Alaska rules compliance (ADM-121, AS 13.26, PG assignment forms):
  // - Assignment types, First Time Billing flag, chronological itemized time/expenses by respondent/case.
  // - Derived open/out court time for required totals.
  // - Expenses only per cases that have them.
  // - Activity rates snapshots for per-service Rate/Amount in templates.
  const cases = await getAllCases(userId);
  const timeEntries = await getAllTimeForMonth(billingMonth, userId);
  const expenses = await getExpensesForMonth(billingMonth, userId);

  const caseMap = new Map<string, any>();

  for (const c of cases) {
    caseMap.set(c.id, {
      caseId: c.id,
      caseNumber: c.caseNumber,
      respondentName: `${c.respondentFirstName} ${c.respondentLastName}`,
      assignmentType: c.assignmentType,
      hourlyRate: c.hourlyRate,
      firstTimeBilling: c.firstTimeBilling,
      appointmentDate: c.appointmentDate,
      appointingJudge: c.appointingJudge,
      natureOfCase: c.natureOfCase,
      timeEntries: [],
      expenses: [],
      timeTotal: 0,
      timeAmount: 0,
      expensesTotal: 0,
      grandTotal: 0,
      openCourtTime: 0,
      outOfCourtTime: 0,
    });
  }

  for (const te of timeEntries) {
    const bucket = caseMap.get(te.caseId);
    if (bucket) {
      bucket.timeEntries.push(te);
      bucket.timeTotal += te.billableHoursRounded;
      bucket.timeAmount += te.totalAmount ?? te.amount;
      // Derive court time for official ADM-121 style forms (use 'Court' activity or explicit flag)
      const isCourt = te.isOpenCourt || te.activityType === 'Court';
      if (isCourt) {
        bucket.openCourtTime += te.billableHoursRounded;
      } else {
        bucket.outOfCourtTime += te.billableHoursRounded;
      }
    }
  }

  // Ensure chronological order per regs
  for (const bucket of caseMap.values()) {
    if (bucket.timeEntries) {
      bucket.timeEntries.sort((a: any, b: any) => a.date.localeCompare(b.date));
    }
    if (bucket.expenses) {
      bucket.expenses.sort((a: any, b: any) => a.date.localeCompare(b.date));
    }
  }

  for (const ex of expenses) {
    const bucket = caseMap.get(ex.caseId);
    if (bucket) {
      bucket.expenses.push(ex);
      bucket.expensesTotal += ex.amount;
    }
  }

  const caseSummaries = Array.from(caseMap.values())
    .filter((c) => c.timeEntries.length > 0 || c.expenses.length > 0)
    .map((c) => ({
      ...c,
      timeTotal: Math.round(c.timeTotal * 10) / 10,
      timeAmount: Math.round(c.timeAmount * 100) / 100,
      expensesTotal: Math.round(c.expensesTotal * 100) / 100,
      grandTotal: Math.round((c.timeAmount + c.expensesTotal) * 100) / 100,
      openCourtTime: Math.round(c.openCourtTime * 10) / 10,
      outOfCourtTime: Math.round(c.outOfCourtTime * 10) / 10,
    }))
    .sort((a, b) => (a.respondentLastName || '').localeCompare(b.respondentLastName || ''));

  const overallTimeHours = caseSummaries.reduce((s, c) => s + c.timeTotal, 0);
  const overallTimeAmount = caseSummaries.reduce((s, c) => s + c.timeAmount, 0);
  const overallExpenses = caseSummaries.reduce((s, c) => s + c.expensesTotal, 0);
  const overallOpenCourt = caseSummaries.reduce((s, c) => s + (c.openCourtTime || 0), 0);
  const overallOutOfCourt = caseSummaries.reduce((s, c) => s + (c.outOfCourtTime || 0), 0);

  return {
    billingMonth,
    cases: caseSummaries,
    overallTimeHours: Math.round(overallTimeHours * 10) / 10,
    overallTimeAmount: Math.round(overallTimeAmount * 100) / 100,
    overallExpenses: Math.round(overallExpenses * 100) / 100,
    grandTotal: Math.round((overallTimeAmount + overallExpenses) * 100) / 100,
    pendingCount: timeEntries.filter((t) => t.billingStatus === 'Pending').length,
    overallOpenCourtTime: Math.round(overallOpenCourt * 10) / 10,
    overallOutOfCourtTime: Math.round(overallOutOfCourt * 10) / 10,
  };
}

// ---- Sync Layer Helpers (aligned to new schema) ----

export async function getUnsyncedCases(userId?: string): Promise<Case[]> {
  let all: Case[];
  if (userId) {
    all = await db.cases.where('userId').equals(userId).toArray();
  } else {
    all = await db.cases.toArray();
  }
  return all.filter((c) => c.synced !== true && !c.isDeleted);
}

export async function getUnsyncedTimeEntries(userId?: string): Promise<TimeEntry[]> {
  let all: TimeEntry[];
  if (userId) {
    all = await db.timeEntries.where('userId').equals(userId).toArray();
  } else {
    all = await db.timeEntries.toArray();
  }
  return all.filter((e) => e.synced !== true && !e.isDeleted);
}

export async function getUnsyncedExpenses(userId?: string): Promise<Expense[]> {
  let all: Expense[];
  if (userId) {
    all = await db.expenses.where('userId').equals(userId).toArray();
  } else {
    all = await db.expenses.toArray();
  }
  return all.filter((e) => e.synced !== true && !e.isDeleted);
}

export async function markRecordSynced(table: 'cases' | 'timeEntries' | 'expenses', id: string) {
  if (table === 'cases') await db.cases.update(id, { synced: true });
  else if (table === 'timeEntries') await db.timeEntries.update(id, { synced: true });
  else if (table === 'expenses') await db.expenses.update(id, { synced: true });
}

export async function queueChange(
  operation: 'upsert' | 'delete',
  table: 'cases' | 'timeEntries' | 'expenses',
  recordId: string,
  payload: any
) {
  const item: SyncQueueItem = {
    operation,
    table,
    recordId,
    payload,
    timestamp: new Date().toISOString(),
    retryCount: 0,
  };
  await db.syncQueue.add(item);
}

export async function getAllUnsyncedForPush(userId?: string) {
  const [cases, timeEntries, expenses] = await Promise.all([
    getUnsyncedCases(userId),
    getUnsyncedTimeEntries(userId),
    getUnsyncedExpenses(userId),
  ]);
  return { cases, timeEntries, expenses };
}

export async function pruneSyncedDeleted(olderThanDays = 730) {
  const cutoff = new Date(Date.now() - olderThanDays * 86400000).toISOString();

  const prune = async (table: any) => {
    const all = await table.toArray();
    const toDelete = all.filter((r: any) =>
      r.isDeleted && r.synced === true && r.updatedAt < cutoff
    );
    if (toDelete.length > 0) {
      await table.bulkDelete(toDelete.map((r: any) => r.id));
    }
  };

  await Promise.all([prune(db.cases), prune(db.timeEntries), prune(db.expenses)]);
}

