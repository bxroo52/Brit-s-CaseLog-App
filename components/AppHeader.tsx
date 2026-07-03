'use client';

import { useAppStore } from '@/stores/useAppStore';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  FileText,
  Clock,
  DollarSign,
  Users,
  Calendar,
  Settings,
} from 'lucide-react';
import { formatMonth } from '@/lib/format';

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

export function AppHeader({ onOpenSettings }: { onOpenSettings: () => void }) {
  const { profile } = useAppStore();

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

        <Button variant="outline" className="gap-2 h-10 md:h-9" onClick={onOpenSettings}>
          <Settings className="h-4 w-4" />
          <span className="hidden sm:inline">Settings</span>
        </Button>
      </div>

      {/* Tiny humor bar */}
      <div className="h-px bg-gradient-to-r from-transparent via-border to-transparent" />
    </header>
  );
}

export function BottomTabBar({ activeView, onViewChange }: Pick<AppHeaderProps, 'activeView' | 'onViewChange'>) {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto max-w-7xl flex h-16 items-center">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeView === item.view;
          return (
            <button
              key={item.view}
              onClick={() => onViewChange(item.view)}
              className={cn(
                "flex flex-1 flex-col items-center justify-center gap-0.5 px-1 py-1 text-[10px] font-medium transition-colors active:opacity-80 touch-manipulation relative",
                isActive
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {isActive && <div className="absolute top-0 left-1/2 -translate-x-1/2 h-0.5 w-8 rounded-full bg-primary" />}
              <Icon className={cn("h-5 w-5", isActive && "text-primary")} />
              <span className={cn("leading-none", isActive && "font-semibold")}>{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
