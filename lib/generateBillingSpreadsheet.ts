import * as XLSX from 'xlsx';
import { Case } from '@/types';

export function generateBillingSpreadsheet(cases: Case[]) {
  if (!cases.length) {
    alert('No cases to export');
    return;
  }

  // === SORT ALPHABETICALLY BY LAST NAME (your exact requirement) ===
  const sortedCases = [...cases].sort((a, b) => {
    const lastNameCompare = a.respondentLastName.localeCompare(b.respondentLastName);
    if (lastNameCompare !== 0) return lastNameCompare;
    return a.respondentFirstName.localeCompare(b.respondentFirstName);
  });

  const wb = XLSX.utils.book_new();

  // ========== SUMMARY SHEET ==========
  const summaryData = sortedCases.map(c => ({
    'Last Name': c.respondentLastName,
    'First Name': c.respondentFirstName,
    'Respondent (Last, First)': `${c.respondentLastName}, ${c.respondentFirstName}`,
    'Case Number': c.caseNumber,
    'Assignment Type': c.assignmentType,
    'Status': c.status,
    'First Time Billing': c.firstTimeBilling ? 'Yes' : 'No',
    'Notes': c.notes || '',
    'Created': new Date(c.createdAt).toLocaleDateString(),
  }));

  const wsSummary = XLSX.utils.json_to_sheet(summaryData);
  XLSX.utils.book_append_sheet(wb, wsSummary, 'Case Summary - Alphabetical');

  // ========== INVOICE DETAIL SHEET ==========
  const invoiceData = sortedCases.map(c => ({
    'Invoice Line': `${c.respondentLastName}, ${c.respondentFirstName} — Case ${c.caseNumber}`,
    'Last Name': c.respondentLastName,
    'First Name': c.respondentFirstName,
    'Case Number': c.caseNumber,
    'Billing Status': c.firstTimeBilling ? 'First Billing' : 'Standard',
    'Notes / Special Instructions': c.notes || '',
  }));

  const wsInvoices = XLSX.utils.json_to_sheet(invoiceData);
  XLSX.utils.book_append_sheet(wb, wsInvoices, 'Invoices - Sorted by Last Name');

  // Download
  const fileName = `CaseLog_Billing_${new Date().toISOString().slice(0, 10)}.xlsx`;
  XLSX.writeFile(wb, fileName);
}
