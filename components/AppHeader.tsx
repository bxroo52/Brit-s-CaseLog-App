'use client';

import { useAppStore } from '@/stores/useAppStore';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useState, useRef, useEffect, useCallback } from 'react';
import {
  FileText,
  Clock,
  DollarSign,
  Users,
  Calendar,
  User,
  Timer,
} from 'lucide-react';
import { formatMonth } from '@/lib/format';

interface NavItem {
  label: string;
  view: 'dashboard' | 'cases' | 'time' | 'timer' | 'expenses' | 'billing' | 'account';
  icon: React.ComponentType<{ className?: string }>;
}

const navItems: NavItem[] = [
  { label: 'Dashboard', view: 'dashboard', icon: FileText },
  { label: 'Cases', view: 'cases', icon: Users },
  { label: 'Log Time', view: 'time', icon: Clock },
  { label: 'Timer', view: 'timer', icon: Timer },
  { label: 'Expenses', view: 'expenses', icon: DollarSign },
  { label: 'Billing', view: 'billing', icon: Calendar },
  { label: 'Account', view: 'account', icon: User },
];

interface AppHeaderProps {
  activeView: 'dashboard' | 'cases' | 'time' | 'timer' | 'expenses' | 'billing' | 'account';
  onViewChange: (view: any) => void;
}

export function AppHeader() {
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
      </div>

      {/* Tiny humor bar */}
      <div className="h-px bg-gradient-to-r from-transparent via-border to-transparent" />
    </header>
  );
}

export function BottomTabBar({ activeView, onViewChange }: Pick<AppHeaderProps, 'activeView' | 'onViewChange'>) {
  const currentIndex = navItems.findIndex((item) => item.view === activeView);
  const [focusedIndex, setFocusedIndex] = useState(currentIndex);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  // Keep focus in sync when activeView changes (e.g. via other means)
  useEffect(() => {
    setFocusedIndex(currentIndex);
  }, [currentIndex]);

  const focusTab = useCallback((index: number) => {
    const tab = tabRefs.current[index];
    if (tab) {
      tab.focus();
      setFocusedIndex(index);
    }
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
      let newIndex = index;

      switch (e.key) {
        case 'ArrowLeft':
          newIndex = (index - 1 + navItems.length) % navItems.length;
          e.preventDefault();
          break;
        case 'ArrowRight':
          newIndex = (index + 1) % navItems.length;
          e.preventDefault();
          break;
        case 'Home':
          newIndex = 0;
          e.preventDefault();
          break;
        case 'End':
          newIndex = navItems.length - 1;
          e.preventDefault();
          break;
        case 'Enter':
        case ' ':
          onViewChange(navItems[index].view);
          e.preventDefault();
          return;
        default:
          return;
      }

      focusTab(newIndex);
    },
    [focusTab, onViewChange]
  );

  return (
    <nav
      role="tablist"
      aria-label="Main navigation"
      aria-orientation="horizontal"
      className="fixed bottom-0 left-0 right-0 z-40 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60"
    >
      <div className="mx-auto max-w-7xl flex h-16 items-center">
        {navItems.map((item, index) => {
          const Icon = item.icon;
          const isActive = activeView === item.view;
          const isFocused = index === focusedIndex;
          return (
            <button
              key={item.view}
              ref={(el) => {
                tabRefs.current[index] = el;
              }}
              role="tab"
              aria-selected={isActive}
              aria-current={isActive ? 'page' : undefined}
              aria-label={`${item.label} tab`}
              tabIndex={isFocused ? 0 : -1}
              onClick={() => onViewChange(item.view)}
              onKeyDown={(e) => handleKeyDown(e, index)}
              className={cn(
                "flex flex-1 flex-col items-center justify-center gap-0.5 px-1 py-1 text-[10px] font-medium transition-colors active:opacity-80 touch-manipulation relative focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
                isActive
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {isActive && (
                <div className="absolute top-0 left-1/2 -translate-x-1/2 h-0.5 w-8 rounded-full bg-primary" />
              )}
              <Icon
                className={cn("h-5 w-5", isActive && "text-primary")}
                aria-hidden="true"
              />
              <span className={cn("leading-none", isActive && "font-semibold")}>
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
