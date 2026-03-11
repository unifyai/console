'use client';

import { useState, useCallback, useRef, FormEvent } from 'react';
import { Input } from '@/components/UI/input';
import { Button } from '@/components/UI/button';
import { PasswordInput } from '@/components/Common/Input/Password';
import TurnstileWidget, { TurnstileWidgetHandle } from '@/components/Common/Auth/TurnstileWidget';
import PasswordStrengthIndicator from '@/components/Common/Auth/PasswordStrengthIndicator';
import { getPasswordError } from '@/lib/auth/password';
import VerificationCodeInput from './VerificationCodeInput';

type ForgotView = 'email' | 'code' | 'new-password' | 'success';

interface ForgotPasswordFormProps {
  /** Pre-fill the email field */
  initialEmail?: string;
  /** Called when user clicks "Back to login" */
  onBack: () => void;
}

const ForgotPasswordForm = ({ initialEmail = '', onBack }: ForgotPasswordFormProps) => {
  const [view, setView] = useState<ForgotView>('email');
  const [email, setEmail] = useState(initialEmail);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [verificationToken, setVerificationToken] = useState('');
  const [error, setError] = useState<string | undefined>();
  const [verificationError, setVerificationError] = useState<string | undefined>();
  const [passwordError, setPasswordError] = useState<string | undefined>();
  const [isLoading, setIsLoading] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string | undefined>();
  const captchaRef = useRef<TurnstileWidgetHandle>(null);

  const handleCaptchaVerify = useCallback((token: string) => setCaptchaToken(token), []);
  const handleCaptchaExpire = useCallback(() => setCaptchaToken(undefined), []);

  // ─── Step 1: Request Reset Code ─────────────────────────────────────

  const handleRequestCode = async (e: FormEvent) => {
    e.preventDefault();
    setError(undefined);
    setIsLoading(true);

    try {
      const res = await fetch('/api/auth/email/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, captchaToken: captchaToken || undefined }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.message || 'Something went wrong. Please try again.');
        captchaRef.current?.reset();
        setIsLoading(false);
        return;
      }

      // Always move to code entry — no enumeration leakage
      setView('code');
    } catch {
      setError('Network error. Please try again.');
      captchaRef.current?.reset();
    } finally {
      setIsLoading(false);
    }
  };

  // ─── Step 2: Verify Code ───────────────────────────────────────────

  const handleVerifyCode = async (submittedCode: string) => {
    setVerificationError(undefined);
    setIsLoading(true);

    try {
      const res = await fetch('/api/auth/email/verify-reset-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code: submittedCode }),
      });

      const data = await res.json();

      if (!res.ok) {
        setVerificationError(data.message || 'Invalid or expired code. Please try again.');
        setIsLoading(false);
        return;
      }

      // Code is valid — save the verification token and move to password entry
      setVerificationToken(data.token);
      setView('new-password');
    } catch {
      setVerificationError('Network error. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendResetCode = async () => {
    try {
      await fetch('/api/auth/email/resend-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, purpose: 'password_reset' }),
      });
    } catch {
      // Silently fail
    }
  };

  // ─── Step 3: Set New Password ──────────────────────────────────────

  const handleSetNewPassword = async (e: FormEvent) => {
    e.preventDefault();
    setPasswordError(undefined);

    const pwError = getPasswordError(newPassword);
    if (pwError) {
      setPasswordError(pwError);
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError('Passwords do not match.');
      return;
    }

    setIsLoading(true);

    try {
      const res = await fetch('/api/auth/email/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: verificationToken,
          newPassword,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        // If the verification token expired, send them back to the code step
        if (data.error === 'token_expired' || data.error === 'invalid_token') {
          setVerificationError(data.message || 'Verification expired. Please request a new code.');
          setView('code');
        } else {
          setPasswordError(data.message || data.detail || 'Password reset failed.');
        }
        setIsLoading(false);
        return;
      }

      setView('success');
    } catch {
      setPasswordError('Network error. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // ─── Success ──────────────────────────────────────────────────────────

  if (view === 'success') {
    return (
      <div className="flex flex-col items-center gap-4" data-testid="reset-success">
        <p className="text-center text-body text-muted-foreground">
          Your password has been reset. You can now sign in with your new password.
        </p>
        <Button onClick={onBack} className="w-full" data-testid="back-to-login-btn">
          Back to login
        </Button>
      </div>
    );
  }

  // ─── Step 3: New Password Entry ──────────────────────────────────────

  if (view === 'new-password') {
    return (
      <div className="flex flex-col gap-4" data-testid="reset-new-password-view">
        <p className="text-center text-body text-muted-foreground">
          Code verified. Enter your new password below.
        </p>

        <form onSubmit={handleSetNewPassword} className="flex flex-col gap-3">
          <div>
            <label htmlFor="new-password" className="text-caption font-medium text-foreground">
              New password
            </label>
            <PasswordInput
              id="new-password"
              placeholder="Create a strong password"
              value={newPassword}
              onChange={(e) => {
                setNewPassword(e.target.value);
                setPasswordError(undefined);
              }}
              required
              minLength={8}
              disabled={isLoading}
              data-testid="new-password-input"
            />
            <PasswordStrengthIndicator password={newPassword} className="mt-1" />
          </div>

          <div>
            <label htmlFor="confirm-password" className="text-caption font-medium text-foreground">
              Confirm new password
            </label>
            <PasswordInput
              id="confirm-password"
              placeholder="Confirm new password"
              value={confirmPassword}
              onChange={(e) => {
                setConfirmPassword(e.target.value);
                setPasswordError(undefined);
              }}
              required
              minLength={8}
              disabled={isLoading}
              data-testid="confirm-password-input"
            />
          </div>

          {passwordError && (
            <p className="text-sm text-red-500" data-testid="password-error">
              {passwordError}
            </p>
          )}

          <Button
            type="submit"
            disabled={isLoading || !newPassword || !confirmPassword}
            className="w-full"
            data-testid="reset-password-btn"
          >
            {isLoading ? 'Resetting...' : 'Reset password'}
          </Button>
        </form>

        <button
          type="button"
          onClick={onBack}
          className="text-caption text-muted-foreground hover:text-foreground transition-colors text-center"
          data-testid="back-to-login-link"
        >
          ← Back to login
        </button>
      </div>
    );
  }

  // ─── Step 2: Verify Code ─────────────────────────────────────────────

  if (view === 'code') {
    return (
      <div className="flex flex-col gap-4" data-testid="reset-code-view">

        <VerificationCodeInput
          email={email}
          purpose="password_reset"
          onSubmit={handleVerifyCode}
          onResend={handleResendResetCode}
          isLoading={isLoading}
          error={verificationError}
        />

        <button
          type="button"
          onClick={onBack}
          className="text-caption text-muted-foreground hover:text-foreground transition-colors text-center"
          data-testid="back-to-login-link"
        >
          ← Back to login
        </button>
      </div>
    );
  }

  // ─── Step 1: Email Entry ──────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-4" data-testid="forgot-password-form">
      <p className="text-center text-body text-muted-foreground">
        Enter your email and we&apos;ll send you a code to reset your password.
      </p>

      <form onSubmit={handleRequestCode} className="flex flex-col gap-3">
        <Input
          type="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            setError(undefined);
          }}
          required
          disabled={isLoading}
          data-testid="forgot-email-input"
        />

        <TurnstileWidget
          ref={captchaRef}
          onVerify={handleCaptchaVerify}
          onExpire={handleCaptchaExpire}
          onError={handleCaptchaExpire}
        />

        {error && (
          <p className="text-sm text-red-500" data-testid="forgot-error">
            {error}
          </p>
        )}

        <Button
          type="submit"
          disabled={isLoading || !email}
          className="w-full"
          data-testid="send-reset-btn"
        >
          {isLoading ? 'Sending...' : 'Send reset code'}
        </Button>
      </form>

      <button
        type="button"
        onClick={onBack}
        className="text-caption text-muted-foreground hover:text-foreground transition-colors text-center"
        data-testid="back-to-login-link"
      >
        ← Back to login
      </button>
    </div>
  );
};

export default ForgotPasswordForm;

