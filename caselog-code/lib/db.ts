/**
 * CaseLog Dexie + IndexedDB
 * Robust offline-first persistence layer.
 * All data lives here. No server. Works offline forever.
 */

import Dexie, { Table } from 'dexie';
import { Case, TimeEntry, Expense, UserProfile, SyncQueueItem } from '@/types';

export type { SyncQueueItem } from '@/types';
import { format, parseISO } from 'date-fns';

export class CaseLogDB extends Dexie {
  cases!: Table<Case>;
  timeEntries!: Table<TimeEntry>;
  expenses!: Table<Expense>;
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
  data: Omit<Case, 'id' | 'createdAt' | 'updatedAt' | 'synced' | 'isDeleted'>
): Promise<Case> {
  const now = new Date().toISOString();
  const newCase: Case = {
    ...data,
    id: crypto.randomUUID(),
    createdAt: now,
    updatedAt: now,
    synced: false,
    isDeleted: false,
  };
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

export async function getAllCases(): Promise<Case[]> {
  const all = await db.cases.orderBy('createdAt').reverse().toArray();
  return all.filter(c => !c.isDeleted);
}

export async function getOpenCases(): Promise<Case[]> {
  const open = await db.cases.where('status').equals('Open').sortBy('respondentName');
  return open.filter(c => !c.isDeleted);
}

export async function deleteCase(id: string): Promise<void> {
  const now = new Date().toISOString();

  await db.cases.where({ id }).modify({ isDeleted: true, updatedAt: now, synced: false });
  await db.timeEntries.where('caseId').equals(id).modify({ isDeleted: true, updatedAt: now, synced: false });
  await db.expenses.where('caseId').equals(id).modify({ isDeleted: true, updatedAt: now, synced: false });
}

// ---- Time Entries ----

export async function createTimeEntry(
  data: Omit<TimeEntry, 'id' | 'billableHoursRounded' | 'amount' | 'billingMonth' | 'billingStatus'>
): Promise<TimeEntry> {
  const rounded = roundToNearestTenth(data.billableHours);
  const billingMonth = getBillingMonth(data.date);

  // snapshot the current rate from case
  const caseRecord = await db.cases.get(data.caseId);
  const rate = caseRecord?.hourlyRate ?? (data as any).hourlyRate ?? 0;

  const amount = calculateAmount(rounded, rate);

  const entry: TimeEntry = {
    ...data,
    id: crypto.randomUUID(),
    billableHoursRounded: rounded,
    hourlyRate: rate,
    amount,
    billingMonth,
    billingStatus: 'Pending',
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

  // Recompute if hours or date or rate changed
  if (updates.billableHours !== undefined || updates.date !== undefined || updates.hourlyRate !== undefined) {
    const rounded = roundToNearestTenth(newData.billableHours);
    const billingMonth = getBillingMonth(newData.date);
    const caseRec = await db.cases.get(newData.caseId);
    const rate = caseRec?.hourlyRate ?? newData.hourlyRate;

    newData.billableHoursRounded = rounded;
    newData.billingMonth = billingMonth;
    newData.hourlyRate = rate;
    newData.amount = calculateAmount(rounded, rate);
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

export async function getAllTimeEntries(): Promise<TimeEntry[]> {
  const all = await db.timeEntries.orderBy('date').reverse().toArray();
  return all.filter(e => !e.isDeleted);
}

export async function getPendingTimeEntriesForMonth(billingMonth: string): Promise<TimeEntry[]> {
  const rows = await db.timeEntries
    .where('billingMonth')
    .equals(billingMonth)
    .and((e) => e.billingStatus === 'Pending')
    .toArray();
  return rows.filter(e => !e.isDeleted);
}

export async function getAllTimeForMonth(billingMonth: string): Promise<TimeEntry[]> {
  const rows = await db.timeEntries.where('billingMonth').equals(billingMonth).toArray();
  return rows.filter(e => !e.isDeleted);
}

export async function markTimeEntriesAsBilled(billingMonth: string): Promise<number> {
  const pending = await getPendingTimeEntriesForMonth(billingMonth);
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

export async function createExpense(data: Omit<Expense, 'id'>): Promise<Expense> {
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

export async function getAllExpenses(): Promise<Expense[]> {
  const all = await db.expenses.orderBy('date').reverse().toArray();
  return all.filter(e => !e.isDeleted);
}

export async function getExpensesForMonth(billingMonth: string): Promise<Expense[]> {
  // Filter client side since date based
  const all = await db.expenses.toArray();
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
      name: 'Alex Rivera',
      title: 'Court Visitor',
      email: 'alex.rivera@alaskacourts.gov',
      phone: '(907) 555-0142',
      address: '123 Court Plaza, Suite 204',
      cityStateZip: 'Anchorage, AK 99501',
      courtVisitorId: 'CV-48291',
      organization: 'Alaska Court System',
      invoiceNotes: 'Payment due within 30 days. Please reference the case number on all remittances. This statement is submitted for the Superior Court of the State of Alaska.',
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
  const totalTimeAmount = timeEntries.reduce((sum, e) => sum + e.amount, 0);
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

export async function buildMonthlyBillingSummary(billingMonth: string): Promise<any> {
  // Returns structured data for PDF + UI preview. No humor here.
  const cases = await getAllCases();
  const timeEntries = await getAllTimeForMonth(billingMonth);
  const expenses = await getExpensesForMonth(billingMonth);

  const caseMap = new Map<string, any>();

  for (const c of cases) {
    caseMap.set(c.id, {
      caseId: c.id,
      caseNumber: c.caseNumber,
      respondentName: c.respondentName,
      assignmentType: c.assignmentType,
      hourlyRate: c.hourlyRate,
      firstTimeBilling: c.firstTimeBilling,
      timeEntries: [],
      expenses: [],
      timeTotal: 0,
      timeAmount: 0,
      expensesTotal: 0,
      grandTotal: 0,
    });
  }

  for (const te of timeEntries) {
    const bucket = caseMap.get(te.caseId);
    if (bucket) {
      bucket.timeEntries.push(te);
      bucket.timeTotal += te.billableHoursRounded;
      bucket.timeAmount += te.amount;
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
    }))
    .sort((a, b) => a.respondentName.localeCompare(b.respondentName));

  const overallTimeHours = caseSummaries.reduce((s, c) => s + c.timeTotal, 0);
  const overallTimeAmount = caseSummaries.reduce((s, c) => s + c.timeAmount, 0);
  const overallExpenses = caseSummaries.reduce((s, c) => s + c.expensesTotal, 0);

  return {
    billingMonth,
    cases: caseSummaries,
    overallTimeHours: Math.round(overallTimeHours * 10) / 10,
    overallTimeAmount: Math.round(overallTimeAmount * 100) / 100,
    overallExpenses: Math.round(overallExpenses * 100) / 100,
    grandTotal: Math.round((overallTimeAmount + overallExpenses) * 100) / 100,
    pendingCount: timeEntries.filter((t) => t.billingStatus === 'Pending').length,
  };
}

// ---- Sync Layer Helpers (aligned to new schema) ----

export async function getUnsyncedCases(): Promise<Case[]> {
  const all = await db.cases.toArray();
  return all.filter((c) => c.synced !== true && !c.isDeleted);
}

export async function getUnsyncedTimeEntries(): Promise<TimeEntry[]> {
  const all = await db.timeEntries.toArray();
  return all.filter((e) => e.synced !== true && !e.isDeleted);
}

export async function getUnsyncedExpenses(): Promise<Expense[]> {
  const all = await db.expenses.toArray();
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

export async function getAllUnsyncedForPush() {
  const [cases, timeEntries, expenses] = await Promise.all([
    getUnsyncedCases(),
    getUnsyncedTimeEntries(),
    getUnsyncedExpenses(),
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

