'use client';

import { useState, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import UnifyLogo from '@/components/Common/Misc/UnifyLogo';
import TotpInput from '../totp-input';
import { Button } from '@/components/UI/button';

/**
 * /login/mfa — Two-Factor Authentication verification page.
 *
 * Shown when an email/password user with MFA enabled logs in.
 * The JWT contains mfaPending=true and the middleware redirects here.
 * After successful verification the mfaPending flag is cleared via
 * session.update(), and the user is redirected to /assistants.
 *
 * The user ID is resolved server-side in the API routes (from the JWT
 * token) — the client only sends the TOTP / recovery code.
 */
const MfaPage = () => {
  const { update } = useSession();
  const router = useRouter();

  const [error, setError] = useState<string | undefined>();
  const [isLoading, setIsLoading] = useState(false);
  const [showRecovery, setShowRecovery] = useState(false);
  const [recoveryCode, setRecoveryCode] = useState('');
  const [recoveryWarning, setRecoveryWarning] = useState<string | undefined>();

  const handleTotpSubmit = useCallback(
    async (code: string) => {
      setError(undefined);
      setIsLoading(true);

      try {
        const res = await fetch('/api/auth/mfa/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code }),
        });

        if (!res.ok) {
          const data = await res.json();
          setError(data.message ?? data.error ?? 'Invalid code. Please try again.');
          setIsLoading(false);
          return;
        }

        // Clear mfaPending from the JWT
        await update({ mfaPending: false });
        router.push('/assistants');
      } catch {
        setError('Verification failed. Please try again.');
        setIsLoading(false);
      }
    },
    [update, router],
  );

  const handleRecoverySubmit = useCallback(async () => {
    if (!recoveryCode.trim()) return;
    setError(undefined);
    setRecoveryWarning(undefined);
    setIsLoading(true);

    try {
      const res = await fetch('/api/auth/mfa/verify-recovery', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: recoveryCode.trim() }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.message ?? data.error ?? 'Invalid recovery code.');
        setIsLoading(false);
        return;
      }

      const data = await res.json();

      // Warn if running low on recovery codes
      if (data.remainingCodes !== undefined && data.remainingCodes < 3) {
        setRecoveryWarning(
          `You have ${data.remainingCodes} recovery code${data.remainingCodes === 1 ? '' : 's'} remaining. ` +
            'Please regenerate your codes in Security Settings.',
        );
        // Wait a moment for user to read the warning
        setTimeout(async () => {
          await update({ mfaPending: false });
          router.push('/assistants');
        }, 3000);
        return;
      }

      // Clear mfaPending from the JWT
      await update({ mfaPending: false });
      router.push('/assistants');
    } catch {
      setError('Recovery code verification failed. Please try again.');
      setIsLoading(false);
    }
  }, [recoveryCode, update, router]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background">
      <div className="w-full max-w-md space-y-6 rounded-lg border border-border bg-card p-8 shadow-sm">
        <div className="flex flex-col items-center gap-3">
          <UnifyLogo />
          <h1 className="text-h1 font-semibold">Two-Factor Authentication</h1>
        </div>

        {!showRecovery ? (
          <>
            <TotpInput
              onSubmit={handleTotpSubmit}
              error={error}
              isLoading={isLoading}
              label="Enter the 6-digit code from your authenticator app"
            />

            <div className="flex justify-center">
              <Button
                variant="link"
                onClick={() => {
                  setShowRecovery(true);
                  setError(undefined);
                }}
                className="text-caption text-muted-foreground"
                data-testid="use-recovery-code"
              >
                Use a recovery code
              </Button>
            </div>
          </>
        ) : (
          <div className="flex flex-col gap-4">
            <p className="text-body text-center text-muted-foreground">
              Enter one of your recovery codes
            </p>
            <input
              type="text"
              value={recoveryCode}
              onChange={(e) => setRecoveryCode(e.target.value)}
              placeholder="Enter recovery code"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-caption font-mono
                         focus:outline-none focus:ring-2 focus:ring-ring"
              data-testid="recovery-code-input"
              autoFocus
            />

            {error && (
              <p className="text-caption text-destructive" data-testid="recovery-error">
                {error}
              </p>
            )}

            {recoveryWarning && (
              <p className="text-sm text-amber-600 dark:text-amber-400" data-testid="recovery-warning">
                {recoveryWarning}
              </p>
            )}

            <Button
              onClick={handleRecoverySubmit}
              disabled={isLoading || !recoveryCode.trim()}
              className="w-full"
              data-testid="recovery-submit"
            >
              {isLoading ? 'Verifying...' : 'Verify Recovery Code'}
            </Button>

            <Button
              variant="link"
              onClick={() => {
                setShowRecovery(false);
                setError(undefined);
              }}
              className="text-caption text-muted-foreground"
              data-testid="use-totp-code"
            >
              Use authenticator app instead
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default MfaPage;
