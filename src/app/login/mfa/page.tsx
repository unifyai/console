'use client';

import { useState, useCallback, useEffect, useMemo } from 'react';
import { signOut } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import UnifyLogo from '@/components/Common/Misc/UnifyLogo';
import TotpInput from '@/components/Common/Auth/TotpInput';
import TotpSetup from '@/components/Common/Auth/TotpSetup';
import { Loader } from '@/components/Common/Loader';
import { Button } from '@/components/UI/button';

/**
 * /login/mfa — Two-Factor Authentication page.
 *
 * This page serves two purposes depending on the user's MFA status:
 *
 * 1. **Verification** (MFA already enabled): Shown when an email/password or
 *    OAuth user with MFA enabled logs in. The JWT contains mfaPending=true
 *    and the middleware redirects here. After successful verification the
 *    mfaPending flag is cleared and the user proceeds to /assistants.
 *
 * 2. **Setup** (MFA not yet enabled): Shown when a newly invited user joins
 *    an org that enforces MFA. The invite flow redirects here so the user
 *    can set up 2FA before accessing the workspace.
 *
 * The page auto-detects which mode to use by checking the user's MFA status
 * on mount.
 *
 * The card shell (background, halo, spring animation) is provided by the
 * shared LoginCardShell in the login layout — this page only renders its
 * content.
 */
const MfaPage = () => {
  const router = useRouter();
  const searchParams = useSearchParams();

  const assistantsUrl = useMemo(() => {
    const creditToken = searchParams?.get('token');
    return creditToken ? `/assistants?token=${encodeURIComponent(creditToken)}` : '/assistants';
  }, [searchParams]);

  // MFA status detection
  const [mfaEnabled, setMfaEnabled] = useState<boolean | null>(null); // null = loading
  const [statusError, setStatusError] = useState(false);

  // Verification state
  const [error, setError] = useState<string | undefined>();
  const [isLoading, setIsLoading] = useState(false);
  const [showRecovery, setShowRecovery] = useState(false);
  const [recoveryCode, setRecoveryCode] = useState('');
  const [recoveryWarning, setRecoveryWarning] = useState<string | undefined>();

  // Check MFA status on mount to decide which flow to show
  useEffect(() => {
    const checkMfaStatus = async () => {
      try {
        const res = await fetch('/api/auth/mfa/status');
        if (res.ok) {
          const data = await res.json();
          setMfaEnabled(data.enabled === true);
        } else {
          // If we can't determine status, default to verification flow
          setMfaEnabled(true);
        }
      } catch {
        setStatusError(true);
        setMfaEnabled(true);
      }
    };
    checkMfaStatus();
  }, []);

  // --- Verification handlers (existing MFA) ---

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

        // mfaPending already cleared server-side by the verify route
        router.push(assistantsUrl);
      } catch {
        setError('Verification failed. Please try again.');
        setIsLoading(false);
      }
    },
    [router, assistantsUrl]
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
            'Please regenerate your codes in Security Settings.'
        );
        setTimeout(() => {
          router.push(assistantsUrl);
        }, 3000);
        return;
      }

      // mfaPending already cleared server-side by the verify-recovery route
      router.push(assistantsUrl);
    } catch {
      setError('Recovery code verification failed. Please try again.');
      setIsLoading(false);
    }
  }, [assistantsUrl, recoveryCode, router]);

  // --- Setup complete handler (new MFA) ---

  const handleSetupComplete = useCallback(async () => {
    // After MFA setup during org-enforced onboarding, the user now has MFA
    // enabled. We need to clear mfaPending server-side by verifying a code.
    // The TotpSetup component already confirmed MFA with Orchestra, so we
    // redirect to /assistants — the middleware will allow access since MFA
    // is now enabled and the session will be refreshed on next page load.
    router.push(assistantsUrl);
  }, [router, assistantsUrl]);

  // --- Back to login ---

  const handleBackToLogin = useCallback(async () => {
    await signOut({ redirect: false });
    window.location.href = '/login';
  }, []);

  // --- Render ---

  const renderContent = () => {
    // Loading state while checking MFA status
    if (mfaEnabled === null) {
      return (
        <div className="flex flex-col items-center gap-4">
          <Loader size={32} />
          <p className="text-body text-muted-foreground">Checking authentication status...</p>
        </div>
      );
    }

    // MFA NOT enabled → show setup flow
    if (!mfaEnabled) {
      return (
        <div className="flex flex-col gap-6">
          <div className="text-center">
            <p className="text-body text-muted-foreground">
              Your organization requires two-factor authentication.
            </p>
          </div>
          <TotpSetup autoStart onEnabled={handleSetupComplete} />
        </div>
      );
    }

    // MFA IS enabled → show verification flow
    if (!showRecovery) {
      return (
        <div className="flex flex-col gap-4">
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
        </div>
      );
    }

    // Recovery code input
    return (
      <div className="flex flex-col gap-4">
        <p className="text-body text-center text-muted-foreground">
          Enter one of your recovery codes
        </p>
        <input
          type="text"
          value={recoveryCode}
          onChange={(e) => setRecoveryCode(e.target.value)}
          placeholder="Enter recovery code"
          className="text-caption w-full rounded-md border border-input bg-background px-3 py-2 font-mono focus:outline-none focus:ring-2 focus:ring-ring"
          data-testid="recovery-code-input"
          autoFocus
        />

        {error && (
          <p className="text-caption text-destructive" data-testid="recovery-error">
            {error}
          </p>
        )}

        {recoveryWarning && (
          <p
            className="text-body text-[color:var(--status-warning)]"
            data-testid="recovery-warning"
          >
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
    );
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      className="m-auto flex w-full max-w-md flex-col gap-9"
    >
      {/* Header */}
      <div className="flex flex-col items-center gap-8">
        <div className="flex justify-center">
          <UnifyLogo />
        </div>
        <h1 className="text-h1 font-semibold">
          {mfaEnabled === false ? 'Set Up Two-Factor Authentication' : 'Two-Factor Authentication'}
        </h1>
      </div>

      {/* Content */}
      {renderContent()}

      <button
        type="button"
        onClick={handleBackToLogin}
        className="text-caption flex items-center gap-1.5 text-muted-foreground transition-colors hover:text-foreground"
        data-testid="back-to-login"
      >
        ← Back to Login
      </button>
    </motion.div>
  );
};

export default MfaPage;
