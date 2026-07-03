'use client';

import React from 'react';
import { toast } from 'sonner';
import { announce } from '@/lib/utils';

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary caught:', error, errorInfo);
    toast.error('An unexpected error occurred. The app has recovered. Please try again.');
    announce('An unexpected error occurred. The app has recovered. Please try again.', true);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-8 text-center">
          <h2 className="text-lg font-semibold">Something went wrong.</h2>
          <p className="text-sm text-muted-foreground mt-2">Try refreshing the page or logging a new entry.</p>
          <button 
            onClick={() => window.location.reload()} 
            className="mt-4 px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm"
          >
            Reload App
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
