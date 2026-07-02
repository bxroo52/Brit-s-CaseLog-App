'use client';

import React, { useEffect, useState } from 'react';
import { useAppStore, initializeAppData } from '@/stores/useAppStore';
import { AppHeader } from '@/components/AppHeader';
import { CaseDialog } from '@/components/CaseDialog';
import { TimeLogDialog } from '@/components/TimeLogDialog';
import { ExpenseDialog } from '@/components/ExpenseDialog';
import { SettingsDialog } from '@/components/SettingsDialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import {
  Plus,
  Clock,
  DollarSign,
  Download,
  Trash2,
  Edit2,
  CheckCircle,
  AlertCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { format, parseISO } from 'date-fns';
import { getRecentMonths, formatMonth, formatCurrency, formatHours, formatDate } from '@/lib/format';
import { generateCaseInvoicePDF, generateFullBillingPackagePDF } from '@/lib/generateInvoice';
import { buildMonthlyBillingSummary } from '@/lib/db';
import { Case, TimeEntry, Expense } from '@/types';

type View = 'dashboard' | 'cases' | 'time' | 'expenses' | 'billing';

export default function CaseLogApp() {
  const {
    cases,
    timeEntries,
    expenses,
    profile,
    isLoading,
    selectedMonth,
    searchTerm,
    statusFilter,
    billingSummary,
    loadAllData,
    loadProfile,
    setSelectedMonth,
    loadBillingSummary,
    generateBilling,
    setSearchTerm,
    setStatusFilter,
    getFilteredCases,
    getOpenCases,
    getCaseById,
    getTimeForCase,
    getExpensesForCase,
    removeCase,
    removeTimeEntry,
    removeExpense,
    pendingChangesCount,
  } = useAppStore();

  const [activeView, setActiveView] = useState<View>('dashboard');
  const [caseDialogOpen, setCaseDialogOpen] = useState(false);
  const [editingCase, setEditingCase] = useState<Case | undefined>();
  const [timeDialogOpen, setTimeDialogOpen] = useState(false);
  const [defaultTimeCaseId, setDefaultTimeCaseId] = useState<string | undefined>();
  const [editingTime, setEditingTime] = useState<any>(null);
  const [expenseDialogOpen, setExpenseDialogOpen] = useState(false);
  const [defaultExpenseCaseId, setDefaultExpenseCaseId] = useState<string | undefined>();
  const [editingExpense, setEditingExpense] = useState<any>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const [billingMonth, setBillingMonth] = useState(selectedMonth);

  // Initialize Dexie + Zustand on mount
  useEffect(() => {
    (async () => {
      await initializeAppData();
    })();
  }, []);

  // Sync selected month
  useEffect(() => {
    setBillingMonth(selectedMonth);
  }, [selectedMonth]);

  const openCases = getOpenCases();
  const filteredCases = getFilteredCases();

  const allPending = timeEntries.filter((t) => t.billingStatus === 'Pending');
  const totalPendingHours = allPending.reduce((s, t) => s + t.billableHoursRounded, 0);
  const totalPendingAmount = allPending.reduce((s, t) => s + t.amount, 0);
  const totalExpensesAll = expenses.reduce((s, e) => s + e.amount, 0);

  // Quick recent
  const recentTime = [...timeEntries].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5);
  const recentExpenses = [...expenses].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 3);

  // Billing preview data
  const currentSummary = billingSummary;

  const handleViewChange = (view: View) => {
    setActiveView(view);
    if (view === 'billing') {
      loadBillingSummary(billingMonth);
    }
  };

  // Open log with case preselected
  const quickLogTime = (caseId?: string) => {
    setDefaultTimeCaseId(caseId);
    setEditingTime(null);
    setTimeDialogOpen(true);
  };

  const quickLogExpense = (caseId?: string) => {
    setDefaultExpenseCaseId(caseId);
    setEditingExpense(null);
    setExpenseDialogOpen(true);
  };

  const openEditCase = (c: Case) => {
    setEditingCase(c);
    setCaseDialogOpen(true);
  };

  const openNewCase = () => {
    setEditingCase(undefined);
    setCaseDialogOpen(true);
  };

  const handleDeleteCase = async (c: Case) => {
    if (!confirm(`Delete case ${c.caseNumber} and ALL its logs? This cannot be undone.`)) return;
    await removeCase(c.id);
    toast('Case and associated logs deleted. Poof.');
  };

  const handleDeleteTime = async (t: TimeEntry) => {
    if (t.billingStatus === 'Billed') {
      if (!confirm('This entry is already marked Billed. Delete anyway?')) return;
    }
    await removeTimeEntry(t.id);
    toast('Time entry deleted.');
  };

  const handleDeleteExpense = async (e: Expense) => {
    await removeExpense(e.id);
    toast('Expense deleted.');
  };

  const editTimeEntry = (t: TimeEntry) => {
    setEditingTime(t);
    setDefaultTimeCaseId(undefined);
    setTimeDialogOpen(true);
  };

  const editExpenseEntry = (e: Expense) => {
    setEditingExpense(e);
    setDefaultExpenseCaseId(undefined);
    setExpenseDialogOpen(true);
  };

  // BILLING — the money shot
  const handleMonthChange = (m: string | null) => {
    if (!m) return;
    setBillingMonth(m);
    setSelectedMonth(m);
    loadBillingSummary(m);
  };

  const handleGenerateBilling = async () => {
    if (!profile) return;

    try {
      await generateBilling(billingMonth);

      // Rebuild fresh summary post-mark
      const freshSummary = await buildMonthlyBillingSummary(billingMonth);

      // Generate ONE beautiful professional package PDF
      const doc = generateFullBillingPackagePDF(billingMonth, profile, freshSummary);
      const fileName = `CaseLog_Billing_${billingMonth}.pdf`;
      doc.save(fileName);

      toast.success(`Billing package generated and downloaded. The invoice monster has been fed.`, {
        description: `${freshSummary.cases.length} case(s) • ${formatCurrency(freshSummary.grandTotal)}`,
      });

      // Refresh
      await loadAllData();
      loadBillingSummary(billingMonth);
    } catch (err) {
      toast.error('Failed to generate billing. Check console.');
      console.error(err);
    }
  };

  const handleDownloadCaseInvoice = async (caseId: string) => {
    if (!profile || !currentSummary) return;

    const cs = currentSummary.cases.find((c: any) => c.caseId === caseId);
    if (!cs) return toast.error('No data for this case in selected month.');

    const caseRecord = getCaseById(caseId);
    if (!caseRecord) return;

    const doc = generateCaseInvoicePDF({
      billingMonth,
      profile,
      caseData: cs,
      isFirstTime: caseRecord.firstTimeBilling,
    });

    const safeName = cs.respondentName.replace(/\s+/g, '_');
    doc.save(`Invoice_${billingMonth}_${safeName}.pdf`);
    toast('Individual invoice downloaded.');
  };

  // CSV export for accounting
  const exportCSV = () => {
    const monthEntries = timeEntries.filter((t) => t.billingMonth === billingMonth);
    const monthExp = expenses.filter((e) => e.date.startsWith(billingMonth));

    let csv = 'Type,Date,Case,Respondent,Activity/Expense,Hours/Amount,Rate,Total,Status,Description\n';

    monthEntries.forEach((t) => {
      const c = getCaseById(t.caseId);
      csv += `Time,${t.date},${c?.caseNumber || ''},${c?.respondentName || ''},${t.activityType},${t.billableHoursRounded},${t.hourlyRate},${t.amount},${t.billingStatus},"${t.description.replace(/"/g, '""')}"\n`;
    });
    monthExp.forEach((e) => {
      const c = getCaseById(e.caseId);
      csv += `Expense,${e.date},${c?.caseNumber || ''},${c?.respondentName || ''},${e.expenseType},,${e.amount},,,"${e.description.replace(/"/g, '""')}"\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `CaseLog_${billingMonth}.csv`;
    a.click();
    URL.revokeObjectURL(url);

    toast('CSV exported. Feed it to your accounting overlord.');
  };

  const months = getRecentMonths(8);

  // Dashboard cards
  const Dashboard = () => (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tighter">Welcome back.</h1>
          <p className="text-muted-foreground">Tiny logs beat giant catch-up sessions.</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => quickLogTime()} className="gap-2">
            <Clock className="h-4 w-4" /> Log Time
          </Button>
          <Button onClick={() => quickLogExpense()} variant="outline" className="gap-2">
            <DollarSign className="h-4 w-4" /> Log Expense
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="stat-card">
          <div className="text-sm text-muted-foreground">Open Cases</div>
          <div className="text-4xl font-semibold tabular-nums mt-1">{openCases.length}</div>
        </div>
        <div className="stat-card">
          <div className="text-sm text-muted-foreground">Pending Entries</div>
          <div className="text-4xl font-semibold tabular-nums mt-1">{allPending.length}</div>
          <div className="text-xs text-muted-foreground mt-1">{formatHours(totalPendingHours)} hrs • {formatCurrency(totalPendingAmount)}</div>
        </div>
        <div className="stat-card">
          <div className="text-sm text-muted-foreground">This Month Logged</div>
          <div className="text-4xl font-semibold tabular-nums mt-1">{formatCurrency(totalPendingAmount + totalExpensesAll)}</div>
          <div className="text-xs mt-1 text-muted-foreground">All time + expenses</div>
        </div>
        <div className="stat-card bg-amber-50 border-amber-200">
          <div className="text-sm font-medium text-amber-900">Reminder</div>
          <div className="mt-2 text-sm text-amber-800">Future You called. They’d like you to log your hours.</div>
          <Button variant="secondary" size="sm" className="mt-3" onClick={() => setActiveView('time')}>Go log your shit →</Button>
        </div>
      </div>

      {/* Quick cases */}
      <Card>
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <CardTitle className="text-lg">Open Cases</CardTitle>
          <Button size="sm" variant="ghost" onClick={() => setActiveView('cases')}>Manage all →</Button>
        </CardHeader>
        <CardContent>
          {openCases.length === 0 ? (
            <div className="empty-state py-8">
              <p className="humor">No open cases. Your paycheck is trapped behind paperwork.</p>
              <div className="flex gap-3 mt-4">
                <Button onClick={openNewCase} className="gap-2"><Plus className="h-4 w-4" /> New Case</Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    useAppStore.getState().seedDemoData();
                  }}
                >
                  Load sample data
                </Button>
              </div>
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {openCases.slice(0, 6).map((c) => (
                <div key={c.id} className="log-card flex justify-between gap-3">
                  <div>
                    <div className="font-medium">{c.respondentName}</div>
                    <div className="text-sm text-muted-foreground">{c.caseNumber} • {c.assignmentType}</div>
                    <div className="mt-1 text-xs text-muted-foreground">${c.hourlyRate}/hr</div>
                  </div>
                  <div className="flex flex-col items-end justify-between text-right text-xs">
                    <Badge variant="outline" className="mb-1">{c.status}</Badge>
                    <div className="flex gap-1 mt-auto">
                      <Button size="sm" variant="ghost" onClick={() => quickLogTime(c.id)} className="h-7 px-2">+ Time</Button>
                      <Button size="sm" variant="ghost" onClick={() => quickLogExpense(c.id)} className="h-7 px-2">+ Exp</Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Activity */}
      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Recent Time</CardTitle></CardHeader>
          <CardContent className="pt-0">
            {recentTime.length === 0 ? (
              <div className="humor py-6">Nothing logged yet. The invoice monster hungers. Tiny logs now beat a giant catch-up session later.</div>
            ) : (
              recentTime.map((t) => {
                const c = getCaseById(t.caseId);
                return (
                  <div key={t.id} className="flex justify-between py-2 text-sm border-b last:border-0">
                    <div>
                      <span className="font-medium">{c?.respondentName}</span> — {t.activityType}
                      <div className="text-xs text-muted-foreground">{formatDate(t.date)}</div>
                    </div>
                    <div className="text-right tabular-nums">{formatHours(t.billableHoursRounded)}h • {formatCurrency(t.amount)}</div>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Recent Expenses</CardTitle></CardHeader>
          <CardContent className="pt-0">
            {recentExpenses.length === 0 ? <div className="humor py-6">Zero expenses. Suspiciously responsible.</div> : (
              recentExpenses.map((e) => {
                const c = getCaseById(e.caseId);
                return (
                  <div key={e.id} className="flex justify-between py-2 text-sm border-b last:border-0">
                    <div>{c?.respondentName} — {e.expenseType}</div>
                    <div className="tabular-nums">{formatCurrency(e.amount)}</div>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );

  // Cases view
  const CasesView = () => (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="section-title">Cases</h2>
          <p className="text-muted-foreground text-sm">Manage who you’re billing. Close them when done.</p>
        </div>
        <Button onClick={openNewCase} className="gap-2"><Plus /> New Case</Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-4">
        <Input
          placeholder="Search respondent or case #..."
          className="w-full sm:w-72"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
        <Select value={statusFilter} onValueChange={(v: any) => setStatusFilter(v)}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="All">All</SelectItem>
            <SelectItem value="Open">Open</SelectItem>
            <SelectItem value="Closed">Closed</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="ghost" size="sm" onClick={() => { setSearchTerm(''); setStatusFilter('All'); }}>Clear</Button>
      </div>

      <div className="rounded-xl border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Respondent</TableHead>
              <TableHead>Case #</TableHead>
              <TableHead>Type</TableHead>
              <TableHead className="text-right">Rate</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredCases.length === 0 && (
              <TableRow><TableCell colSpan={6} className="text-center py-12 text-muted-foreground">No cases match. Maybe create one?</TableCell></TableRow>
            )}
            {filteredCases.map((c) => {
              const caseTime = getTimeForCase(c.id);
              const pending = caseTime.filter((t) => t.billingStatus === 'Pending').length;
              return (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.respondentName}</TableCell>
                  <TableCell className="font-mono text-sm">{c.caseNumber}</TableCell>
                  <TableCell>{c.assignmentType}</TableCell>
                  <TableCell className="text-right font-mono">{formatCurrency(c.hourlyRate)}</TableCell>
                  <TableCell>
                    <Badge variant={c.status === 'Open' ? 'default' : 'secondary'}>{c.status}</Badge>
                    {c.firstTimeBilling && <Badge variant="outline" className="ml-1">First-time</Badge>}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1.5">
                      <Button size="sm" variant="ghost" onClick={() => quickLogTime(c.id)}>Log Time</Button>
                      <Button size="sm" variant="ghost" onClick={() => quickLogExpense(c.id)}>Expense</Button>
                      <Button size="sm" variant="ghost" onClick={() => openEditCase(c)}><Edit2 className="h-4 w-4" /></Button>
                      <Button size="sm" variant="ghost" className="text-destructive" onClick={() => handleDeleteCase(c)}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
      <p className="text-[10px] mt-2 text-muted-foreground">Deleting a case removes its time and expense records too.</p>
    </div>
  );

  // Time / Expense list views (combined for brevity)
  const TimeView = () => (
    <div>
      <div className="flex justify-between items-center mb-4">
        <div><h2 className="section-title">Time Entries</h2><p className="text-sm text-muted-foreground">All time ever logged. Edit or delete with care.</p></div>
        <Button onClick={() => quickLogTime()}><Plus className="mr-2 h-4 w-4" /> New Time Entry</Button>
      </div>
      <div className="rounded-xl border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Case</TableHead>
              <TableHead>Activity</TableHead>
              <TableHead className="text-right">Hours</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead>Status</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {timeEntries.length === 0 && <TableRow><TableCell colSpan={7} className="text-center py-10 text-muted-foreground">No time logged. Future You is judging you.</TableCell></TableRow>}
            {[...timeEntries].sort((a, b) => b.date.localeCompare(a.date)).map((t) => {
              const c = getCaseById(t.caseId);
              return (
                <TableRow key={t.id}>
                  <TableCell>{formatDate(t.date, 'MMM dd')}</TableCell>
                  <TableCell className="font-medium text-sm">{c?.respondentName}<div className="text-[10px] text-muted-foreground">{c?.caseNumber}</div></TableCell>
                  <TableCell>{t.activityType}</TableCell>
                  <TableCell className="text-right font-mono">{formatHours(t.billableHoursRounded)}</TableCell>
                  <TableCell className="text-right font-mono">{formatCurrency(t.amount)}</TableCell>
                  <TableCell>
                    <Badge variant={t.billingStatus === 'Billed' ? 'secondary' : 'outline'}>{t.billingStatus}</Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex gap-1 justify-end">
                      <Button variant="ghost" size="icon" onClick={() => editTimeEntry(t)}><Edit2 className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDeleteTime(t)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );

  const ExpensesView = () => (
    <div>
      <div className="flex justify-between mb-4">
        <div><h2 className="section-title">Expenses</h2></div>
        <Button onClick={() => quickLogExpense()}><Plus className="mr-2 h-4 w-4" /> Log Expense</Button>
      </div>
      <div className="rounded-xl border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Case</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Description</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {expenses.length === 0 && <TableRow><TableCell colSpan={6} className="text-center py-10">No expenses. Nice.</TableCell></TableRow>}
            {[...expenses].sort((a, b) => b.date.localeCompare(a.date)).map((e) => {
              const c = getCaseById(e.caseId);
              return (
                <TableRow key={e.id}>
                  <TableCell>{formatDate(e.date, 'MMM dd')}</TableCell>
                  <TableCell>{c?.respondentName}</TableCell>
                  <TableCell>{e.expenseType}</TableCell>
                  <TableCell className="text-sm max-w-[280px] truncate">{e.description}</TableCell>
                  <TableCell className="text-right font-mono">{formatCurrency(e.amount)}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" onClick={() => editExpenseEntry(e)}><Edit2 className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDeleteExpense(e)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );

  // THE BILLING VIEW
  const BillingView = () => (
    <div className="max-w-5xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="section-title">Billing Center</h2>
          <p className="text-muted-foreground">Select month → Preview → One click. Produces Alaska Court System-ready statements. No more manual spreadsheets.</p>
        </div>
        <div className="flex gap-2 items-center">
          <Select value={billingMonth} onValueChange={handleMonthChange}>
            <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
            <SelectContent>
              {months.map((m) => (
                <SelectItem key={m} value={m}>{formatMonth(m)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={handleGenerateBilling} disabled={!profile} className="gap-2">
            <Download className="h-4 w-4" /> Generate Full Billing Package
          </Button>
        </div>
      </div>

      {!currentSummary && (
        <Button onClick={() => loadBillingSummary(billingMonth)} variant="outline">Load Preview for {formatMonth(billingMonth)}</Button>
      )}

      {currentSummary && (
        <>
          {pendingChangesCount > 0 && (
            <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 flex items-center gap-2">
              <span>⚠️ You have {pendingChangesCount} unsynced local change(s). Billing numbers may be incomplete until you sync.</span>
            </div>
          )}
          <Card className="mb-4">
            <CardContent className="pt-6 grid grid-cols-2 md:grid-cols-5 gap-x-6 gap-y-3 text-sm">
              <div><span className="text-muted-foreground">Cases with activity:</span> <span className="font-semibold">{currentSummary.cases.length}</span></div>
              <div><span className="text-muted-foreground">Total Hours:</span> <span className="font-semibold font-mono">{formatHours(currentSummary.overallTimeHours)}</span></div>
              <div><span className="text-muted-foreground">Time Amount:</span> <span className="font-semibold font-mono">{formatCurrency(currentSummary.overallTimeAmount)}</span></div>
              <div><span className="text-muted-foreground">Expenses:</span> <span className="font-semibold font-mono">{formatCurrency(currentSummary.overallExpenses)}</span></div>
              <div className="font-semibold text-lg md:col-span-1 col-span-2"><span className="text-muted-foreground text-sm block md:inline">Grand Total</span> {formatCurrency(currentSummary.grandTotal)}</div>
            </CardContent>
          </Card>

          <div className="flex justify-between mb-2">
            <div className="text-sm font-medium">Case Breakdown — {formatMonth(billingMonth)}</div>
            <Button variant="outline" size="sm" onClick={exportCSV} className="gap-1.5"><Download className="h-3.5 w-3.5" /> Export CSV</Button>
          </div>

          <div className="rounded-xl border overflow-hidden mb-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Respondent / Case</TableHead>
                  <TableHead>Hours</TableHead>
                  <TableHead>Time $</TableHead>
                  <TableHead>Expenses</TableHead>
                  <TableHead className="text-right">Case Total</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {currentSummary.cases.length === 0 && (
                  <TableRow><TableCell colSpan={6} className="py-8 text-center text-muted-foreground">Nothing to bill for {formatMonth(billingMonth)}. Payroll isn't psychic — go log some work.</TableCell></TableRow>
                )}
                {currentSummary.cases.map((cs: any) => (
                  <TableRow key={cs.caseId}>
                    <TableCell>
                      <div className="font-medium">{cs.respondentName}</div>
                      <div className="text-xs text-muted-foreground">{cs.caseNumber} • {cs.assignmentType}</div>
                    </TableCell>
                    <TableCell className="font-mono">{formatHours(cs.timeTotal)}</TableCell>
                    <TableCell className="font-mono">{formatCurrency(cs.timeAmount)}</TableCell>
                    <TableCell className="font-mono">{formatCurrency(cs.expensesTotal)}</TableCell>
                    <TableCell className="font-semibold text-right font-mono">{formatCurrency(cs.grandTotal)}</TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="outline" onClick={() => handleDownloadCaseInvoice(cs.caseId)}>
                        Download Invoice
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="flex gap-3 justify-end">
            <Button variant="secondary" onClick={exportCSV}>Download CSV</Button>
            <Button onClick={handleGenerateBilling} size="lg" className="gap-2 px-8">
              <Download className="h-4 w-4" /> GENERATE &amp; DOWNLOAD FULL PACKAGE PDF
            </Button>
          </div>

          <p className="text-[10px] text-center text-muted-foreground mt-3">Generating marks all pending time for the month as BILLED. PDFs contain zero jokes.</p>
        </>
      )}
    </div>
  );

  return (
    <div className="min-h-screen flex flex-col bg-zinc-50 dark:bg-zinc-950">
      <AppHeader
        activeView={activeView}
        onViewChange={handleViewChange}
        onOpenSettings={() => setSettingsOpen(true)}
      />

      <main className="flex-1 mx-auto w-full max-w-7xl px-4 sm:px-6 py-8">
        {isLoading && <div className="text-sm text-muted-foreground mb-2">Loading from your device…</div>}

        {activeView === 'dashboard' && <Dashboard />}
        {activeView === 'cases' && <CasesView />}
        {activeView === 'time' && <TimeView />}
        {activeView === 'expenses' && <ExpensesView />}
        {activeView === 'billing' && <BillingView />}
      </main>

      {/* All the dialogs */}
      <CaseDialog
        open={caseDialogOpen}
        onOpenChange={(o) => { setCaseDialogOpen(o); if (!o) setEditingCase(undefined); }}
        existingCase={editingCase}
      />
      <TimeLogDialog
        open={timeDialogOpen}
        onOpenChange={(o) => { setTimeDialogOpen(o); if (!o) { setEditingTime(null); setDefaultTimeCaseId(undefined); } }}
        defaultCaseId={defaultTimeCaseId}
        existingEntry={editingTime}
      />
      <ExpenseDialog
        open={expenseDialogOpen}
        onOpenChange={(o) => { setExpenseDialogOpen(o); if (!o) { setEditingExpense(null); setDefaultExpenseCaseId(undefined); } }}
        defaultCaseId={defaultExpenseCaseId}
        existing={editingExpense}
      />
      <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />

      {/* Footer personality */}
      <footer className="border-t py-4 text-center text-xs text-muted-foreground">
        CaseLog • Offline-first. Your data never leaves this device. • Capture once. Bill correctly.
      </footer>
    </div>
  );
}
