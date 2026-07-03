'use client';

import { useAppStore } from '@/stores/useAppStore';
import { Button } from '@/components/ui/button';
import {
  FileText,
  Clock,
  DollarSign,
  Users,
  Calendar,
  Settings,
  Download,
} from 'lucide-react';
import { formatMonth } from '@/lib/format';
import { SyncStatus } from './SyncStatus';

interface NavItem {
  label: string;
  view: 'dashboard' | 'cases' | 'time' | 'expenses' | 'billing';
  icon: React.ComponentType<{ className?: string }>;
}

const navItems: NavItem[] = [
  { label: 'Dashboard', view: 'dashboard', icon: FileText },
  { label: 'Cases', view: 'cases', icon: Users },
  { label: 'Log Time', view: 'time', icon: Clock },
  { label: 'Expenses', view: 'expenses', icon: DollarSign },
  { label: 'Billing', view: 'billing', icon: Calendar },
];

interface AppHeaderProps {
  activeView: 'dashboard' | 'cases' | 'time' | 'expenses' | 'billing';
  onViewChange: (view: any) => void;
  onOpenSettings: () => void;
}

export function AppHeader({ activeView, onViewChange, onOpenSettings }: AppHeaderProps) {
  const { selectedMonth, profile } = useAppStore();

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-foreground text-background">
            <FileText className="h-5 w-5" />
          </div>
          <div>
            <div className="font-semibold tracking-tighter text-xl">CaseLog</div>
            <div className="text-[10px] text-muted-foreground -mt-1">{profile?.organization?.toUpperCase() || 'ALASKA COURT SYSTEM'}</div>
          </div>
        </div>

        <div className="flex items-center gap-1.5 text-sm">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeView === item.view;
            return (
              <Button
                key={item.view}
                variant={isActive ? 'default' : 'ghost'}
                size="sm"
                className="gap-2 px-3"
                onClick={() => onViewChange(item.view)}
              >
                <Icon className="h-4 w-4" />
                <span className="hidden md:inline">{item.label}</span>
              </Button>
            );
          })}
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden md:block">
            <SyncStatus />
          </div>

          <div className="hidden sm:block text-right text-xs leading-tight mr-1">
            <div className="font-medium">{profile?.name || 'Court Visitor'}</div>
            <div className="text-muted-foreground tabular-nums">{formatMonth(selectedMonth)}</div>
          </div>

          <Button variant="outline" size="sm" onClick={onOpenSettings} className="gap-2">
            <Settings className="h-4 w-4" />
            <span className="hidden sm:inline">Settings</span>
          </Button>
        </div>
      </div>

      {/* Tiny humor bar */}
      <div className="h-px bg-gradient-to-r from-transparent via-border to-transparent" />
    </header>
  );
}
