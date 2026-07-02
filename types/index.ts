/**
 * CaseLog Data Models (aligned to provided schema)
 */

export type AssignmentType =
  | 'Initial'
  | 'Review'
  | 'Three-Year Review'
  | 'Medication';

export type CaseStatus = 'Open' | 'Closed';

export interface Case {
  id: string;
  respondentName: string;
  caseNumber: string;
  assignmentType: AssignmentType;
  status: CaseStatus;
  hourlyRate: number;
  firstTimeBilling: boolean;
  caseNotes?: string;
  updatedAt: string;      // ISO string
  isDeleted?: boolean;
  synced?: boolean;
  createdAt: string;
}

export type ActivityType =
  | 'Contact'
  | 'Home Visit'
  | 'Court'
  | 'Research'
  | 'Report Writing'
  | 'Drive Time'
  | 'Wait Time'
  | 'Other';

export type BillingStatus = 'Pending' | 'Billed';

export interface TimeEntry {
  id: string;
  caseId: string;
  date: string;
  activityType: string;
  billableHours: number;
  billableHoursRounded: number;
  hourlyRate: number;
  amount: number;
  description: string;
  startTime?: string;
  endTime?: string;
  billingMonth: string;
  billingStatus: 'Pending' | 'Billed';
  updatedAt: string;
  isDeleted?: boolean;
  synced?: boolean;
}

export type ExpenseType =
  | 'Parking'
  | 'Certified Mail'
  | 'Copies'
  | 'Postage'
  | 'Mileage'
  | 'Other';

export interface Expense {
  id: string;
  caseId: string;
  date: string;
  expenseType: string;
  description: string;
  amount: number;
  updatedAt: string;
  isDeleted?: boolean;
  synced?: boolean;
}

// User profile / settings for invoice header (persisted in Dexie too)
export interface UserProfile {
  id: string; // singleton 'profile'
  name: string;
  title?: string; // e.g. "Court Visitor"
  email?: string;
  phone?: string;
  address?: string;
  cityStateZip?: string;
  courtVisitorId?: string; // Alaska specific flavor
  organization?: string; // "Alaska Court System" by default
  invoiceNotes?: string; // footer or notes on invoices, professional only
  // Optional logo support (base64 data URL, small PNG/SVG recommended)
  logoDataUrl?: string;
  updatedAt: string;
}

// Billing summary for a month
export interface MonthlyBillingSummary {
  billingMonth: string;
  cases: Array<{
    caseId: string;
    caseNumber: string;
    respondentName: string;
    assignmentType: AssignmentType;
    hourlyRate: number;
    firstTimeBilling: boolean;
    timeEntries: TimeEntry[];
    expenses: Expense[];
    timeTotal: number; // rounded hours sum
    timeAmount: number;
    expensesTotal: number;
    grandTotal: number;
  }>;
  overallTimeHours: number;
  overallTimeAmount: number;
  overallExpenses: number;
  grandTotal: number;
  pendingCount: number;
}

// Helper type for form state
export type TimeEntryFormData = Omit<
  TimeEntry,
  'id' | 'billableHoursRounded' | 'amount' | 'hourlyRate' | 'billingMonth' | 'billingStatus' | 'updatedAt' | 'synced' | 'isDeleted'
> & {
  caseId: string;
};

export type ExpenseFormData = Omit<Expense, 'id' | 'updatedAt' | 'synced' | 'isDeleted'>;

export type CaseFormData = Omit<Case, 'id' | 'createdAt' | 'updatedAt' | 'synced' | 'isDeleted'>;

// Outbox for sync queue
export interface SyncQueueItem {
  id?: number;
  operation: 'upsert' | 'delete';
  table: 'cases' | 'timeEntries' | 'expenses';
  recordId: string;
  payload: any;
  timestamp: string;
  retryCount: number;
  lastError?: string;
}


