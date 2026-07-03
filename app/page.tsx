'use client';

import React, { useEffect, useState } from 'react';
import { useAppStore, initializeAppData } from '@/stores/useAppStore';
import { announce } from '@/lib/utils';
import { AppHeader, BottomTabBar } from '@/components/AppHeader';
import { CaseDialog } from '@/components/CaseDialog';
import { TimeLogDialog } from '@/components/TimeLogDialog';
import { ExpenseDialog } from '@/components/ExpenseDialog';
import { SettingsDialog } from '@/components/SettingsDialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
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
  LogOut,
  Settings,
} from 'lucide-react';
import { toast } from 'sonner';
import { format, parseISO } from 'date-fns';
import { getRecentMonths, formatMonth, formatCurrency, formatHours, formatDate } from '@/lib/format';
import { generateCaseInvoicePDF, generateFullBillingPackagePDF } from '@/lib/generateInvoice';
import { ASSIGNMENT_TYPES } from '@/lib/constants';
import { buildMonthlyBillingSummary } from '@/lib/db';
import { Case, TimeEntry, Expense, UserProfile } from '@/types';

type View = 'dashboard' | 'cases' | 'time' | 'expenses' | 'billing' | 'account';

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
    assignmentFilter,
    dateFilterField,
    dateFilterFrom,
    dateFilterTo,
    hourlyRateMin,
    hourlyRateMax,
    billingSummary,
    loadAllData,
    loadProfile,
    setSelectedMonth,
    loadBillingSummary,
    generateBilling,
    setSearchTerm,
    setStatusFilter,
    setAssignmentFilter,
    setDateFilter,
    setHourlyRateFilter,
    clearAllFilters,
    getFilteredCases,
    getOpenCases,
    getFilteredOpenCases,
    getCaseById,
    getTimeForCase,
    getExpensesForCase,
    removeCase,
    removeTimeEntry,
    removeExpense,
    editCase,
    pendingChangesCount,
    saveProfile,
    clearLocalData,
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
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

  // Announce loading state for screen readers
  useEffect(() => {
    if (isLoading) {
      announce('Loading from your device…', false);
    }
  }, [isLoading]);
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
  const filteredOpenCases = getFilteredOpenCases();

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

  const handleToggleStatus = async (c: Case) => {
    const newStatus = c.status === 'Open' ? 'Closed' : 'Open';
    try {
      await editCase(c.id, { status: newStatus });
      toast.success(`Case ${newStatus === 'Open' ? 'reopened' : 'closed'}.`);
    } catch (err) {
      toast.error('Failed to update status.');
      console.error(err);
    }
  };

  const handleDeleteCase = async (c: Case) => {
    if (!confirm(`Delete case ${c.caseNumber} and ALL its logs? This cannot be undone.`)) return;
    try {
      await removeCase(c.id);
      toast('Case and associated logs deleted. Poof.');
    } catch (err) {
      toast.error('Failed to delete case. Please try again.');
      console.error(err);
    }
  };

  const handleDeleteTime = async (t: TimeEntry) => {
    if (t.billingStatus === 'Billed') {
      if (!confirm('This entry is already marked Billed. Delete anyway?')) return;
    }
    try {
      await removeTimeEntry(t.id);
      toast('Time entry deleted.');
    } catch (err) {
      toast.error('Failed to delete time entry.');
      console.error(err);
    }
  };

  const handleDeleteExpense = async (e: Expense) => {
    try {
      await removeExpense(e.id);
      toast('Expense deleted.');
    } catch (err) {
      toast.error('Failed to delete expense.');
      console.error(err);
    }
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

    announce('Generating billing package...', false);
    try {
      await generateBilling(billingMonth);

      // Rebuild fresh summary post-mark
      const freshSummary = await buildMonthlyBillingSummary(billingMonth);

      // Generate ONE beautiful professional package PDF
      const doc = generateFullBillingPackagePDF(billingMonth, profile, freshSummary);
      const fileName = `CaseLog_Billing_${billingMonth}.pdf`;
      doc.save(fileName);

      const successMsg = `Billing package generated and downloaded. ${freshSummary.cases.length} case(s) • ${formatCurrency(freshSummary.grandTotal)}`;
      toast.success(successMsg, {
        description: `${freshSummary.cases.length} case(s) • ${formatCurrency(freshSummary.grandTotal)}`,
      });
      announce('Billing package generated and downloaded successfully.', true);

      // Refresh
      await loadAllData();
      loadBillingSummary(billingMonth);
    } catch (err) {
      toast.error('Failed to generate billing. Check console.');
      announce('Failed to generate billing.', true);
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
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="stat-card">
          <div className="text-sm text-muted-foreground">Open Cases</div>
          <div className="text-4xl font-semibold tabular-nums mt-1">{openCases.length}</div>
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
          <Button variant="ghost" className="h-8 text-xs" onClick={() => setActiveView('cases')}>Manage all →</Button>
        </CardHeader>
        <CardContent>
          {openCases.length === 0 ? (
            <div className="empty-state py-8">
              <Button onClick={openNewCase} className="gap-2"><Plus className="h-4 w-4" /> New Case</Button>
            </div>
          ) : (
            <>
              {/* Prominent quick search for open cases on Dashboard */}
              <Input
                placeholder="Search open cases by name or number..."
                className="w-full mb-3 text-base"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              {filteredOpenCases.length === 0 ? (
                <div className="text-center py-4 text-sm text-muted-foreground border rounded-lg">
                  No open cases match your search. <button onClick={() => setSearchTerm('')} className="underline">Clear</button>
                </div>
              ) : (
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {filteredOpenCases.slice(0, 6).map((c) => (
                <div
                  key={c.id}
                  className="log-card flex justify-between gap-3 cursor-pointer hover:bg-muted/50"
                  onClick={() => openEditCase(c)}
                >
                  <div>
                    <div className="font-medium">{c.respondentName}</div>
                    <div className="text-sm text-muted-foreground">{c.caseNumber} • {c.assignmentType}</div>
                    <div className="mt-1 text-xs text-muted-foreground">${c.hourlyRate}/hr</div>
                  </div>
                  <div className="flex flex-col items-end justify-between text-right text-xs">
                    <Badge variant="outline" className="mb-1">{c.status}</Badge>
                    <div className="flex gap-1 mt-auto">
                      <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); quickLogTime(c.id); }} className="h-8 px-2 text-xs">+ Time</Button>
                      <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); quickLogExpense(c.id); }} className="h-8 px-2 text-xs">+ Exp</Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
            </>
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
      <div className="mb-3">
        <Input
          placeholder="Search respondent or case #..."
          className="w-full text-base"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      <div className="flex flex-wrap gap-3 mb-2">
        <Select value={statusFilter} onValueChange={(v: any) => setStatusFilter(v)}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="All">All</SelectItem>
            <SelectItem value="Open">Open</SelectItem>
            <SelectItem value="Closed">Closed</SelectItem>
          </SelectContent>
        </Select>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
          className="gap-1"
        >
          {showAdvancedFilters ? 'Hide' : 'Show'} Advanced Filters
          {(assignmentFilter.length > 0 || dateFilterFrom || dateFilterTo || hourlyRateMin !== '' || hourlyRateMax !== '') && ' •'}
        </Button>
        <Button variant="ghost" size="sm" onClick={() => { setSearchTerm(''); setStatusFilter('All'); clearAllFilters(); setShowAdvancedFilters(false); }}>Clear All</Button>
      </div>

      {showAdvancedFilters && (
        <div className="mb-4 p-3 border rounded-lg bg-muted/30 space-y-3 text-sm">
          {/* Assignment Type chips */}
          <div>
            <div className="text-xs text-muted-foreground mb-1">Assignment Type</div>
            <div className="flex flex-wrap gap-1">
              {ASSIGNMENT_TYPES.map((type) => {
                const active = assignmentFilter.includes(type);
                return (
                  <button
                    key={type}
                    onClick={() => {
                      const newFilter = active
                        ? assignmentFilter.filter(t => t !== type)
                        : [...assignmentFilter, type];
                      setAssignmentFilter(newFilter);
                    }}
                    className={`px-2 py-1 text-xs rounded-full border ${active ? 'bg-primary text-primary-foreground' : 'bg-background'}`}
                  >
                    {type}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Date range */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <div>
              <div className="text-xs text-muted-foreground mb-1">Date Field</div>
              <Select value={dateFilterField} onValueChange={(v: any) => setDateFilter(v, dateFilterFrom, dateFilterTo)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="createdAt">First Contact (Created)</SelectItem>
                  <SelectItem value="updatedAt">Last Updated</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <div className="text-xs text-muted-foreground mb-1">From</div>
              <Input type="date" value={dateFilterFrom} onChange={(e) => setDateFilter(dateFilterField, e.target.value, dateFilterTo)} className="text-sm" />
            </div>
            <div>
              <div className="text-xs text-muted-foreground mb-1">To</div>
              <Input type="date" value={dateFilterTo} onChange={(e) => setDateFilter(dateFilterField, dateFilterFrom, e.target.value)} className="text-sm" />
            </div>
          </div>

          {/* Hourly Rate range */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <div className="text-xs text-muted-foreground mb-1">Min Rate ($)</div>
              <Input
                type="number"
                placeholder="0"
                value={hourlyRateMin}
                onChange={(e) => setHourlyRateFilter(e.target.value === '' ? '' : parseFloat(e.target.value), hourlyRateMax)}
                className="text-sm"
              />
            </div>
            <div>
              <div className="text-xs text-muted-foreground mb-1">Max Rate ($)</div>
              <Input
                type="number"
                placeholder="No max"
                value={hourlyRateMax}
                onChange={(e) => setHourlyRateFilter(hourlyRateMin, e.target.value === '' ? '' : parseFloat(e.target.value))}
                className="text-sm"
              />
            </div>
          </div>
        </div>
      )}

      {/* Mobile: Stack into cards for better experience */}
      <div className="md:hidden space-y-3">
        {filteredCases.length === 0 && (
          <div className="text-center py-8 text-muted-foreground border rounded-xl">No cases match. Maybe create one?</div>
        )}
        {filteredCases.map((c) => (
          <div key={c.id} className="border rounded-xl p-3 bg-card">
            <div className="flex justify-between items-start gap-2">
              <div>
                <div className="font-medium">{c.respondentName}</div>
                <div className="text-xs font-mono text-muted-foreground">{c.caseNumber}</div>
                <div className="text-xs mt-0.5">{c.assignmentType}</div>
              </div>
              <div>
                <button
                  onClick={() => handleToggleStatus(c)}
                  className="focus:outline-none"
                >
                  <Badge
                    className={c.status === 'Open' 
                      ? 'bg-green-600 hover:bg-green-700 text-white cursor-pointer' 
                      : 'bg-gray-500 hover:bg-gray-600 text-white cursor-pointer'
                    }
                  >
                    {c.status}
                  </Badge>
                </button>
                {c.firstTimeBilling && <Badge variant="outline" className="ml-1 text-[10px]">First</Badge>}
              </div>
            </div>
            <div className="mt-1 text-xs font-mono text-right">{formatCurrency(c.hourlyRate)}</div>

            <div className="mt-2 flex gap-1 flex-wrap">
              <Button size="sm" variant="ghost" onClick={() => quickLogTime(c.id)} className="h-8 px-2 text-xs">+ Time</Button>
              <Button size="sm" variant="ghost" onClick={() => quickLogExpense(c.id)} className="h-8 px-2 text-xs">+ Exp</Button>
              <Button size="sm" variant="ghost" onClick={() => openEditCase(c)} className="h-8 px-1.5"><Edit2 className="h-3.5 w-3.5" /></Button>
              <Button size="sm" variant="ghost" className="text-destructive h-8 px-1.5" onClick={() => handleDeleteCase(c)}><Trash2 className="h-3.5 w-3.5" /></Button>
            </div>
          </div>
        ))}
      </div>

      {/* Desktop: Table with horizontal scroll on smaller screens */}
      <div className="hidden md:block rounded-xl border overflow-x-auto">
        <Table className="min-w-full">
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
                    <button
                      onClick={() => handleToggleStatus(c)}
                      className="focus:outline-none"
                    >
                      <Badge 
                        className={c.status === 'Open' 
                          ? 'bg-green-600 hover:bg-green-700 text-white cursor-pointer' 
                          : 'bg-gray-500 hover:bg-gray-600 text-white cursor-pointer'
                        }
                      >
                        {c.status}
                      </Badge>
                    </button>
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
      <p className="text-[10px] mt-2 text-muted-foreground">Deleting a case removes its time and expense records too. Tap status badge to toggle Open/Closed.</p>
    </div>
  );

  // Time / Expense list views (combined for brevity)
  const TimeView = () => (
    <div>
      <div className="flex justify-between items-center mb-4">
        <div><h2 className="section-title">Time Entries</h2><p className="text-sm text-muted-foreground">All time ever logged. Edit or delete with care.</p></div>
        <Button onClick={() => quickLogTime()}><Plus className="mr-2 h-4 w-4" /> New Time Entry</Button>
      </div>
      <div className="rounded-xl border overflow-x-auto">
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
      <div className="rounded-xl border overflow-x-auto">
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
      <div>
        <h2 className="section-title text-2xl">Billing Center</h2>
        <p className="text-sm text-muted-foreground mt-1">Select a month to preview activity, then generate a complete PDF package ready for the Alaska Court System.</p>
      </div>

      {/* Month selector + primary actions - mobile first */}
      <div className="rounded-xl border bg-card p-4 space-y-3 mb-2">
        <div>
          <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1.5">Billing Month</div>
          <Select value={billingMonth} onValueChange={handleMonthChange}>
            <SelectTrigger className="w-full h-12 text-base">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {months.map((m) => (
                <SelectItem key={m} value={m}>{formatMonth(m)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button 
            onClick={() => loadBillingSummary(billingMonth)} 
            variant="outline" 
            className="h-11 flex-1 text-base"
          >
            Refresh Preview
          </Button>
          <Button 
            onClick={handleGenerateBilling} 
            disabled={!profile} 
            className="h-11 flex-1 gap-2 text-base"
          >
            <Download className="h-4 w-4" /> Generate Full Package
          </Button>
        </div>
      </div>

      {!currentSummary && (
        <div className="text-center py-4 text-sm text-muted-foreground">
          Select a month above to load the billing preview.
        </div>
      )}

      <div className="space-y-5">
      {currentSummary && (
        <>
          {pendingChangesCount > 0 && (
            <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              ⚠️ You have {pendingChangesCount} unsynced local change(s). Billing numbers may be incomplete until you sync.
            </div>
          )}
          {/* Summary stats - mobile friendly cards */}
          <div>
            <div className="text-sm font-medium mb-2">Summary for {formatMonth(billingMonth)}</div>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg border bg-muted/30 p-3">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Cases</div>
                <div className="text-xl font-semibold tabular-nums mt-0.5">{currentSummary.cases.length}</div>
              </div>
              <div className="rounded-lg border bg-muted/30 p-3">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Total Hours</div>
                <div className="text-xl font-semibold font-mono tabular-nums mt-0.5">{formatHours(currentSummary.overallTimeHours)}</div>
              </div>
              <div className="rounded-lg border bg-muted/30 p-3">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Time Amount</div>
                <div className="text-xl font-semibold font-mono tabular-nums mt-0.5">{formatCurrency(currentSummary.overallTimeAmount)}</div>
              </div>
              <div className="rounded-lg border bg-muted/30 p-3">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Expenses</div>
                <div className="text-xl font-semibold font-mono tabular-nums mt-0.5">{formatCurrency(currentSummary.overallExpenses)}</div>
              </div>
              <div className="col-span-2 rounded-lg border bg-primary/5 p-3 flex items-center justify-between">
                <div className="text-sm text-muted-foreground">Grand Total</div>
                <div className="text-xl sm:text-2xl font-semibold font-mono tabular-nums">{formatCurrency(currentSummary.grandTotal)}</div>
              </div>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="text-sm font-medium">Case Breakdown</div>
              <Button variant="outline" size="sm" onClick={exportCSV} className="gap-1.5 h-9"><Download className="h-3.5 w-3.5" /> Export CSV</Button>
            </div>

            {/* Mobile: stacked cards for readability on portrait */}
            <div className="md:hidden space-y-3">
              {currentSummary.cases.length === 0 && (
                <div className="rounded-lg border p-6 text-center text-sm text-muted-foreground">
                  No activity logged for {formatMonth(billingMonth)}. Log time or expenses to generate a statement.
                </div>
              )}
              {currentSummary.cases.map((cs: any) => (
                <div key={cs.caseId} className="rounded-lg border p-3 space-y-2">
                  <div className="flex justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-medium text-sm leading-tight">{cs.respondentName}</div>
                      <div className="text-[11px] text-muted-foreground truncate">{cs.caseNumber} • {cs.assignmentType}</div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="font-semibold tabular-nums font-mono text-sm">{formatCurrency(cs.grandTotal)}</div>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-x-2 gap-y-1 text-xs pt-2 border-t">
                    <div>
                      <span className="text-muted-foreground">Hours</span><br />
                      <span className="font-mono font-medium">{formatHours(cs.timeTotal)}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Time</span><br />
                      <span className="font-mono font-medium">{formatCurrency(cs.timeAmount)}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Expenses</span><br />
                      <span className="font-mono font-medium">{formatCurrency(cs.expensesTotal)}</span>
                    </div>
                  </div>

                  <Button 
                    size="sm" 
                    variant="outline" 
                    className="w-full mt-1 h-9" 
                    onClick={() => handleDownloadCaseInvoice(cs.caseId)}
                  >
                    Download Invoice PDF
                  </Button>
                </div>
              ))}
            </div>

            {/* Desktop table */}
            <div className="hidden md:block rounded-xl border overflow-x-auto">
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
                    <TableRow><TableCell colSpan={6} className="py-8 text-center text-muted-foreground">No activity logged for this month.</TableCell></TableRow>
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
          </div>

          {/* Bottom actions - large tappable buttons on mobile */}
          <div className="pt-1 space-y-2 sm:space-y-0 sm:flex sm:gap-3 sm:justify-end">
            <Button 
              variant="secondary" 
              onClick={exportCSV}
              className="w-full sm:w-auto h-11 text-base"
            >
              Download CSV
            </Button>
            <Button 
              onClick={handleGenerateBilling} 
              size="lg" 
              className="w-full sm:w-auto gap-2 px-6 h-11 text-base"
            >
              <Download className="h-4 w-4" /> <span className="hidden sm:inline">GENERATE &amp; DOWNLOAD FULL PACKAGE</span><span className="sm:hidden">Generate Package</span>
            </Button>
          </div>

          <p className="text-xs text-center sm:text-right text-muted-foreground mt-2">Generating the package marks all pending entries for the month as BILLED.</p>
        </>
      )}
      </div>
    </div>
  );

  const AccountView = () => {
    const [editForm, setEditForm] = useState<Partial<UserProfile>>({});
    const [isEditing, setIsEditing] = useState(false);

    useEffect(() => {
      if (profile) {
        setEditForm({ ...profile });
      }
    }, [profile]);

    const handleSaveProfile = async () => {
      try {
        await saveProfile(editForm);
        toast.success('Profile updated.');
        setIsEditing(false);
      } catch (e) {
        toast.error('Failed to save profile.');
      }
    };

    const handleCancelEdit = () => {
      if (profile) setEditForm({ ...profile });
      setIsEditing(false);
    };

    const handleLogout = async () => {
      if (!confirm('Logout and clear all local data? This cannot be undone.')) return;
      await clearLocalData();
      toast('Logged out. All data cleared.');
    };

    const displayName = profile?.name || 'Court Visitor';
    const initials = displayName.split(/\s+/).map(n => n[0]).join('').toUpperCase().slice(0, 2) || 'CV';

    return (
      <div className="space-y-6 max-w-md mx-auto">
        <div className="flex items-center gap-4">
          <div className="h-16 w-16 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-2xl font-bold ring-2 ring-primary/20">
            {initials}
          </div>
          <div>
            <div className="text-2xl font-semibold">{displayName}</div>
            <div className="text-muted-foreground">{profile?.email || '—'}</div>
            <div className="text-sm text-muted-foreground mt-0.5">{profile?.title || 'Court Visitor'}</div>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Profile</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {[
              { label: 'Name', key: 'name' as const, value: editForm.name || '' },
              { label: 'Email', key: 'email' as const, value: editForm.email || '' },
              { label: 'Phone', key: 'phone' as const, value: editForm.phone || '' },
              { label: 'Court Visitor ID', key: 'courtVisitorId' as const, value: editForm.courtVisitorId || '' },
              { label: 'Organization', key: 'organization' as const, value: editForm.organization || '' },
            ].map(({ label, key, value }) => (
              <div key={key}>
                <Label>{label}</Label>
                {isEditing ? (
                  <Input
                    value={value}
                    onChange={(e) => setEditForm({ ...editForm, [key]: e.target.value })}
                    className="mt-1.5"
                  />
                ) : (
                  <div className="mt-1.5 text-sm py-2 px-3 border rounded-md bg-muted/30">{value || '—'}</div>
                )}
              </div>
            ))}
          </CardContent>
          <CardFooter className="flex gap-2">
            {isEditing ? (
              <>
                <Button onClick={handleSaveProfile} className="flex-1">Save Changes</Button>
                <Button variant="outline" onClick={handleCancelEdit} className="flex-1">Cancel</Button>
              </>
            ) : (
              <Button onClick={() => setIsEditing(true)} className="flex-1">Edit Profile</Button>
            )}
          </CardFooter>
        </Card>

        <div className="space-y-3">
          <Button variant="outline" className="w-full justify-start gap-2" onClick={() => setSettingsOpen(true)}>
            <Settings className="h-4 w-4" /> Settings
          </Button>
          <Button variant="destructive" className="w-full justify-start gap-2" onClick={handleLogout}>
            <LogOut className="h-4 w-4" /> Logout &amp; Clear Data
          </Button>
        </div>

        <p className="text-xs text-center text-muted-foreground pt-4">
          Your data is stored locally on this device.
        </p>
      </div>
    );
  };

  return (
    <div className="min-h-screen flex flex-col bg-zinc-50 dark:bg-zinc-950">
      <AppHeader
        onOpenSettings={() => setSettingsOpen(true)}
      />

      <main className="flex-1 mx-auto w-full max-w-7xl px-4 sm:px-6 py-8 pb-16">
        {isLoading && <div className="text-sm text-muted-foreground mb-2">Loading from your device…</div>}

        {activeView === 'dashboard' && <Dashboard />}
        {activeView === 'cases' && <CasesView />}
        {activeView === 'time' && <TimeView />}
        {activeView === 'expenses' && <ExpensesView />}
        {activeView === 'billing' && <BillingView />}
        {activeView === 'account' && <AccountView />}
      </main>

      <BottomTabBar activeView={activeView} onViewChange={handleViewChange} />

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
    </div>
  );
}
