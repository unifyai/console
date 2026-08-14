'use client';

import { useState, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/UI/dialog';
import { Button } from '@/components/UI/button';
import { Loader2 } from 'lucide-react';
import TotpInput from '@/components/Common/Auth/TotpInput';
import { isImeComposing } from '@/utils/keyboard';

export type MfaCodeType = 'totp' | 'recovery';

interface MfaModalProps {
  /** Whether the modal is open. */
  open: boolean;
  /** Called when the modal should close. */
  onClose: () => void;
  /**
   * Called with the code and its type when the user submits.
   * Should return true if verification succeeded, false otherwise.
   */
  onVerify: (code: string, type: MfaCodeType) => Promise<boolean>;
  /** Optional title override. */
  title?: string;
  /** Optional description override. */
  description?: string;
}

/**
 * Modal overlay for sensitive actions that require MFA verification.
 *
 * Supports both TOTP codes and recovery codes.
 *
 * Usage pattern:
 * 1. Attempt the sensitive action
 * 2. If the backend returns 403 { error: "mfa_required" }, open MfaModal
 * 3. User enters TOTP code or recovery code
 * 4. Retry the action with x-mfa-code or x-mfa-recovery-code header
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
  const [mode, setMode] = useState<MfaCodeType>('totp');
  const [recoveryCode, setRecoveryCode] = useState('');

  const handleTotpSubmit = useCallback(
    async (code: string) => {
      setError(undefined);
      setIsLoading(true);

      try {
        const success = await onVerify(code, 'totp');
        if (!success) {
          setError('Invalid code. Please try again.');
        }
      } catch {
        setError('Verification failed. Please try again.');
      } finally {
        setIsLoading(false);
      }
    },
    [onVerify]
  );

  const handleRecoverySubmit = useCallback(async () => {
    if (!recoveryCode.trim()) return;

    setError(undefined);
    setIsLoading(true);

    try {
      const success = await onVerify(recoveryCode.trim(), 'recovery');
      if (!success) {
        setError('Invalid recovery code. Please try again.');
      }
    } catch {
      setError('Verification failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [onVerify, recoveryCode]);

  const switchMode = useCallback((newMode: MfaCodeType) => {
    setMode(newMode);
    setError(undefined);
    setRecoveryCode('');
  }, []);

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="sm:max-w-md" data-testid="mfa-modal">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="py-4">
          {mode === 'totp' ? (
            <>
              <TotpInput
                onSubmit={handleTotpSubmit}
                error={error}
                isLoading={isLoading}
                label=""
                autoFocus
              />
              <button
                type="button"
                onClick={() => switchMode('recovery')}
                className="text-caption mt-4 w-full text-center text-muted-foreground transition-colors hover:text-foreground"
              >
                Use a recovery code instead
              </button>
            </>
          ) : (
            <div className="flex flex-col items-center gap-4">
              <p className="text-body text-muted-foreground">Enter one of your recovery codes</p>
              <input
                type="text"
                value={recoveryCode}
                onChange={(e) => setRecoveryCode(e.target.value)}
                placeholder="e.g. a3f8k2m9"
                autoFocus
                disabled={isLoading}
                className="w-full max-w-xs rounded-md border border-input bg-background px-3 py-2 text-center font-mono text-lg focus:border-transparent focus:outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                data-testid="recovery-code-input"
                onKeyDown={(e) => {
                  if (isImeComposing(e)) return;
                  if (e.key === 'Enter') handleRecoverySubmit();
                }}
              />

              {error && (
                <p className="text-caption text-destructive" data-testid="recovery-error">
                  {error}
                </p>
              )}

              <Button
                onClick={handleRecoverySubmit}
                disabled={isLoading || !recoveryCode.trim()}
                className="w-full max-w-xs"
                data-testid="recovery-submit"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Verifying...
                  </>
                ) : (
                  'Verify'
                )}
              </Button>

              <button
                type="button"
                onClick={() => switchMode('totp')}
                className="text-caption text-muted-foreground transition-colors hover:text-foreground"
              >
                Use authenticator app instead
              </button>
            </div>
          )}
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
          (err?.response?.data?.error === 'mfa_required' || err?.message?.includes('mfa_required'));

        if (isMfaRequired) {
          setPendingAction(() => action);
          setIsOpen(true);
        } else {
          throw err;
        }
      }
    },
    []
  );

  const handleVerify = useCallback(
    async (code: string, type: MfaCodeType): Promise<boolean> => {
      if (!pendingAction) return false;

      const headerKey = type === 'recovery' ? 'x-mfa-recovery-code' : 'x-mfa-code';

      try {
        await pendingAction({ [headerKey]: code });
        setIsOpen(false);
        setPendingAction(null);
        return true;
      } catch {
        return false;
      }
    },
    [pendingAction]
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
