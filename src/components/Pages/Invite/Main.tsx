'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { signOut } from 'next-auth/react';
import { motion } from 'framer-motion';
import { CheckCircle, XCircle, Loader2, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/UI/button';
import UnifyLogo from '@/components/Common/Misc/UnifyLogo';
import { ResponseProps } from '@/types/common';

/** Error message returned by the backend when the invite email doesn't match. */
const EMAIL_MISMATCH_ERROR = 'This invite is for a different email address';

interface InviteContentProps {
  token: string;
  onAccept: (token: string) => Promise<void | ResponseProps | any>;
  /** Server action that patches the JWT cookie and redirects. */
  onPatchSession: (
    patch: { onboardingStep?: string; mfaPending?: boolean },
    redirectTo?: string,
    extraParams?: Record<string, string>
  ) => Promise<never>;
}

/**
 * Client component for the invite acceptance flow.
 *
 * Renders inside the shared LoginCardShell (provided by the login layout).
 * After accepting the invite:
 * - If the org requires MFA setup → calls `onPatchSession` to clear
 *   onboarding and redirect to /login/mfa
 * - Otherwise → shows success with a "Get Started" button that calls the
 *   same server action
 * - If the email doesn't match → shows two buttons: "Back to Login" + "Continue anyway"
 *
 * Session mutations go through `onPatchSession` (a Server Action) which
 * patches the JWT cookie server-side via `cookies().set()` — CSRF-safe and
 * not URL-accessible.
 */
const InviteContent = ({ token, onAccept, onPatchSession }: InviteContentProps) => {
  const router = useRouter();
  const [status, setStatus] = useState<'processing' | 'success' | 'mfa_required' | 'error'>(
    'processing'
  );
  const [message, setMessage] = useState('');
  const [orgName, setOrgName] = useState<string | undefined>();
  const processedRef = useRef(false);

  useEffect(() => {
    // Prevent double-execution in React Strict Mode
    if (processedRef.current) return;
    processedRef.current = true;

    const processInvite = async () => {
      try {
        const result = await onAccept(token);

        if (result && typeof result === 'object' && 'detail' in result) {
          setStatus('error');
          setMessage(result.detail as string);
        } else if (
          result &&
          typeof result === 'object' &&
          'success' in result &&
          result.mfaSetupRequired
        ) {
          // Org requires MFA and user doesn't have it — redirect to MFA setup
          setOrgName(result.organizationName);
          setStatus('mfa_required');
          // Auto-redirect after a brief moment so the user sees the message.
          // The redirect goes through the API route to clear onboardingStep
          // and then lands on /login/mfa.
          setTimeout(() => {
            const extraParams: Record<string, string> = {};
            const current = new URLSearchParams(window.location.search);
            current.forEach((value, key) => {
              extraParams[key] = value;
            });
            onPatchSession({ onboardingStep: 'completed' }, '/login/mfa', extraParams);
          }, 2000);
        } else if (result && typeof result === 'object' && 'success' in result) {
          setOrgName(result.organizationName);
          setStatus('success');
        } else {
          setStatus('success');
        }
      } catch {
        setStatus('error');
        setMessage('An unexpected error occurred.');
      }
    };

    processInvite();
  }, [token, onAccept, onPatchSession, router]);

  const handleBackToLogin = useCallback(async () => {
    await signOut({ redirect: false });
    window.location.href = '/login';
  }, []);

  const isEmailMismatch = message === EMAIL_MISMATCH_ERROR;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      className="m-auto flex w-full max-w-md flex-col items-center gap-6 text-center"
    >
      <div className="flex justify-center">
        <UnifyLogo />
      </div>

      {status === 'processing' && (
        <>
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <div className="space-y-2">
            <h2 className="text-h2 font-bold">Joining Organization...</h2>
            <p className="text-body text-muted-foreground">
              Please wait while we process your invitation.
            </p>
          </div>
        </>
      )}

      {status === 'success' && (
        <>
          <CheckCircle className="h-8 w-8 text-[color:var(--status-success)]" />
          <div className="space-y-2">
            <h2 className="text-h2 font-bold">Welcome!</h2>
            <p className="text-body text-muted-foreground">
              You have successfully joined
              {orgName ? (
                <>
                  {' '}
                  <strong>{orgName}</strong>
                </>
              ) : (
                ' the organization'
              )}
              .
            </p>
          </div>
          <Button
            onClick={() => {
              const extraParams: Record<string, string> = {};
              const current = new URLSearchParams(window.location.search);
              current.forEach((value, key) => {
                extraParams[key] = value;
              });
              onPatchSession({ onboardingStep: 'completed' }, '/assistants', extraParams);
            }}
            className="w-full"
            data-testid="get-started-btn"
          >
            Get Started
          </Button>
        </>
      )}

      {status === 'mfa_required' && (
        <>
          <ShieldCheck className="h-8 w-8 text-[color:var(--status-warning)]" />
          <div className="space-y-2">
            <h2 className="text-h2 font-bold">Welcome!</h2>
            <p className="text-body text-muted-foreground">
              You&apos;ve successfully joined
              {orgName ? (
                <>
                  {' '}
                  <strong>{orgName}</strong>
                </>
              ) : (
                ' the organization'
              )}
              . This organization requires two-factor authentication — redirecting you to set it
              up...
            </p>
          </div>
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </>
      )}

      {status === 'error' && (
        <>
          <XCircle className="h-8 w-8 text-destructive" />
          <div className="space-y-2">
            <h2 className="text-h2 font-bold">Invitation Failed</h2>
            <p className="text-body text-muted-foreground">{message}</p>
          </div>
          {isEmailMismatch ? (
            <div className="flex w-full flex-col gap-2">
              <Button
                onClick={handleBackToLogin}
                className="w-full"
                data-testid="back-to-login-btn"
              >
                ← Back to Login
              </Button>
              <Button
                variant="outline"
                onClick={() => router.push('/login/onboarding')}
                className="w-full"
                data-testid="continue-anyway-btn"
              >
                Continue anyway
              </Button>
            </div>
          ) : (
            <Button variant="outline" onClick={() => router.push('/')} className="w-full">
              Return to Console
            </Button>
          )}
        </>
      )}
    </motion.div>
  );
};

export default InviteContent;
