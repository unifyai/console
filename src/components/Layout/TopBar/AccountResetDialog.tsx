'use client';

import * as React from 'react';
import { AlertTriangle } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/UI/alert-dialog';
import { resetAccount } from '@/lib/admin/account-reset';

interface AccountResetDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Confirmation dialog for the staging-only "Reset account" staff tool.
 *
 * Rewinds the caller's own personal workspace to its fresh-signup state via the
 * `resetAccount` server action, then lands on `/assistants` to show the reset
 * workspace. Shared by the top-bar and rail account menus.
 */
export default function AccountResetDialog({ open, onOpenChange }: AccountResetDialogProps) {
  const [isResetting, setIsResetting] = React.useState(false);

  const handleReset = async () => {
    setIsResetting(true);
    const denied = await resetAccount();
    if (denied) {
      window.alert('Could not reset account. Please try again.');
      setIsResetting(false);
      return;
    }
    // Onboarding and T-W1N are back to their fresh-signup state; land on the
    // assistants page to show the reset workspace.
    window.location.href = '/assistants';
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent data-testid="reset-account-dialog">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-[color:var(--status-warning)]" />
            Reset your account?
          </AlertDialogTitle>
          <AlertDialogDescription className="space-y-3 text-left">
            <span className="block">
              This removes your hired assistants, wipes your contact details beyond your email, and
              resets T-W1N — returning your personal workspace to how it looked right after signup.
              Your organization workspaces and credits are left untouched. This cannot be undone.
            </span>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isResetting}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleReset}
            disabled={isResetting}
            data-testid="reset-account-confirm"
          >
            {isResetting ? 'Resetting…' : 'Reset account'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
