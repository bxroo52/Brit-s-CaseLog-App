import { format, parseISO, startOfMonth, endOfMonth, subMonths } from 'date-fns';

export function formatDate(dateStr: string, fmt = 'MMM dd, yyyy'): string {
  if (!dateStr) return '';
  try {
    return format(parseISO(dateStr), fmt);
  } catch {
    return dateStr;
  }
}

export function formatMonth(month: string): string {
  // "2026-06" -> "June 2026"
  try {
    const d = parseISO(month + '-01');
    return format(d, 'MMMM yyyy');
  } catch {
    return month;
  }
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount);
}

export function formatHours(hours: number): string {
  return hours.toFixed(1);
}

export function getRecentMonths(count = 6): string[] {
  const months: string[] = [];
  const now = new Date();
  for (let i = 0; i < count; i++) {
    const d = subMonths(now, i);
    const m = format(startOfMonth(d), 'yyyy-MM');
    months.push(m);
  }
  return months;
}

export function getMonthLabel(month: string): string {
  return formatMonth(month);
}

// For billing filename friendly
export function monthForFilename(month: string): string {
  return month.replace('-', '');
}
