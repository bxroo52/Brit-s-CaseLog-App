'use client';

import React, { useEffect, useState, useRef, memo } from 'react';
import { useAppStore, initializeAppData } from '@/stores/useAppStore';

import { announce } from '@/lib/utils';
import { AppHeader, BottomTabBar } from '@/components/AppHeader';
import NewCaseForm from '@/components/NewCaseForm';
import OpenCasesSection from '@/components/OpenCasesSection';
import ProfileModal from '@/app/components/ProfileModal';
import LogTimeModal from '@/app/components/LogTimeModal';
import NewCaseModal from '@/app/components/NewCaseModal';
import ActivityRatesModal from '@/app/components/ActivityRatesModal';
import TimeEntriesRealtime from '@/app/components/TimeEntriesRealtime';
import OpenCasesRealtime from '@/app/components/OpenCasesRealtime';
import DashboardStatsRealtime from '@/app/components/DashboardStatsRealtime';
import { generateBillingSpreadsheet } from '@/lib/generateBillingSpreadsheet';
import { TimeLogDialog } from '@/components/TimeLogDialog';
import { ExpenseDialog } from '@/components/ExpenseDialog';
import LogExpenseModal from '@/app/components/LogExpenseModal';
import ExpensesRealtime from '@/app/components/ExpensesRealtime';
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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
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
  ChevronRight,
  FileText,
  Loader2,
} from 'lucide-react';
import { toast } from '@/app/components/Toast';
import { format, parseISO } from 'date-fns';
import { getRecentMonths, formatMonth, formatCurrency, formatHours, formatDate } from '@/lib/format';
import { generateCaseInvoicePDF, generateFullBillingPackagePDF } from '@/lib/generateInvoice';
import { ASSIGNMENT_TYPES } from '@/lib/constants';
import { buildMonthlyBillingSummary } from '@/lib/db';
import { isSupabaseConfigured } from '@/lib/supabase';
import { Case, TimeEntry, Expense, UserProfile, NewCaseFormData } from '@/types';

type View = 'dashboard' | 'cases' | 'time' | 'expenses' | 'billing' | 'account';

interface LoginScreenProps {
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, userId?: string) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  isSupabaseConfigured: boolean;
}

const LoginScreen = memo<LoginScreenProps>(({ signIn, signUp, resetPassword, isSupabaseConfigured }) => {
  const [authView, setAuthView] = useState<'login' | 'signup' | 'reset'>('login');
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authUserId, setAuthUserId] = useState('');
  const [authError, setAuthError] = useState('');
  const [authLoading, setAuthLoading] = useState(false);

  const emailInputRef = useRef<HTMLInputElement>(null);

  const clearAuthError = () => {
    if (authError) setAuthError('');
  };

  // Gentle nudge only; Safari handles keyboard + scroll for focused inputs.
  // Aggressive scroll/center can dismiss keyboard on iOS.
  const scrollInputIntoView = (e: React.FocusEvent<HTMLInputElement>) => {
    setTimeout(() => {
      try {
        e.currentTarget.scrollIntoView({ behavior: 'auto', block: 'nearest' });
      } catch {}
    }, 380);
  };

  const handleInputFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    scrollInputIntoView(e);
  };

  const handleInputBlur = (_e: React.FocusEvent<HTMLInputElement>) => {
    // Explicit onBlur present for focus management requirements on mobile Safari.
    // Do nothing here to avoid stealing or forcing layout during typing.
  };

  // Careful focus only on authView switch (login <-> signup), never steal during typing.
  // No autoFocus prop (problematic on iOS Safari for keyboard stability).
  useEffect(() => {
    if (authView === 'login' || authView === 'signup') {
      const timer = setTimeout(() => {
        // Only auto focus when no input is currently focused (e.g. after view switch by tap)
        if (!document.activeElement || document.activeElement.tagName !== 'INPUT') {
          emailInputRef.current?.focus();
        }
      }, 220);
      return () => clearTimeout(timer);
    }
  }, [authView]);

  const handleSignIn = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!authEmail || !authPassword) {
      setAuthError('Email and password required.');
      return;
    }
    setAuthLoading(true);
    setAuthError('');
    try {
      await signIn(authEmail, authPassword);
    } catch (e: any) {
      setAuthError(e.message || 'Login failed.');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleSignUp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!authEmail || !authPassword) {
      setAuthError('Email and password required.');
      return;
    }
    setAuthLoading(true);
    setAuthError('');
    try {
      await signUp(authEmail, authPassword, authUserId || undefined);
      // Clear password (security) and optional UserID.
      // Sign-up is instant (email confirmation disabled in Supabase config).
      // The LoginScreen is replaced immediately by the main app on success.
      setAuthPassword('');
      setAuthUserId('');
    } catch (e: any) {
      let msg = e.message || 'Sign up failed.';
      const lower = msg.toLowerCase();
      if (lower.includes('rate limit') || lower.includes('too many') || lower.includes('email rate')) {
        msg = 'Too many attempts. Please wait a moment and try again.';
      }
      setAuthError(msg);
    } finally {
      setAuthLoading(false);
    }
  };

  const handleResetPassword = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!authEmail) {
      setAuthError('Email required.');
      return;
    }
    setAuthLoading(true);
    setAuthError('');
    try {
      await resetPassword(authEmail);
      setAuthView('login');
      setAuthEmail('');
      toast.success('Check your email for reset link.');
    } catch (e: any) {
      setAuthError(e.message || 'Failed to send reset.');
    } finally {
      setAuthLoading(false);
    }
  };

  return (
    <div
      className="min-h-dvh bg-zinc-950"
      style={{ minHeight: '100dvh' }}
    >
      <div
        className="px-4"
        style={{
          paddingTop: 'max(3.5rem, env(safe-area-inset-top))',
          paddingBottom: 'max(2.5rem, env(safe-area-inset-bottom))'
        }}
      >
        <div className="max-w-sm mx-auto space-y-6">
          {/* Logo and header - stays near top, no centering that shifts on keyboard */}
          <div className="text-center">
            <div className="mx-auto h-12 w-12 rounded-xl bg-foreground text-background flex items-center justify-center mb-4">
              <FileText className="h-6 w-6" />
            </div>
            <h1 className="text-3xl font-semibold tracking-tighter">CaseLog</h1>
            <p className="text-muted-foreground mt-1">Court Visitor Billing</p>
          </div>

          {/* Form area - simple padding, document can scroll with keyboard */}
          <Card>
            <CardHeader>
              <CardTitle className="text-center">
                {authView === 'login' && 'Log in'}
                {authView === 'signup' && 'Sign up'}
                {authView === 'reset' && 'Reset Password'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form
                onSubmit={authView === 'login' ? handleSignIn : authView === 'signup' ? handleSignUp : handleResetPassword}
                className="space-y-4"
              >
                <div>
                  <Label htmlFor="email">Email</Label>
                  <input
                    id="email"
                    ref={emailInputRef}
                    type="email"
                    value={authEmail}
                    onChange={(e) => { setAuthEmail(e.target.value); clearAuthError(); }}
                    onFocus={handleInputFocus}
                    onBlur={handleInputBlur}
                    placeholder="you@example.com"
                    className="mt-1.5 h-11 w-full min-w-0 rounded-lg border border-input bg-transparent px-3 py-2 text-base outline-none transition-colors focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40 bg-input/30"
                    required
                    autoCapitalize="none"
                    autoCorrect="off"
                    autoComplete="email"
                    inputMode="email"
                    enterKeyHint="next"
                    spellCheck={false}
                  />
                </div>

                {(authView === 'login' || authView === 'signup') && (
                  <div>
                    <Label htmlFor="password">Password</Label>
                    <input
                      id="password"
                      type="password"
                      value={authPassword}
                      onChange={(e) => { setAuthPassword(e.target.value); clearAuthError(); }}
                      onFocus={handleInputFocus}
                      onBlur={handleInputBlur}
                      placeholder="••••••••"
                      className="mt-1.5 h-11 w-full min-w-0 rounded-lg border border-input bg-transparent px-3 py-2 text-base outline-none transition-colors focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40 bg-input/30"
                      required
                      autoComplete={authView === 'signup' ? 'new-password' : 'current-password'}
                      enterKeyHint="done"
                      spellCheck={false}
                    />
                  </div>
                )}

                {authView === 'signup' && (
                  <div>
                    <Label htmlFor="userid">Optional UserID / Name</Label>
                    <input
                      id="userid"
                      value={authUserId}
                      onChange={(e) => { setAuthUserId(e.target.value); clearAuthError(); }}
                      onFocus={handleInputFocus}
                      onBlur={handleInputBlur}
                      placeholder="e.g. Visitor-123"
                      className="mt-1.5 h-11 w-full min-w-0 rounded-lg border border-input bg-transparent px-3 py-2 text-base outline-none transition-colors focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40 bg-input/30"
                      autoCapitalize="none"
                      spellCheck={false}
                    />
                  </div>
                )}

                {/* Reserved space prevents layout shift when error appears/disappears (critical for iOS keyboard stability) */}
                <div className="min-h-[2.5rem]">
                  {authError && (
                    <p className="text-sm text-destructive bg-destructive/10 p-2 rounded">{authError}</p>
                  )}
                </div>

                <Button
                  type="submit"
                  className="w-full h-11 text-base"
                  disabled={authLoading}
                  aria-busy={authLoading}
                >
                  {authLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {authView === 'login' ? 'Logging in...' :
                        authView === 'signup' ? 'Creating account...' : 'Sending link...'}
                    </>
                  ) : (
                    authView === 'login' ? 'Log In' :
                      authView === 'signup' ? 'Sign Up' : 'Send Reset Link'
                  )}
                </Button>
              </form>
            </CardContent>
            <CardFooter className="flex flex-col gap-2 text-sm">
              {authView === 'login' && (
                <>
                  <button
                    onClick={() => { setAuthView('signup'); setAuthError(''); }}
                    className="text-primary hover:underline active:opacity-70"
                  >
                    Don't have an account? Sign up
                  </button>
                  <button
                    onClick={() => { setAuthView('reset'); setAuthError(''); }}
                    className="text-muted-foreground hover:underline active:opacity-70"
                  >
                    Forgot password?
                  </button>
                </>
              )}
              {(authView === 'signup' || authView === 'reset') && (
                <button
                  onClick={() => { setAuthView('login'); setAuthError(''); }}
                  className="text-primary hover:underline active:opacity-70"
                >
                  Back to login
                </button>
              )}
              {authView === 'reset' && (
                <p className="text-xs text-muted-foreground text-center pt-2">
                  Check your email for the reset link.
                </p>
              )}
            </CardFooter>
          </Card>

          <p className="text-xs text-center text-muted-foreground">
            {isSupabaseConfigured ? 'Secured with Supabase Auth' : 'Supabase not configured (demo mode)'}
          </p>
        </div>
      </div>
    </div>
  );
});

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
    addCase,
    addTimeEntry,
    editCase,
    pendingChangesCount,
    clearLocalData,
    debugInspectDB,
    debugClearDB,
    user,
    isAuthenticated,
    signUp,
    signIn,
    signOut,
    resetPassword,
    notificationsEnabled,
    setNotificationsEnabled,
    activityRates,
    rateChangeLogs,
    loadActivityRates,
    loadRateChangeLogs,
  } = useAppStore();

  const [activeView, setActiveView] = useState<View>('dashboard');

  const handleSignOut = async () => {
    await signOut();
    setActiveView('dashboard');
  };

  // Account tab handlers - make items fully functional
  const openAccountModal = (title: string, content: React.ReactNode) => {
    setAccountModalTitle(title);
    setAccountModalContent(content);
    setAccountModalOpen(true);
  };

  const handleAccountItem = (label: string, subtext?: string) => {
    if (label === 'Sign out') {
      handleSignOut();
      return;
    }

    if (label === 'Profile') {
      setProfileModalOpen(true);
      return;
    }

    switch (label) {
      case 'Activity Rates':
        setActivityRatesOpen(true);
        return;
      case 'Notifications': {
        const newEnabled = !notificationsEnabled;
        if (newEnabled) {
          if (typeof Notification !== 'undefined') {
            Notification.requestPermission().then((perm) => {
              if (perm === 'granted') {
                setNotificationsEnabled(true);
                toast.success('Notifications enabled. You will receive alerts for important updates.');
                // Demo notification
                new Notification('CaseLog', { body: 'Notifications are now on! (demo)' });
              } else {
                toast.error('Notification permission denied. Enable in browser settings.');
              }
            });
          } else {
            setNotificationsEnabled(true);
            toast.success('Notifications enabled (browser does not support native notifications).');
          }
        } else {
          setNotificationsEnabled(false);
          toast('Notifications disabled.');
        }
        return;
      }
      case 'Siri Shortcuts':
        openAccountModal(
          'Siri Shortcuts',
          <div className="space-y-3 text-sm">
            <p>Siri Shortcuts integration is coming soon.</p>
            <p>You'll be able to quickly log time or view open cases using voice or the Shortcuts app on iOS.</p>
            <p className="text-xs text-muted-foreground">In the meantime, try the PWA on your home screen for fast access.</p>
            <Button variant="outline" size="sm" onClick={() => window.open('https://support.apple.com/guide/shortcuts/welcome/ios', '_blank')}>
              Learn about iOS Shortcuts
            </Button>
          </div>
        );
        return;
      case 'Integrations':
        openAccountModal(
          'Integrations',
          <div className="space-y-3 text-sm">
            <p>Future integrations coming soon:</p>
            <ul className="list-disc pl-5 text-muted-foreground">
              <li>Google Calendar</li>
              <li>Outlook / Microsoft 365</li>
              <li>QuickBooks / Xero export</li>
              <li>Zapier / webhooks</li>
            </ul>
            <p className="text-xs">Check back after updates or email us your ideas.</p>
          </div>
        );
        return;
      case 'Home Screen widgets':
        openAccountModal(
          'Home Screen Widgets',
          <div className="space-y-3 text-sm">
            <p>To add CaseLog widgets on iOS:</p>
            <ol className="list-decimal pl-5 space-y-1 text-muted-foreground">
              <li>Long-press your home screen</li>
              <li>Tap the + button (top left)</li>
              <li>Search for CaseLog (once added as PWA)</li>
              <li>Choose widget size and add</li>
            </ol>
            <p className="text-xs">On Android: long-press home → Widgets → look for PWA widgets if supported by your launcher.</p>
            <p>Widget support coming in a future update.</p>
          </div>
        );
        return;
      case 'Email Support':
        const subject = encodeURIComponent('CaseLog Support Request');
        const body = encodeURIComponent('Hi CaseLog team,\n\n[Describe your issue or feedback here]\n\nApp version: 0.1.0\nDevice: [browser/OS]');
        window.location.href = `mailto:support@caselog.example?subject=${subject}&body=${body}`;
        toast.success('Opening your email app...');
        return;
      case 'Advanced':
        openAccountModal(
          'Advanced (Debug)',
          <div className="space-y-3 text-sm">
            <p>Temporary debug tools for IndexedDB / schema issues:</p>
            <div className="flex flex-col gap-2 pt-2">
              <Button size="sm" variant="outline" onClick={async () => { await debugInspectDB?.(); }}>Inspect IndexedDB (logs + toast)</Button>
              <Button size="sm" variant="destructive" onClick={async () => { await debugClearDB?.(); }}>Clear Entire IndexedDB (reloads app)</Button>
            </div>
            <p className="text-xs text-muted-foreground pt-2">Also available as console: window.__caseLogDebug?.inspectDB()</p>
            <hr className="my-2 border-zinc-800" />
            <p>Future options (not yet implemented):</p>
            <ul className="list-disc pl-5">
              <li>Data export / import (CSV, JSON, full backup)</li>
              <li>Conflict resolution for sync</li>
              <li>Custom fields for cases</li>
              <li>Multi-user team accounts (Supabase)</li>
            </ul>
            <p className="text-xs text-muted-foreground">For now, use Settings for profile, or the main app features.</p>
          </div>
        );
        return;
      case 'Help Center':
        openAccountModal(
          'Help Center',
          <div className="space-y-4 text-sm">
            <div>
              <div className="font-medium mb-1">Frequently Asked Questions</div>
              <div className="space-y-2 text-muted-foreground">
                <p><strong>Q: Does it work offline?</strong><br />Yes! All logging, cases, and billing PDFs are fully offline. Sync when online.</p>
                <p><strong>Q: How do I bill the court?</strong><br />Log time/expenses against cases → Billing tab → Generate full package PDF.</p>
                <p><strong>Q: Can multiple people use one device?</strong><br />Yes, each login uses their own Supabase user data (with user isolation).</p>
              </div>
            </div>
            <Button size="sm" variant="outline" onClick={() => toast.info('More help docs coming soon.')}>
              View full documentation
            </Button>
          </div>
        );
        return;
      case 'Refer a friend':
        if (navigator.share) {
          navigator.share({
            title: 'CaseLog — Court Visitor Billing',
            text: 'Check out CaseLog for simple offline-first court billing.',
            url: window.location.origin,
          }).then(() => toast.success('Thanks for sharing!')).catch(() => {});
        } else {
          // fallback
          navigator.clipboard?.writeText(window.location.origin);
          toast.success('Link copied to clipboard (share manually).');
        }
        return;
      case 'Rate in the App Store':
        // Since it's a PWA / web app, link to a placeholder App Store page or review prompt
        const appStoreUrl = 'https://apps.apple.com/app/caselog/id000000000'; // placeholder
        window.open(appStoreUrl, '_blank');
        toast.info('Thanks! Rating helps us improve (this is a demo link).');
        return;
      case 'Follow CaseLog':
        window.open('https://x.com', '_blank'); // or a real handle, placeholder
        toast.info('Opening follow page...');
        return;
      case 'Acknowledgements':
        openAccountModal(
          'Acknowledgements',
          <div className="space-y-3 text-sm max-h-[50dvh] overflow-auto">
            <p>Built with ❤️ using these open source projects:</p>
            <ul className="text-xs text-muted-foreground space-y-1 list-disc pl-5">
              <li>Next.js (React framework)</li>
              <li>React 19 + TypeScript</li>
              <li>Tailwind CSS + shadcn/ui</li>
              <li>Dexie.js (IndexedDB)</li>
              <li>Supabase (auth + optional sync)</li>

              <li>date-fns, lucide-react, sonner, jsPDF</li>
              <li>Zustand (state)</li>
              <li>PWA APIs, Service Worker</li>
            </ul>
            <p className="text-[10px]">Thanks to all the maintainers and the Alaska Court System community for inspiration.</p>
          </div>
        );
        return;
      case 'Version':
        openAccountModal(
          'App Version',
          <div className="text-sm">
            <p><strong>CaseLog</strong> version 0.1.0</p>
            <p className="text-muted-foreground mt-2">Built for court visitors. Offline-first. Sync optional.</p>
            <p className="text-[10px] mt-3">Last updated: July 2026</p>
            <p className="text-[10px]">Running on {typeof navigator !== 'undefined' ? navigator.userAgent.split(' ').slice(0,3).join(' ') : 'web'}</p>
          </div>
        );
        return;
      default:
        toast.info(`${label} tapped`);
    }
  };

  const [caseDialogOpen, setCaseDialogOpen] = useState(false);
  const [editingCase, setEditingCase] = useState<Case | undefined>();
  const [timeDialogOpen, setTimeDialogOpen] = useState(false);
  const [defaultTimeCaseId, setDefaultTimeCaseId] = useState<string | undefined>();
  const [editingTime, setEditingTime] = useState<any>(null);
  const [expenseDialogOpen, setExpenseDialogOpen] = useState(false);
  const [defaultExpenseCaseId, setDefaultExpenseCaseId] = useState<string | undefined>();
  const [logExpenseOpen, setLogExpenseOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<any>(null);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

  // Announce loading state for screen readers
  useEffect(() => {
    if (isLoading) {
      announce('Loading from your device…', false);
    }
  }, [isLoading]);
  const [logTimeOpen, setLogTimeOpen] = useState(false);
  const [logTimeCaseId, setLogTimeCaseId] = useState<string | undefined>();
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [optimisticEntries, setOptimisticEntries] = useState<any[]>([]);
  const [optimisticExpenses, setOptimisticExpenses] = useState<any[]>([]);
  const [newCaseModalOpen, setNewCaseModalOpen] = useState(false);

  const [billingMonth, setBillingMonth] = useState(selectedMonth);

  // For Account tab modals / info screens
  const [accountModalOpen, setAccountModalOpen] = useState(false);
  const [accountModalTitle, setAccountModalTitle] = useState('');
  const [accountModalContent, setAccountModalContent] = useState<React.ReactNode>(null);

  // Dedicated Activity Rates dialog
  const [activityRatesOpen, setActivityRatesOpen] = useState(false);

  // Case time entries modal (tappable case cards on Cases tab)
  const [caseEntriesOpen, setCaseEntriesOpen] = useState(false);
  const [selectedCaseForEntries, setSelectedCaseForEntries] = useState<Case | null>(null);

  // Expose debug for console (temp for IndexedDB exploration)
  if (typeof window !== 'undefined') {
    (window as any).__caseLogDebug = {
      inspectDB: () => debugInspectDB?.(),
      clearDB: () => debugClearDB?.(),
    };
  }

  // Helper: robust first name extraction from profile.name (handles "First Last", "Last, First", etc.)
  const getFirstName = (fullName?: string | null): string | null => {
    if (!fullName || typeof fullName !== 'string') return null;
    const trimmed = fullName.trim();
    if (!trimmed) return null;
    if (trimmed.includes(',')) {
      // "Last, First" or similar -> prefer part after comma
      const parts = trimmed.split(',');
      const candidate = (parts[1] || parts[0]).trim();
      return candidate || null;
    }
    // "First Last" or single token
    return trimmed.split(/\s+/)[0] || null;
  };

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

  // Open log with case preselected (using new bottom-sheet form)
  const quickLogTime = async (caseId?: string) => {
    try { await loadAllData(); } catch {}
    const afterLoadOpen = (getOpenCases ? getOpenCases() : []).length;
    console.log('[page] quickLogTime after await loadAllData, openCases count=', afterLoadOpen);
    setLogTimeCaseId(caseId);
    setLogTimeOpen(true);
  };

  const quickLogExpense = async (caseId?: string) => {
    // Ensure cases are loaded BEFORE opening the dialog. Use the store's getOpenCases for the reliable open list.
    try {
      await loadAllData();
    } catch {}
    const afterLoadOpen = (getOpenCases ? getOpenCases() : []).length;
    console.log('[page] quickLogExpense after await loadAllData, openCases count=', afterLoadOpen);
    setLogExpenseOpen(true);
  };

  const openEditCase = (c: Case) => {
    setEditingCase(c);
    setCaseDialogOpen(true);
  };

  const openNewCase = () => {
    setNewCaseModalOpen(true);
  };

  const openCaseEntries = (caseId: string) => {
    const c = getCaseById(caseId);
    setSelectedCaseForEntries(c || null);
    setCaseEntriesOpen(true);
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

  // Handler for NewCaseForm (matches the onSubmit pattern from spec)
  const handleCaseFormSubmit = async (formData: NewCaseFormData) => {
    if (editingCase) {
      await editCase(editingCase.id, {
        ...formData,
        hourlyRate: editingCase.hourlyRate || 0,
      } as any);
    } else {
      await addCase({
        ...formData,
        hourlyRate: 0,
      } as any);
    }
  };

  const handleDeleteTime = async (t: TimeEntry) => {
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

  const editExpenseEntry = async (e: Expense) => {
    setEditingExpense(e);
    setDefaultExpenseCaseId(undefined);
    // Ensure cases loaded before ExpenseDialog opens its case dropdown. Log count using same getter.
    try {
      await loadAllData();
    } catch {}
    const afterLoadOpen = (getOpenCases ? getOpenCases() : []).length;
    console.log('[page] editExpenseEntry after await loadAllData, openCases count=', afterLoadOpen);
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

      // Rebuild fresh summary (entries remain Pending)
      const currentUserId = user?.id;
      const freshSummary = await buildMonthlyBillingSummary(billingMonth, currentUserId);

      // Generate ONE beautiful professional package PDF
      const doc = generateFullBillingPackagePDF(billingMonth, profile, freshSummary);
      const fileName = `CaseLog_Billing_${billingMonth}.pdf`;
      doc.save(fileName);

      const successMsg = `Billing package generated and downloaded. ${freshSummary.cases.length} case(s) • ${formatCurrency(freshSummary.grandTotal)}`;
      toast(successMsg, 'success');
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

    const safeName = `${cs.respondentFirstName || ''}_${cs.respondentLastName || ''}`.replace(/\s+/g, '_');
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
      csv += `Time,${t.date},${c?.caseNumber || ''},${`${c?.respondentFirstName} ${c?.respondentLastName}` || ''},${t.activityType},${t.billableHoursRounded},${t.activityRate ?? t.hourlyRate},${t.totalAmount ?? t.amount},${t.billingStatus},"${t.description.replace(/"/g, '""')}"\n`;
    });
    monthExp.forEach((e) => {
      const c = getCaseById(e.caseId);
      csv += `Expense,${e.date},${c?.caseNumber || ''},${`${c?.respondentFirstName} ${c?.respondentLastName}` || ''},${e.expenseType},,${e.amount},,,"${e.description.replace(/"/g, '""')}"\n`;
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
      {/* Greeting - photo above, both centered */}
      <div className="flex flex-col items-center gap-2">
        {profile?.photoDataUrl ? (
          <img
            src={profile.photoDataUrl}
            alt="Profile"
            className="w-11 h-11 rounded-full object-cover border border-zinc-800 flex-shrink-0"
          />
        ) : (
          <div className="w-11 h-11 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center text-lg flex-shrink-0">
            {profile?.name ? profile.name.split(/\s+/).map((w: string) => w[0]).slice(0, 2).join('').toUpperCase() : '👤'}
          </div>
        )}
        <h1 className="text-3xl font-semibold tracking-tighter text-center">
          {(() => {
            const first = getFirstName(profile?.name);
            return first ? `Welcome back, ${first}.` : 'Welcome back.';
          })()}
        </h1>
      </div>

      {/* Log buttons - centered, just above the stats cards */}
      <div className="flex justify-center gap-2">
        <Button onClick={() => quickLogTime()} className="gap-2">
          <Clock className="h-4 w-4" /> Log Time
        </Button>
        <Button onClick={() => quickLogExpense()} variant="outline" className="gap-2">
          <DollarSign className="h-4 w-4" /> Log Expense
        </Button>
      </div>

      {/* Stats - Realtime */}
      <DashboardStatsRealtime />

      {/* Reminder */}
      <div className="stat-card bg-amber-50 border-amber-200">
        <div className="text-sm font-medium text-amber-900">Reminder</div>
        <div className="mt-2 text-sm text-amber-800">Future You called. They’d like you to log your hours.</div>
        <Button variant="secondary" size="sm" className="mt-3" onClick={() => setActiveView('time')}>Go log your shit →</Button>
      </div>

      {/* Open Cases section */}
      <OpenCasesSection
        openCases={openCases}
        onNewCase={openNewCase}
        onManageAll={() => setActiveView('cases')}
        onEditCase={(id) => {
          const c = getCaseById(id);
          if (c) openEditCase(c);
        }}
        onLogTime={quickLogTime}
        onLogExpense={quickLogExpense}
      />

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
                      <span className="font-medium">{`${c?.respondentFirstName} ${c?.respondentLastName}`}</span> — {t.activityType}
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
                    <div>{`${c?.respondentFirstName} ${c?.respondentLastName}`} — {e.expenseType}</div>
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
      <div className="mb-4">
        <h2 className="section-title">Cases</h2>
        <p className="text-muted-foreground text-sm">Manage who you’re billing. Close them when done.</p>
      </div>

      {/* Realtime Open Cases */}
      <OpenCasesRealtime 
        onNewCase={openNewCase} 
        onExport={() => generateBillingSpreadsheet(filteredCases)} 
        onCaseClick={openCaseEntries}
      />

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
            <SelectItem value="On Hold">On Hold</SelectItem>
            <SelectItem value="Completed">Completed</SelectItem>
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
          <div 
            key={c.id} 
            className="border rounded-xl p-3 bg-card cursor-pointer active:bg-muted/50"
            onClick={() => openCaseEntries(c.id)}
          >
            <div className="flex justify-between items-start gap-2">
              <div>
                <div className="font-medium">{`${c.respondentFirstName} ${c.respondentLastName}`}</div>
                <div className="text-xs font-mono text-muted-foreground">{c.caseNumber}</div>
                <div className="text-xs mt-0.5">{c.assignmentType}</div>
              </div>
              <div>
                <button
                  onClick={(e) => { e.stopPropagation(); handleToggleStatus(c); }}
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
            <div className="mt-1 text-xs font-mono text-right">{formatCurrency(c.hourlyRate ?? 0)}</div>

            <div className="mt-2 flex gap-1 flex-wrap">
              <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); quickLogTime(c.id); }} className="h-8 px-2 text-xs">+ Time</Button>
              <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); quickLogExpense(c.id); }} className="h-8 px-2 text-xs">+ Exp</Button>
              <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); openEditCase(c); }} className="h-8 px-1.5"><Edit2 className="h-3.5 w-3.5" /></Button>
              <Button size="sm" variant="ghost" className="text-destructive h-8 px-1.5" onClick={(e) => { e.stopPropagation(); handleDeleteCase(c); }}><Trash2 className="h-3.5 w-3.5" /></Button>
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
                <TableRow key={c.id} className="cursor-pointer" onClick={() => openCaseEntries(c.id)}>
                  <TableCell className="font-medium">{`${c.respondentFirstName} ${c.respondentLastName}`}</TableCell>
                  <TableCell className="font-mono text-sm">{c.caseNumber}</TableCell>
                  <TableCell>{c.assignmentType}</TableCell>
                  <TableCell className="text-right font-mono">{formatCurrency(c.hourlyRate ?? 0)}</TableCell>
                  <TableCell>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleToggleStatus(c); }}
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
                      <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); quickLogTime(c.id); }}>Log Time</Button>
                      <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); quickLogExpense(c.id); }}>Expense</Button>
                      <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); openEditCase(c); }}><Edit2 className="h-4 w-4" /></Button>
                      <Button size="sm" variant="ghost" className="text-destructive" onClick={(e) => { e.stopPropagation(); handleDeleteCase(c); }}><Trash2 className="h-4 w-4" /></Button>
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

      <TimeEntriesRealtime 
        optimisticEntries={optimisticEntries} 
        onClearOptimistic={() => setOptimisticEntries([])} 
      />

      <div className="rounded-xl border overflow-hidden">
        <Table className="text-xs">
          <TableHeader>
            <TableRow>
              <TableHead className="p-1">Date</TableHead>
              <TableHead className="p-1">Case</TableHead>
              <TableHead className="p-1">Activity</TableHead>
              <TableHead className="p-1 text-right">Hours</TableHead>
              <TableHead className="p-1 text-right">Amount</TableHead>
              <TableHead className="p-1 w-8"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {timeEntries.length === 0 && <TableRow><TableCell colSpan={6} className="text-center py-10 text-muted-foreground">No time logged. Future You is judging you.</TableCell></TableRow>}
            {[...timeEntries].sort((a, b) => b.date.localeCompare(a.date)).map((t) => {
              const c = getCaseById(t.caseId);
              return (
                <TableRow key={t.id}>
                  <TableCell className="p-1">{formatDate(t.date, 'M/d')}</TableCell>
                  <TableCell className="p-1 font-medium text-[10px]">{`${c?.respondentFirstName} ${c?.respondentLastName}`}<div className="text-[8px] text-muted-foreground">{c?.caseNumber}</div></TableCell>
                  <TableCell className="p-1 text-[10px]">{t.activityType}</TableCell>
                  <TableCell className="p-1 text-right font-mono text-[10px]">{formatHours(t.billableHoursRounded)}</TableCell>
                  <TableCell className="p-1 text-right font-mono text-[10px]">{formatCurrency(t.amount)}</TableCell>
                  <TableCell className="p-1 text-right">
                    <div className="flex gap-1 justify-end">
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => editTimeEntry(t)}><Edit2 className="h-3 w-3" /></Button>
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleDeleteTime(t)}><Trash2 className="h-3 w-3 text-destructive" /></Button>
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

      <ExpensesRealtime 
        optimisticEntries={optimisticExpenses}
        onClearOptimistic={() => setOptimisticExpenses([])}
      />

      <div className="rounded-xl border overflow-hidden">
        <Table className="text-xs">
          <TableHeader>
            <TableRow>
              <TableHead className="p-1">Date</TableHead>
              <TableHead className="p-1">Case</TableHead>
              <TableHead className="p-1">Type</TableHead>
              <TableHead className="p-1">Description</TableHead>
              <TableHead className="p-1 text-right">Amount</TableHead>
              <TableHead className="p-1 w-8"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {expenses.length === 0 && <TableRow><TableCell colSpan={6} className="text-center py-10">No expenses. Nice.</TableCell></TableRow>}
            {[...expenses].sort((a, b) => b.date.localeCompare(a.date)).map((e) => {
              const c = getCaseById(e.caseId);
              return (
                <TableRow key={e.id}>
                  <TableCell className="p-1">{formatDate(e.date, 'M/d')}</TableCell>
                  <TableCell className="p-1 font-medium text-[10px]">{`${c?.respondentFirstName} ${c?.respondentLastName}`}<div className="text-[8px] text-muted-foreground">{c?.caseNumber}</div></TableCell>
                  <TableCell className="p-1 text-[10px]">{e.expenseType}</TableCell>
                  <TableCell className="p-1 text-[10px] max-w-[200px] truncate">{e.description}</TableCell>
                  <TableCell className="p-1 text-right font-mono text-[10px]">{formatCurrency(e.amount)}</TableCell>
                  <TableCell className="p-1 text-right">
                    <div className="flex gap-1 justify-end">
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => editExpenseEntry(e)}><Edit2 className="h-3 w-3" /></Button>
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleDeleteExpense(e)}><Trash2 className="h-3 w-3 text-destructive" /></Button>
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
                      <div className="font-medium text-sm leading-tight">{`${cs.respondentFirstName || ''} ${cs.respondentLastName || ''}`}</div>
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
                        <div className="font-medium">{`${cs.respondentFirstName || ''} ${cs.respondentLastName || ''}`}</div>
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

          <p className="text-xs text-center sm:text-right text-muted-foreground mt-2">Generating the package creates a PDF summary. Entries stay as Pending (no auto-marking as Billed).</p>
        </>
      )}
      </div>
    </div>
  );

  const AccountView = () => {
    // Dynamic labels for live state
    const notifLabel = notificationsEnabled ? 'On' : 'Off';

    const renderItem = (label: string, subtext?: string) => (
      <div
        key={label}
        onClick={() => handleAccountItem(label, subtext)}
        className="flex items-center justify-between px-4 py-3 border-b last:border-b-0 hover:bg-muted/50 cursor-pointer active:bg-muted"
      >
        <div className="flex flex-col">
          <span className="text-sm">{label}</span>
          {subtext && <span className="text-xs text-muted-foreground">{subtext}</span>}
        </div>
        <ChevronRight className="h-4 w-4 text-muted-foreground" />
      </div>
    );

    return (
      <div className="max-w-md mx-auto px-4 py-6 space-y-6 text-sm overflow-y-auto">
        {/* Profile header in Settings/Account: photo next to name */}
        <div
          onClick={() => setProfileModalOpen(true)}
          className="flex items-center gap-3 bg-card border rounded-xl px-4 py-3 cursor-pointer active:opacity-80"
        >
          {profile?.photoDataUrl ? (
            <img src={profile.photoDataUrl} alt="Profile" className="w-12 h-12 rounded-full object-cover border border-zinc-700" />
          ) : (
            <div className="w-12 h-12 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center text-xl flex-shrink-0">
              {profile?.name ? profile.name.split(/\s+/).map((w: string) => w[0]).slice(0,2).join('').toUpperCase() : '👤'}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="font-medium text-base truncate">{profile?.name || 'Set your name'}</div>
            <div className="text-xs text-muted-foreground truncate">{profile?.email || 'Tap to edit profile'}</div>
          </div>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </div>

        {/* SETTINGS */}
        <div>
          <div className="px-4 pb-2 text-xs font-semibold text-muted-foreground tracking-wider">SETTINGS</div>
          <div className="bg-card border rounded-xl overflow-hidden">
            {renderItem('Activity Rates')}
            {renderItem('Siri Shortcuts')}
            {renderItem('Integrations')}
            {renderItem('Notifications', notifLabel)}
          </div>
        </div>

        {/* ADDITIONAL FEATURES */}
        <div>
          <div className="px-4 pb-2 text-xs font-semibold text-muted-foreground tracking-wider">ADDITIONAL FEATURES</div>
          <div className="bg-card border rounded-xl overflow-hidden">
            {renderItem('Home Screen widgets')}
          </div>
        </div>

        {/* SUPPORT */}
        <div>
          <div className="px-4 pb-2 text-xs font-semibold text-muted-foreground tracking-wider">SUPPORT</div>
          <div className="bg-card border rounded-xl overflow-hidden">
            {renderItem('Email Support')}
            {renderItem('Advanced')}
            {renderItem('Help Center', 'CaseLog support')}
          </div>
        </div>

        {/* ABOUT */}
        <div>
          <div className="px-4 pb-2 text-xs font-semibold text-muted-foreground tracking-wider">ABOUT</div>
          <div className="bg-card border rounded-xl overflow-hidden">
            {renderItem('Refer a friend')}
            {renderItem('Rate in the App Store')}
            {renderItem('Follow CaseLog')}
          </div>
        </div>

        {/* APP */}
        <div>
          <div className="px-4 pb-2 text-xs font-semibold text-muted-foreground tracking-wider">APP</div>
          <div className="bg-card border rounded-xl overflow-hidden">
            {renderItem('Acknowledgements')}
            {renderItem('Version', '0.1.0')}
          </div>
        </div>

        {/* Sign out */}
        <div className="pt-4">
          <button
            onClick={() => handleAccountItem('Sign out')}
            className="w-full text-center py-3 text-sm font-medium text-red-600 hover:bg-red-950/20 rounded-xl border border-red-900 active:bg-red-950/30"
          >
            Sign out
          </button>
        </div>

        <div className="h-8" /> {/* extra space for bottom nav */}
      </div>
    );
  };

  if (!isAuthenticated) {
    return <LoginScreen 
      signIn={signIn} 
      signUp={signUp} 
      resetPassword={resetPassword} 
      isSupabaseConfigured={isSupabaseConfigured} 
    />;
  }

  return (
    <div className="min-h-dvh flex flex-col bg-zinc-950" style={{ minHeight: '100dvh' }}>
      <AppHeader />

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
      {caseDialogOpen && (
        <NewCaseForm 
          onSubmit={handleCaseFormSubmit}
          onClose={() => { setCaseDialogOpen(false); setEditingCase(undefined); }} 
          existingCase={editingCase}
          onDelete={() => {
            if (editingCase) {
              // Delete action (confirm already handled in the button UI)
              removeCase(editingCase.id).then(() => {
                toast('Case and associated logs deleted. Poof.');
                setCaseDialogOpen(false);
                setEditingCase(undefined);
              }).catch((err) => {
                toast.error('Failed to delete case. Please try again.');
                console.error(err);
              });
            }
          }}
        />
      )}
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

      <LogTimeModal
        isOpen={logTimeOpen}
        onClose={() => {
          setLogTimeOpen(false);
          setLogTimeCaseId(undefined);
        }}
        onOptimisticAdd={(tempEntry) => setOptimisticEntries(prev => [tempEntry, ...prev])}
        onSuccess={() => {
          setOptimisticEntries([]);
        }}
      />

      <NewCaseModal
        isOpen={newCaseModalOpen}
        onClose={() => setNewCaseModalOpen(false)}
      />

      <ProfileModal
        isOpen={profileModalOpen}
        onClose={() => setProfileModalOpen(false)}
        onProfileUpdated={() => loadProfile?.()}
      />

      <LogExpenseModal
        isOpen={logExpenseOpen}
        onClose={() => setLogExpenseOpen(false)}
        onOptimisticAdd={(temp) => setOptimisticExpenses(prev => [temp, ...prev])}
        onSuccess={() => setOptimisticExpenses([])}
      />

      {/* Account modal / info screens */}
      <Dialog open={accountModalOpen} onOpenChange={setAccountModalOpen}>
        <DialogContent className="sm:max-w-md max-h-[85dvh] flex flex-col">
          <DialogHeader>
            <DialogTitle>{accountModalTitle}</DialogTitle>
          </DialogHeader>
          <div className="flex-1 min-h-0 overflow-y-auto py-2 text-sm">
            {accountModalContent}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAccountModalOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ActivityRatesModal
        isOpen={activityRatesOpen}
        onClose={() => setActivityRatesOpen(false)}
      />

      {/* Case Time Entries Modal (tappable cards on Cases tab) */}
      <Dialog open={caseEntriesOpen} onOpenChange={setCaseEntriesOpen}>
        <DialogContent className="sm:max-w-lg max-h-[85dvh] flex flex-col">
          <DialogHeader>
            <DialogTitle>
              {selectedCaseForEntries 
                ? `${selectedCaseForEntries.respondentFirstName} ${selectedCaseForEntries.respondentLastName}` 
                : 'Case Time Entries'}
            </DialogTitle>
            {selectedCaseForEntries && (
              <p className="text-sm text-muted-foreground font-mono">
                {selectedCaseForEntries.caseNumber} • {selectedCaseForEntries.assignmentType}
              </p>
            )}
          </DialogHeader>

          <div className="flex-1 min-h-0 overflow-y-auto py-2 space-y-2 text-sm">
            {(() => {
              const entries = selectedCaseForEntries ? getTimeForCase(selectedCaseForEntries.id) : [];
              if (!entries || entries.length === 0) {
                return (
                  <div className="text-center py-8 text-muted-foreground">
                    No time entries logged for this case yet.
                  </div>
                );
              }
              return entries.map((t: TimeEntry) => (
                <div key={t.id} className="border rounded-lg p-3 bg-card">
                  <div className="flex justify-between items-center text-xs text-muted-foreground">
                    <span>{formatDate(t.date)}</span>
                    <span className="font-mono tabular-nums">
                      {formatHours(t.billableHoursRounded ?? t.billableHours)}h • {formatCurrency(t.totalAmount ?? t.amount)}
                    </span>
                  </div>
                  <div className="mt-1 font-medium">{t.activityType}</div>
                  {t.description && (
                    <div className="mt-0.5 text-xs text-muted-foreground break-words">{t.description}</div>
                  )}
                </div>
              ));
            })()}
          </div>

          <DialogFooter className="gap-2">
            {selectedCaseForEntries && (
              <>
                <Button 
                  variant="outline" 
                  onClick={() => {
                    setCaseEntriesOpen(false);
                    quickLogTime(selectedCaseForEntries.id);
                  }}
                >
                  + Time
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => {
                    setCaseEntriesOpen(false);
                    quickLogExpense(selectedCaseForEntries.id);
                  }}
                >
                  + Exp
                </Button>
              </>
            )}
            <Button variant="outline" onClick={() => setCaseEntriesOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
