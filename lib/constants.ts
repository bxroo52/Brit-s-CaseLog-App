import { ActivityType, AssignmentType, ExpenseType } from '@/types';

export const ASSIGNMENT_TYPES: AssignmentType[] = [
  'Initial',
  'Follow-up',
  'Review',
  'Other',
];

export const ACTIVITY_TYPES: ActivityType[] = [
  'Contact',
  'Court',
  'Research',
  'Report Writing',
  'Drive Time',
  'Wait Time',
  'Other',
];

export const EXPENSE_TYPES: ExpenseType[] = [
  'Parking',
  'Certified Mail',
  'Copies',
  'Postage',
  'Mileage',
  'Other',
];

export const DEFAULT_HOURLY_RATE = 85; // Reasonable starting default for court visitors

// Alaska Court Visitor specific guidance (shown in UI)
export const ALASKA_NOTES = {
  mileage: 'Mileage is typically reimbursed at the current IRS standard rate or as directed by the Court. Record actual miles in the description.',
  billing: 'All statements are submitted to the Alaska Court System, Superior Court.',
};
