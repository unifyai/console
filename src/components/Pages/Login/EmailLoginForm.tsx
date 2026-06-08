'use client';

import { useState, useCallback, useRef, FormEvent } from 'react';
import { signIn } from 'next-auth/react';
import { Input } from '@/components/UI/input';
import { Button } from '@/components/UI/button';
import { PasswordInput } from '@/components/Common/Input/Password';
import TurnstileWidget, { TurnstileWidgetHandle } from '@/components/Common/Auth/TurnstileWidget';
import PasswordStrengthIndicator from '@/components/Common/Auth/PasswordStrengthIndicator';
import { getPasswordError } from '@/lib/auth/password';
import { IS_SELF_HOST } from '@/lib/auth/self-host';
import VerificationCodeInput from './VerificationCodeInput';
import ForgotPasswordForm from './ForgotPasswordForm';

/** Possible views within the email login flow */
type EmailView = 'login' | 'register' | 'verify' | 'forgot-password';

/**
 * Resolve a sign-in callback URL against the current browser origin.
 *
 * NextAuth's `signIn` result URL is built against `NEXTAUTH_URL`, which
 * may not match the host the user is currently on (notably on slug-tagged
 * preview revisions whose canonical `NEXTAUTH_URL` points elsewhere).
 * Navigating same-origin keeps the freshly-minted session cookie in scope.
 */
async function triggerSelfHostCoordinatorStart() {
  if (!IS_SELF_HOST) return;
  try {
    await fetch('/api/self-host/start-coordinator', { method: 'POST' });
  } catch {
    // Non-blocking — user can run `unity stack coordinator` manually.
  }
}

function sameOriginRedirect(callbackUrl: string | undefined): string {
  const origin = window.location.origin;
  if (!callbackUrl) return `${origin}/`;
  if (callbackUrl.startsWith('/')) return `${origin}${callbackUrl}`;
  try {
    const parsed = new URL(callbackUrl);
    return `${origin}${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return `${origin}/`;
  }
}

interface EmailLoginFormProps {
  /** Optional callback URL after successful login */
  callbackUrl?: string;
  /** Error from parent (e.g. provider-aware error) */
  externalError?: string;
}

/** Provider-aware error message formatting */
const formatProviderError = (providers: string[]): string => {
  if (providers.length === 0) return '';
  const names = providers.map((p) => p.charAt(0).toUpperCase() + p.slice(1));
  const joined =
    names.length > 1 ? `${names.slice(0, -1).join(', ')} and ${names.at(-1)}` : names[0];
  return `This email is registered with ${joined}. Please sign in with ${joined}.`;
};

const EmailLoginForm = ({ callbackUrl, externalError }: EmailLoginFormProps) => {
  const [view, setView] = useState<EmailView>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [error, setError] = useState<string | undefined>(externalError);
  const [isLoading, setIsLoading] = useState(false);
  const [verificationError, setVerificationError] = useState<string | undefined>();
  const [captchaToken, setCaptchaToken] = useState<string | undefined>();
  const captchaRef = useRef<TurnstileWidgetHandle>(null);

  const handleCaptchaVerify = useCallback((token: string) => setCaptchaToken(token), []);
  const handleCaptchaExpire = useCallback(() => setCaptchaToken(undefined), []);

  // ─── Registration ─────────────────────────────────────────────────────

  const handleRegister = async (e: FormEvent) => {
    e.preventDefault();
    setError(undefined);

    // Client-side password strength check (mirrors backend rules)
    const pwError = getPasswordError(password);
    if (pwError) {
      setError(pwError);
      return;
    }

    setIsLoading(true);

    try {
      const res = await fetch('/api/auth/email/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          name: firstName || undefined,
          lastName: lastName || undefined,
          password,
          captchaToken: captchaToken || undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (data.providers?.length && !data.providers.includes('email')) {
          setError(formatProviderError(data.providers));
        } else {
          setError(data.message || data.detail || 'Registration failed');
        }
        captchaRef.current?.reset();
        setIsLoading(false);
        return;
      }

      const requiresVerification = data.requiresVerification ?? data.requires_verification ?? true;

      if (requiresVerification === false) {
        const preRes = await fetch('/api/auth/email/authenticate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password }),
        });
        const preData = await preRes.json();
        if (!preRes.ok) {
          setError(
            preData.message || preData.detail?.message || 'Account created but sign-in failed'
          );
          setIsLoading(false);
          return;
        }

        const result = await signIn('credentials', {
          email,
          password,
          preAuthToken: preData.preAuthToken,
          redirect: false,
          callbackUrl: callbackUrl ?? '/',
        });

        if (result?.error) {
          setError('Account created but sign-in failed. Try signing in manually.');
          setIsLoading(false);
          return;
        }

        await triggerSelfHostCoordinatorStart();
        window.location.href = sameOriginRedirect(callbackUrl);
        return;
      }

      setView('verify');
    } catch {
      setError('Network error. Please try again.');
      captchaRef.current?.reset();
    } finally {
      setIsLoading(false);
    }
  };

  // ─── Login ─────────────────────────────────────────────────────────────

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    setError(undefined);
    setIsLoading(true);

    try {
      // Pre-validate via Orchestra for specific error messages
      const preRes = await fetch('/api/auth/email/authenticate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const preData = await preRes.json();

      if (!preRes.ok) {
        const detail =
          typeof preData?.detail === 'object' && preData.detail !== null ? preData.detail : preData;
        if (detail.providers?.length) {
          setError(formatProviderError(detail.providers));
        } else if (detail.error === 'invalid_credentials') {
          setError('Invalid email or password.');
        } else {
          setError(detail.message || detail.error || 'Login failed');
        }
        setIsLoading(false);
        return;
      }

      // Pre-validation passed — sign in via NextAuth using the pre-auth
      // token so the authorize callback skips the redundant Orchestra call.
      const result = await signIn('credentials', {
        email,
        password,
        preAuthToken: preData.preAuthToken,
        redirect: false,
        callbackUrl: callbackUrl ?? '/',
      });

      if (result?.error) {
        setError('Invalid email or password.');
        setIsLoading(false);
        return;
      }

      await triggerSelfHostCoordinatorStart();
      window.location.href = sameOriginRedirect(callbackUrl);
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // ─── Verification ─────────────────────────────────────────────────────

  const handleVerify = async (code: string) => {
    setVerificationError(undefined);
    setIsLoading(true);

    try {
      const res = await fetch('/api/auth/email/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code }),
      });

      const data = await res.json();

      if (!res.ok) {
        setVerificationError(data.message || data.detail || 'Invalid code');
        setIsLoading(false);
        return;
      }

      // User created — now sign in via NextAuth.
      // If this is a fresh signup (no invite/credit callback), redirect to
      // the workspace onboarding page so the user can choose between
      // personal and organization before they start configuring anything.
      const isSpecialCallback = callbackUrl && callbackUrl !== '/' && callbackUrl !== '';
      const effectiveCallbackUrl = isSpecialCallback ? callbackUrl : '/login/onboarding';

      const result = await signIn('credentials', {
        email,
        password,
        redirect: false,
        callbackUrl: effectiveCallbackUrl,
      });

      if (result?.error) {
        setVerificationError('Sign-in failed after verification. Please try again.');
        setIsLoading(false);
        return;
      }

      window.location.href = sameOriginRedirect(effectiveCallbackUrl);
    } catch {
      setVerificationError('Network error. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendCode = async () => {
    try {
      await fetch('/api/auth/email/resend-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, purpose: 'signup' }),
      });
    } catch {
      // Silently fail — the user can try again
    }
  };

  // ─── Forgot Password ─────────────────────────────────────────────────

  if (view === 'forgot-password') {
    return (
      <ForgotPasswordForm
        initialEmail={email}
        onBack={() => {
          setView('login');
          setError(undefined);
        }}
      />
    );
  }

  // ─── Verification Screen ─────────────────────────────────────────────

  if (view === 'verify') {
    return (
      <div className="flex flex-col gap-4" data-testid="email-verify-view">
        <VerificationCodeInput
          email={email}
          purpose="signup"
          onSubmit={handleVerify}
          onResend={handleResendCode}
          isLoading={isLoading}
          error={verificationError}
        />
        <button
          type="button"
          onClick={() => {
            setView('register');
            setVerificationError(undefined);
          }}
          className="text-caption text-center text-muted-foreground transition-colors hover:text-foreground"
          data-testid="back-to-register"
        >
          ← Back to registration
        </button>
      </div>
    );
  }

  // ─── Login / Register Form ────────────────────────────────────────────

  const isRegister = view === 'register';

  return (
    <div
      className="flex flex-col gap-4"
      data-testid={isRegister ? 'email-register-form' : 'email-login-form'}
    >
      <form onSubmit={isRegister ? handleRegister : handleLogin} className="flex flex-col gap-3">
        {isRegister && (
          <div className="flex gap-3">
            <div className="flex-1">
              <label
                htmlFor="email-first-name"
                className="text-caption font-medium text-foreground"
              >
                First name*
              </label>
              <Input
                id="email-first-name"
                type="text"
                placeholder="First name"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                required
                disabled={isLoading}
                data-testid="email-first-name-input"
              />
            </div>
            <div className="flex-1">
              <label htmlFor="email-last-name" className="text-caption font-medium text-foreground">
                Last name*
              </label>
              <Input
                id="email-last-name"
                type="text"
                placeholder="Last name"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                required
                disabled={isLoading}
                data-testid="email-last-name-input"
              />
            </div>
          </div>
        )}

        <div>
          <label htmlFor="email-address" className="text-caption font-medium text-foreground">
            Email*
          </label>
          <Input
            id="email-address"
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              setError(undefined);
            }}
            required
            disabled={isLoading}
            data-testid="email-input"
          />
        </div>

        <div>
          <label htmlFor="email-password" className="text-caption font-medium text-foreground">
            Password*
          </label>
          <PasswordInput
            id="email-password"
            placeholder={isRegister ? 'Create a strong password' : 'Your password'}
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              setError(undefined);
            }}
            required
            minLength={isRegister ? 8 : undefined}
            disabled={isLoading}
            data-testid="email-password-input"
          />
          {!isRegister && (
            <button
              type="button"
              onClick={() => {
                setView('forgot-password');
                setError(undefined);
              }}
              className="text-caption text-center text-muted-foreground transition-colors hover:text-foreground"
              data-testid="forgot-password-link"
            >
              Forgot password?
            </button>
          )}
          {isRegister && <PasswordStrengthIndicator password={password} className="mt-4" />}
        </div>

        {isRegister && !IS_SELF_HOST && (
          <TurnstileWidget
            ref={captchaRef}
            onVerify={handleCaptchaVerify}
            onExpire={handleCaptchaExpire}
            onError={handleCaptchaExpire}
          />
        )}

        {error && (
          <p className="text-body text-error" data-testid="email-auth-error">
            {error}
          </p>
        )}

        <Button
          type="submit"
          disabled={isLoading || !email || !password || (isRegister && (!firstName || !lastName))}
          className="w-full"
          data-testid="email-submit-btn"
        >
          {isLoading
            ? isRegister
              ? 'Creating account...'
              : 'Signing in...'
            : isRegister
              ? 'Create account'
              : 'Sign in'}
        </Button>
      </form>

      <div className="text-caption text-center text-muted-foreground">
        {isRegister ? (
          <>
            Already have an account?{' '}
            <button
              type="button"
              onClick={() => {
                setView('login');
                setError(undefined);
              }}
              className="font-semibold transition-colors hover:text-foreground"
              data-testid="switch-to-login"
            >
              Sign in
            </button>
          </>
        ) : (
          <>
            Don&apos;t have an account?{' '}
            <button
              type="button"
              onClick={() => {
                setView('register');
                setError(undefined);
              }}
              className="font-semibold transition-colors hover:text-foreground"
              data-testid="switch-to-register"
            >
              Create one
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default EmailLoginForm;
