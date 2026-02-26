'use client';

import { useState, FormEvent } from 'react';
import { Input } from '@/components/UI/input';
import { Button } from '@/components/UI/button';
import { PasswordInput } from '@/components/Common/Input/Password';
import VerificationCodeInput from './verification-code';

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
  const [verifiedCode, setVerifiedCode] = useState('');
  const [error, setError] = useState<string | undefined>();
  const [verificationError, setVerificationError] = useState<string | undefined>();
  const [passwordError, setPasswordError] = useState<string | undefined>();
  const [isLoading, setIsLoading] = useState(false);

  // ─── Step 1: Request Reset Code ─────────────────────────────────────

  const handleRequestCode = async (e: FormEvent) => {
    e.preventDefault();
    setError(undefined);
    setIsLoading(true);

    try {
      await fetch('/api/auth/email/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      // Always move to code entry — no enumeration leakage
      setView('code');
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // ─── Step 2: Verify Code ───────────────────────────────────────────

  const handleVerifyCode = async (submittedCode: string) => {
    setVerificationError(undefined);
    // Store the code — we'll use it in step 3 when setting the new password
    setVerifiedCode(submittedCode);
    setView('new-password');
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

    if (!newPassword || newPassword.length < 8) {
      setPasswordError('Password must be at least 8 characters.');
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
          email,
          code: verifiedCode,
          newPassword,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        // If the code has expired or is invalid, send them back to the code step
        if (data.error === 'invalid_code') {
          setVerificationError(data.message || 'Code expired. Please request a new one.');
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
        <h2 className="text-h2 font-semibold">Password reset</h2>
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
        <h2 className="text-h2 font-semibold text-center">Set a new password</h2>
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
              placeholder="Min. 8 characters"
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
        <h2 className="text-h2 font-semibold text-center">Enter your reset code</h2>

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
      <h2 className="text-h2 font-semibold text-center">Forgot your password?</h2>
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
