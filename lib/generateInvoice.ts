/**
 * CaseLog Professional PDF Generation
 * Produces clean, court-ready billing documents. NO HUMOR IN OUTPUT.
 * Uses jsPDF + jspdf-autotable
 */

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';
import { Case, TimeEntry, Expense, UserProfile } from '@/types';
import { formatCurrency, formatMonth } from '@/lib/format';

interface GenerateOptions {
  billingMonth: string;
  profile: UserProfile;
  caseData: {
    caseRecord: Case;
    timeEntries: TimeEntry[];
    expenses: Expense[];
    timeTotal: number;
    timeAmount: number;
    expensesTotal: number;
    grandTotal: number;
  };
  isFirstTime?: boolean;
}

export function generateCaseInvoicePDF(opts: GenerateOptions): jsPDF {
  const { billingMonth, profile, caseData, isFirstTime } = opts;
  const { caseRecord, timeEntries, expenses, timeTotal, timeAmount, expensesTotal, grandTotal } = caseData;

  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 18;

  let y = 18;

  // === ALASKA COURT SYSTEM HEADER ===
  doc.setFillColor(20, 30, 55); // Dark navy-ish for official feel
  doc.rect(0, 0, pageWidth, 28, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  const org = profile.organization || 'Alaska Court System';
  doc.text(org.toUpperCase(), pageWidth / 2, 12, { align: 'center' });

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text('SUPERIOR COURT — COURT VISITOR PROGRAM', pageWidth / 2, 19, { align: 'center' });

  // Reset
  doc.setTextColor(0, 0, 0);
  y = 35;

  // Title
  doc.setFontSize(15);
  doc.setFont('helvetica', 'bold');
  doc.text('COURT VISITOR BILLING STATEMENT', pageWidth / 2, y, { align: 'center' });

  y += 6;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(formatMonth(billingMonth), pageWidth / 2, y, { align: 'center' });

  y += 12;

  // Optional logo
  if (profile.logoDataUrl) {
    try {
      // jsPDF supports adding images from data URL
      const logoW = 28;
      const logoH = 22;
      doc.addImage(profile.logoDataUrl, 'PNG', pageWidth - margin - logoW, y - 6, logoW, logoH);
    } catch (e) {
      // Fallback silently if image type unsupported
    }
  }

  // Court Visitor info (left)
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text(profile.name, margin, y);
  doc.setFont('helvetica', 'normal');
  if (profile.title) {
    y += 5;
    doc.text(profile.title, margin, y);
  }
  if (profile.courtVisitorId) {
    y += 5;
    doc.text(`ID: ${profile.courtVisitorId}`, margin, y);
  }
  if (profile.phone) {
    y += 5;
    doc.text(profile.phone, margin, y);
  }
  if (profile.email) {
    y += 5;
    doc.text(profile.email, margin, y);
  }

  // Case info (right side)
  const rightX = pageWidth - margin - 70;
  let rightY = y - (profile.title || profile.courtVisitorId ? 15 : 5);

  doc.setFont('helvetica', 'bold');
  doc.text('CASE INFORMATION', rightX, rightY);
  rightY += 6;
  doc.setFont('helvetica', 'normal');
  doc.text(`Respondent: ${caseRecord.respondentName}`, rightX, rightY);
  rightY += 5;
  doc.text(`Case No: ${caseRecord.caseNumber}`, rightX, rightY);
  rightY += 5;
  doc.text(`Assignment: ${caseRecord.assignmentType}`, rightX, rightY);
  rightY += 5;
  doc.text(`Rate: ${formatCurrency(caseRecord.hourlyRate)}/hr`, rightX, rightY);

  // Divider
  y = Math.max(y, rightY) + 9;
  doc.setDrawColor(180);
  doc.line(margin, y, pageWidth - margin, y);

  y += 10;

  // First time note (professional)
  if (caseRecord.firstTimeBilling || isFirstTime) {
    doc.setFontSize(9);
    doc.setFont('helvetica', 'italic');
    doc.text('Note: First-time billing for this case.', margin, y);
    y += 8;
  }

  // TIME ENTRIES TABLE
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('TIME LOG', margin, y);
  y += 4;

  if (timeEntries.length > 0) {
    const timeRows = timeEntries
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((e) => [
        format(new Date(e.date), 'MM/dd/yyyy'),
        e.activityType,
        e.billableHoursRounded.toFixed(1),
        formatCurrency(e.hourlyRate),
        formatCurrency(e.amount),
        e.description || '',
      ]);

    autoTable(doc, {
      startY: y,
      head: [['Date', 'Activity', 'Hours', 'Rate', 'Amount', 'Notes']],
      body: timeRows,
      margin: { left: margin, right: margin },
      styles: { fontSize: 9, cellPadding: 3, font: 'helvetica' },
      headStyles: { fillColor: [30, 30, 30], textColor: 255, fontStyle: 'bold' },
      columnStyles: {
        2: { halign: 'right' },
        3: { halign: 'right' },
        4: { halign: 'right' },
      },
      theme: 'grid',
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    y = (doc as any).lastAutoTable.finalY + 6;
  } else {
    doc.setFontSize(9);
    doc.text('No time entries for this period.', margin, y);
    y += 8;
  }

  // EXPENSES TABLE
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('EXPENSES', margin, y);
  y += 4;

  if (expenses.length > 0) {
    const expRows = expenses
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((e) => [
        format(new Date(e.date), 'MM/dd/yyyy'),
        e.expenseType,
        formatCurrency(e.amount),
        e.description || '',
      ]);

    autoTable(doc, {
      startY: y,
      head: [['Date', 'Type', 'Amount', 'Description']],
      body: expRows,
      margin: { left: margin, right: margin },
      styles: { fontSize: 9, cellPadding: 3 },
      headStyles: { fillColor: [30, 30, 30], textColor: 255, fontStyle: 'bold' },
      columnStyles: {
        2: { halign: 'right' },
      },
      theme: 'grid',
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    y = (doc as any).lastAutoTable.finalY + 8;
  } else {
    doc.setFontSize(9);
    doc.text('No expenses for this period.', margin, y);
    y += 8;
  }

  // TOTALS - clean box
  y += 4;
  const boxStart = y;
  doc.setFillColor(245, 245, 245);
  doc.rect(margin, y, pageWidth - margin * 2, 32, 'F');

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text('Time Subtotal:', margin + 4, y + 8);
  doc.text(formatCurrency(timeAmount), pageWidth - margin - 4, y + 8, { align: 'right' });

  doc.text('Expenses Subtotal:', margin + 4, y + 13);
  doc.text(formatCurrency(expensesTotal), pageWidth - margin - 4, y + 13, { align: 'right' });

  doc.setFont('helvetica', 'bold');
  doc.text('TOTAL DUE THIS PERIOD:', margin + 4, y + 22);
  doc.text(formatCurrency(grandTotal), pageWidth - margin - 4, y + 22, { align: 'right' });

  y = boxStart + 38;

  // Footer notes
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  if (profile.invoiceNotes) {
    doc.text(profile.invoiceNotes, margin, y);
    y += 6;
  }

  doc.text(`Generated ${format(new Date(), 'yyyy-MM-dd HH:mm')} • CaseLog • This document is computer generated.`, margin, y);

  // Signature line
  y += 18;
  doc.line(margin, y, margin + 55, y);
  doc.text('Court Visitor Signature', margin, y + 4);

  doc.line(pageWidth - margin - 55, y, pageWidth - margin, y);
  doc.text('Date', pageWidth - margin - 25, y + 4);

  return doc;
}

// Generate a summary cover + all cases in one document
export function generateFullBillingPackagePDF(
  billingMonth: string,
  profile: UserProfile,
  summary: any // from buildMonthlyBillingSummary
): jsPDF {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 18;

  // COVER PAGE — Alaska Court System
  let y = 18;

  doc.setFillColor(20, 30, 55);
  doc.rect(0, 0, pageWidth, 26, 'F');
  doc.setTextColor(255);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text((profile.organization || 'Alaska Court System').toUpperCase(), pageWidth / 2, 11, { align: 'center' });
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text('SUPERIOR COURT — COURT VISITOR BILLING PACKAGE', pageWidth / 2, 18, { align: 'center' });
  doc.setTextColor(0);

  y = 38;

  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('MONTHLY BILLING PACKAGE', pageWidth / 2, y, { align: 'center' });

  y += 8;
  doc.setFontSize(13);
  doc.setFont('helvetica', 'normal');
  doc.text(formatMonth(billingMonth), pageWidth / 2, y, { align: 'center' });

  y += 16;
  doc.setFontSize(11);
  doc.text(`Court Visitor: ${profile.name}`, pageWidth / 2, y, { align: 'center' });
  if (profile.courtVisitorId) {
    y += 5;
    doc.text(`ID: ${profile.courtVisitorId}`, pageWidth / 2, y, { align: 'center' });
  }

  y += 14;
  doc.setDrawColor(0);
  doc.line(margin + 30, y, pageWidth - margin - 30, y);

  y += 12;
  doc.setFontSize(12);
  doc.text('SUMMARY', margin, y);
  y += 8;

  doc.setFontSize(10);
  doc.text(`Total Cases with Activity: ${summary.cases.length}`, margin, y);
  y += 6;
  doc.text(`Total Billable Hours: ${summary.overallTimeHours.toFixed(1)}`, margin, y);
  y += 6;
  doc.text(`Total Time Fees: ${formatCurrency(summary.overallTimeAmount)}`, margin, y);
  y += 6;
  doc.text(`Total Expenses: ${formatCurrency(summary.overallExpenses)}`, margin, y);
  y += 6;
  doc.setFont('helvetica', 'bold');
  doc.text(`GRAND TOTAL: ${formatCurrency(summary.grandTotal)}`, margin, y);

  y += 14;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text('Individual case statements follow on subsequent pages.', margin, y);

  // Page per case
  summary.cases.forEach((caseSummary: any, idx: number) => {
    doc.addPage();

    // Reuse the case invoice logic but without full header every time
    const caseRecord: Case = {
      id: caseSummary.caseId,
      respondentName: caseSummary.respondentName,
      caseNumber: caseSummary.caseNumber,
      assignmentType: caseSummary.assignmentType,
      status: 'Open',
      hourlyRate: caseSummary.hourlyRate,
      firstTimeBilling: caseSummary.firstTimeBilling,
      createdAt: '',
      updatedAt: '',
      synced: true,
      isDeleted: false,
    };

    // Reuse generator
    const subDoc = generateCaseInvoicePDF({
      billingMonth,
      profile,
      caseData: {
        caseRecord,
        timeEntries: caseSummary.timeEntries,
        expenses: caseSummary.expenses,
        timeTotal: caseSummary.timeTotal,
        timeAmount: caseSummary.timeAmount,
        expensesTotal: caseSummary.expensesTotal,
        grandTotal: caseSummary.grandTotal,
      },
    });

    // Append pages from sub doc to main (simple: just copy content)
    // Simpler approach: draw the content manually here too for cleanliness.
    // For brevity in one file we call a helper and merge. 
    // Since jsPDF doesn't easily merge pages, we will rebuild per case here instead.
    // (To keep implementation simple and robust we duplicate small header per case page)
    // Re-implement concise header + tables for this case page:

    let caseY = 18;

    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text(`CASE STATEMENT — ${caseSummary.respondentName}`, margin, caseY);
    caseY += 6;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`${caseSummary.caseNumber} • ${caseSummary.assignmentType} • ${formatCurrency(caseSummary.hourlyRate)}/hr`, margin, caseY);

    caseY += 8;
    doc.line(margin, caseY, pageWidth - margin, caseY);
    caseY += 8;

    // Time table
    if (caseSummary.timeEntries.length) {
      const rows = caseSummary.timeEntries.map((e: TimeEntry) => [
        format(new Date(e.date), 'MM/dd'),
        e.activityType,
        e.billableHoursRounded.toFixed(1),
        formatCurrency(e.amount),
      ]);

      autoTable(doc, {
        startY: caseY,
        head: [['Date', 'Activity', 'Hrs', 'Amount']],
        body: rows,
        margin: { left: margin, right: margin },
        styles: { fontSize: 8.5, cellPadding: 2 },
        headStyles: { fillColor: [45, 45, 45], textColor: 255 },
        theme: 'grid',
      });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      caseY = (doc as any).lastAutoTable.finalY + 4;
    }

    // Expenses
    if (caseSummary.expenses.length) {
      const expRows = caseSummary.expenses.map((e: Expense) => [
        format(new Date(e.date), 'MM/dd'),
        e.expenseType,
        formatCurrency(e.amount),
      ]);

      autoTable(doc, {
        startY: caseY,
        head: [['Date', 'Expense', 'Amount']],
        body: expRows,
        margin: { left: margin, right: margin },
        styles: { fontSize: 8.5, cellPadding: 2 },
        headStyles: { fillColor: [45, 45, 45], textColor: 255 },
        theme: 'grid',
      });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      caseY = (doc as any).lastAutoTable.finalY + 4;
    }

    // Totals
    caseY += 2;
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text(`Case Total: ${formatCurrency(caseSummary.grandTotal)}`, margin, caseY);
  });

  // Final page - notes
  doc.addPage();
  y = 24;
  doc.setFontSize(12);
  doc.text('SUBMISSION NOTES', margin, y);
  y += 10;
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  const notes = [
    'This package contains all time and expense detail for the billing period.',
    'Please include the case number on all remittances and correspondence.',
    profile.invoiceNotes || '',
    '',
    `Generated via CaseLog — ${format(new Date(), 'yyyy-MM-dd HH:mm')}`,
    'Official record for the Alaska Court System, Superior Court.',
  ];
  notes.forEach((n) => {
    doc.text(n, margin, y);
    y += 6;
  });

  // Simple footer on last page
  doc.setFontSize(7);
  doc.text(`Page ${doc.getNumberOfPages()}`, pageWidth - margin, doc.internal.pageSize.getHeight() - 10, { align: 'right' });

  return doc;
}
