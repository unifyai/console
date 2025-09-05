"use client";

import React from 'react';
import { Loader2, CheckCircle, AlertCircle } from 'lucide-react';

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
  onComplete
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
        return <Loader2 className="w-8 h-8 animate-spin text-primary" />;
      case 'success':
        return <CheckCircle className="w-8 h-8 text-green-500" />;
      case 'error':
        return <AlertCircle className="w-8 h-8 text-red-500" />;
      default:
        return <Loader2 className="w-8 h-8 animate-spin text-primary" />;
    }
  };

  const getStatusText = () => {
    if (message) return message;
    
    switch (status) {
      case 'loading':
        return operation === 'saving' ? 'Saving tab...' : operation === 'resetting' ? 'Resetting tab...' : 'Refreshing interface...';
      case 'success':
        return operation === 'saving' ? 'Tab saved successfully!' : operation === 'resetting' ? 'Tab reset successfully!' : 'Interface refreshed successfully!';
      case 'error':
        return operation === 'saving' ? 'Failed to save tab' : operation === 'resetting' ? 'Failed to reset tab' : 'Failed to refresh interface';
      default:
        return operation === 'saving' ? 'Saving tab...' : operation === 'resetting' ? 'Resetting tab...' : 'Refreshing interface...';
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
      {/* Backdrop with blur */}
      <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" />
      
      {/* Content */}
      <div className="relative z-10 bg-background border border-border rounded-lg shadow-lg p-8 mx-4 max-w-md w-full">
        <div className="flex flex-col items-center text-center space-y-4">
          {/* Icon */}
          <div className="flex items-center justify-center">
            {icon}
          </div>
          
          {/* Main message */}
          <div className="space-y-2">
            <h3 className="text-title text-foreground">
              {getStatusText()}
            </h3>
            
            {/* Sub message */}
            <p className="text-body text-muted-foreground">
              {getSubText()}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SaveResetOverlay; 