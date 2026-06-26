'use client';

import React from 'react';
import { CheckCircle, AlertCircle } from 'lucide-react';
import { Loader } from '@/components/Common/Loader';

interface SaveResetOverlayProps {
  isVisible: boolean;
  operation: 'saving' | 'resetting' | 'refreshing' | null;
  status: 'loading' | 'success' | 'error' | null;
  message?: string;
  onComplete?: () => void;
}

const SaveResetOverlay: React.FC<SaveResetOverlayProps> = ({
  isVisible,
  operation,
  status,
  message,
  onComplete,
}) => {
  React.useEffect(() => {
    if (status === 'success' || status === 'error') {
      const timer = setTimeout(() => {
        onComplete?.();
      }, 2000); // Hide after 2 seconds
      return () => clearTimeout(timer);
    }
  }, [status, onComplete]);

  if (!isVisible || !operation) return null;

  const getIcon = () => {
    switch (status) {
      case 'loading':
        return <Loader size={32} />;
      case 'success':
        return <CheckCircle className="h-8 w-8 text-[color:var(--status-success)]" />;
      case 'error':
        return <AlertCircle className="h-8 w-8 text-[color:var(--status-danger)]" />;
      default:
        return <Loader size={32} />;
    }
  };

  const getStatusText = () => {
    if (message) return message;

    switch (status) {
      case 'loading':
        return operation === 'saving'
          ? 'Saving tab...'
          : operation === 'resetting'
            ? 'Resetting tab...'
            : 'Refreshing interface...';
      case 'success':
        return operation === 'saving'
          ? 'Tab saved successfully!'
          : operation === 'resetting'
            ? 'Tab reset successfully!'
            : 'Interface refreshed successfully!';
      case 'error':
        return operation === 'saving'
          ? 'Failed to save tab'
          : operation === 'resetting'
            ? 'Failed to reset tab'
            : 'Failed to refresh interface';
      default:
        return operation === 'saving'
          ? 'Saving tab...'
          : operation === 'resetting'
            ? 'Resetting tab...'
            : 'Refreshing interface...';
    }
  };

  const getSubText = () => {
    if (status === 'loading') {
      return 'Please wait, do not make changes during this operation...';
    }
    if (status === 'success') {
      return operation === 'saving'
        ? 'All changes have been saved successfully.'
        : operation === 'resetting'
          ? 'All changes have been reverted to the last saved state.'
          : 'The interface has been refreshed with the latest data.';
    }
    if (status === 'error') {
      return 'Please try again. If the problem persists, check your connection.';
    }
    return '';
  };

  const icon = getIcon();

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center">
      <div className="brand-chat-bg bg-background/85 absolute inset-0 backdrop-blur-sm" />

      <div className="bg-card/95 relative z-10 mx-4 w-full max-w-md rounded-xl border border-border p-8 shadow-pop backdrop-blur-sm">
        <div className="flex flex-col items-center space-y-4 text-center">
          <div className="bg-background/70 flex h-16 w-16 items-center justify-center rounded-xl border border-border">
            {icon}
          </div>

          <div className="space-y-2">
            <p className="text-label uppercase tracking-[0.16em] text-muted-foreground">
              Interfaces
            </p>
            <h3 className="text-title font-display text-foreground">{getStatusText()}</h3>

            <p className="text-body text-muted-foreground">{getSubText()}</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SaveResetOverlay;
