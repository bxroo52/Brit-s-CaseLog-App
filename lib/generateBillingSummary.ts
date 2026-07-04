import * as XLSX from 'xlsx';
import { formatMonth } from './format';

/**
 * Generates a Billing Summary Excel file matching the required structure:
 * - Header rows: Contractor Name, Month & Year
 * - Column headers with all specified fields
 * - One row per case with aggregated month data from currentSummary
 * - Totals row at bottom
 * Uses data from the monthly billing summary (cases + time + expenses)
 */
export function generateBillingSummaryExcel(
  currentSummary: any,
  profile: any,
  billingMonth: string
): void {
  if (!currentSummary || !currentSummary.cases || currentSummary.cases.length === 0) {
    // Use native alert for simplicity outside React context; in prod could toast but this is export
    if (typeof window !== 'undefined') {
      alert('No billing activity for the selected month. Log time or expenses first.');
    }
    return;
  }

  const contractorName = (profile && profile.name) ? profile.name : 'N/A';
  const monthYear = formatMonth(billingMonth);

  // Sort by last name then first (client names)
  const sortedCases = [...currentSummary.cases].sort((a: any, b: any) => {
    const lastCompare = (a.respondentLastName || '').localeCompare(b.respondentLastName || '');
    if (lastCompare !== 0) return lastCompare;
    return (a.respondentFirstName || '').localeCompare(b.respondentFirstName || '');
  });

  const dataRows: any[][] = [];
  let totalHours = 0;
  let totalBilled = 0;
  let totalExpenses = 0;
  let totalAll = 0;

  sortedCases.forEach((cs: any) => {
    const hours = Number(cs.timeTotal || 0);
    const billed = Number(cs.timeAmount || 0);
    const exp = Number(cs.expensesTotal || 0);
    const tot = Number(cs.grandTotal || 0);

    // Fallback for names if not present in summary (for backward)
    let lastName = cs.respondentLastName || '';
    let firstName = cs.respondentFirstName || '';
    if (!lastName && cs.respondentName) {
      const parts = String(cs.respondentName).trim().split(/\s+/);
      lastName = parts.pop() || '';
      firstName = parts.join(' ');
    }

    const openClosed = cs.status || (cs.caseId ? 'Open' : 'Open');

    dataRows.push([
      lastName,
      firstName,
      cs.caseNumber || '',
      hours,
      billed,
      exp,
      tot,
      openClosed,
      '', // Order Ver. (left blank per template usage)
    ]);

    totalHours += hours;
    totalBilled += billed;
    totalExpenses += exp;
    totalAll += tot;
  });

  // Build array-of-arrays for the sheet (header metadata + col headers + data + totals)
  // Structure closely modeled on the discovered "Billing Summary Template FY24.xlsx" (Summary sheet)
  // + includes the explicit fields requested (Type / First Time Billing)
  const aoa: any[][] = [
    ['Contractor Name', contractorName],
    ['Month & Year', monthYear],
    [], // blank row
    // Note / instruction area (modeled directly on the template)
    ['', '', '', '', '', '', '', '', 'CVC Only', 'NOTES'],
    // Header row - EXACT match to "Billing Summary Template FY24.xlsx" Summary sheet
    [
      'Client Last Name',
      'Client First Name',
      'Case Number',
      'Hours',
      'Amount Billed',
      'Expenses',
      'Total',
      'Open/Closed',
      'Order Ver.',
    ],
    ...dataRows,
    // Totals row (aligned to 9 data columns + extra for notes)
    [
      '',
      '',
      'TOTALS',
      Math.round(totalHours * 10) / 10,
      Math.round(totalBilled * 100) / 100,
      Math.round(totalExpenses * 100) / 100,
      Math.round(totalAll * 100) / 100,
      '',
      '',
    ],
  ];

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(aoa);

  // Reasonable column widths for readability (exact match to template columns)
  ws['!cols'] = [
    { wch: 20 }, // Client Last Name
    { wch: 18 }, // Client First Name
    { wch: 16 }, // Case Number
    { wch: 10 }, // Hours
    { wch: 15 }, // Amount Billed
    { wch: 12 }, // Expenses
    { wch: 12 }, // Total
    { wch: 14 }, // Open/Closed
    { wch: 12 }, // Order Ver.
  ];

  XLSX.utils.book_append_sheet(wb, ws, 'Billing Summary');

  const safeMonth = billingMonth.replace(/[^0-9-]/g, '');
  const fileName = `Billing_Summary_${safeMonth}.xlsx`;
  XLSX.writeFile(wb, fileName);
}
