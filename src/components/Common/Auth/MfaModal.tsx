'use client';

import { useState, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/UI/dialog';
import TotpInput from '@/app/login/totp-input';

interface MfaModalProps {
  /** Whether the modal is open. */
  open: boolean;
  /** Called when the modal should close. */
  onClose: () => void;
  /**
   * Called with the TOTP code when the user submits.
   * Should return true if verification succeeded, false otherwise.
   */
  onVerify: (code: string) => Promise<boolean>;
  /** Optional title override. */
  title?: string;
  /** Optional description override. */
  description?: string;
}

/**
 * Modal overlay for sensitive actions that require MFA verification.
 *
 * Usage pattern:
 * 1. Attempt the sensitive action
 * 2. If the backend returns 403 { error: "mfa_required" }, open MfaModal
 * 3. User enters TOTP code
 * 4. Retry the action with x-mfa-code header
 */
const MfaModal = ({
  open,
  onClose,
  onVerify,
  title = 'Verify Identity',
  description = 'This action requires two-factor authentication. Enter your TOTP code to continue.',
}: MfaModalProps) => {
  const [error, setError] = useState<string | undefined>();
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = useCallback(
    async (code: string) => {
      setError(undefined);
      setIsLoading(true);

      try {
        const success = await onVerify(code);
        if (!success) {
          setError('Invalid code. Please try again.');
        }
      } catch {
        setError('Verification failed. Please try again.');
      } finally {
        setIsLoading(false);
      }
    },
    [onVerify],
  );

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="sm:max-w-md" data-testid="mfa-modal">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="py-4">
          <TotpInput
            onSubmit={handleSubmit}
            error={error}
            isLoading={isLoading}
            label=""
            autoFocus
          />
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default MfaModal;

/**
 * Helper hook for using MfaModal with API calls.
 *
 * Wraps an API call to handle the `mfa_required` error by showing
 * the MFA modal and retrying with the `x-mfa-code` header.
 *
 * Example:
 * ```tsx
 * const { mfaModalProps, withMfaProtection } = useMfaProtection();
 *
 * const handleDelete = async () => {
 *   await withMfaProtection(async (headers) => {
 *     await fetch('/api/delete-account', { method: 'DELETE', headers });
 *   });
 * };
 *
 * return (
 *   <>
 *     <Button onClick={handleDelete}>Delete Account</Button>
 *     <MfaModal {...mfaModalProps} />
 *   </>
 * );
 * ```
 */
export function useMfaProtection() {
  const [isOpen, setIsOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<
    ((headers: Record<string, string>) => Promise<void>) | null
  >(null);

  const withMfaProtection = useCallback(
    async (action: (headers: Record<string, string>) => Promise<void>) => {
      try {
        await action({});
      } catch (err: any) {
        // Check if backend responded with mfa_required
        const isMfaRequired =
          err?.response?.status === 403 &&
          (err?.response?.data?.error === 'mfa_required' ||
            err?.message?.includes('mfa_required'));

        if (isMfaRequired) {
          setPendingAction(() => action);
          setIsOpen(true);
        } else {
          throw err;
        }
      }
    },
    [],
  );

  const handleVerify = useCallback(
    async (code: string): Promise<boolean> => {
      if (!pendingAction) return false;

      try {
        await pendingAction({ 'x-mfa-code': code });
        setIsOpen(false);
        setPendingAction(null);
        return true;
      } catch {
        return false;
      }
    },
    [pendingAction],
  );

  const handleClose = useCallback(() => {
    setIsOpen(false);
    setPendingAction(null);
  }, []);

  return {
    withMfaProtection,
    mfaModalProps: {
      open: isOpen,
      onClose: handleClose,
      onVerify: handleVerify,
    },
  };
}

