'use client';

import { useState, FormEvent } from 'react';
import { Button } from '@/components/UI/button';
import { PasswordInput } from '@/components/Common/Input/Password';
import PasswordStrengthIndicator from '@/components/Common/Auth/PasswordStrengthIndicator';
import { getPasswordError } from '@/lib/auth/password';
import { toast } from 'sonner';

interface ChangePasswordFormProps {
  /** Whether the user already has email/password credentials */
  hasEmailAccount: boolean;
  /** Called after successfully setting a password (so parent can refresh state) */
  onPasswordSet?: () => void;
}

const ChangePasswordForm = ({ hasEmailAccount, onPasswordSet }: ChangePasswordFormProps) => {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | undefined>();

  const isSetMode = !hasEmailAccount;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(undefined);

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    const pwError = getPasswordError(newPassword);
    if (pwError) {
      setError(pwError);
      return;
    }

    if (!isSetMode && currentPassword === newPassword) {
      setError('New password must be different from current password');
      return;
    }

    setIsLoading(true);

    try {
      const endpoint = isSetMode
        ? '/api/auth/email/set-password'
        : '/api/auth/email/change-password';

      const body = isSetMode
        ? { new_password: newPassword }
        : { current_password: currentPassword, new_password: newPassword };

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.message || data.detail || 'Password change failed');
        setIsLoading(false);
        return;
      }

      toast.success(isSetMode ? 'Password set successfully' : 'Password changed successfully');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');

      if (isSetMode && onPasswordSet) {
        onPasswordSet();
      }
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="mt-2" data-testid={isSetMode ? 'set-password-section' : 'change-password-section'}>
      {isSetMode && (
        <p className="text-body text-muted-foreground mb-3">
          Your account uses external authentication (Google/Microsoft). Set a password to also sign in with your email.
        </p>
      )}
      <form onSubmit={handleSubmit} className="flex flex-col gap-3 max-w-md">
        {!isSetMode && (
          <div>
            <label htmlFor="current-password" className="text-caption font-medium text-foreground">
              Current password
            </label>
            <PasswordInput
              id="current-password"
              placeholder="Current password"
              value={currentPassword}
              onChange={(e) => {
                setCurrentPassword(e.target.value);
                setError(undefined);
              }}
              required
              disabled={isLoading}
              data-testid="current-password-input"
            />
          </div>
        )}

        <div>
          <label htmlFor="new-password" className="text-caption font-medium text-foreground">
            {isSetMode ? 'Password' : 'New password'}
          </label>
          <PasswordInput
            id="new-password"
            placeholder="Create a strong password"
            value={newPassword}
            onChange={(e) => {
              setNewPassword(e.target.value);
              setError(undefined);
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
            Confirm password
          </label>
          <PasswordInput
            id="confirm-password"
            placeholder="Confirm password"
            value={confirmPassword}
            onChange={(e) => {
              setConfirmPassword(e.target.value);
              setError(undefined);
            }}
            required
            minLength={8}
            disabled={isLoading}
            data-testid="confirm-password-input"
          />
        </div>

        {error && (
          <p className="text-sm text-red-500" data-testid="change-password-error">
            {error}
          </p>
        )}

        <Button
          type="submit"
          disabled={isLoading || (!isSetMode && !currentPassword) || !newPassword || !confirmPassword}
          className="w-fit"
          data-testid={isSetMode ? 'set-password-btn' : 'change-password-btn'}
        >
          {isLoading
            ? (isSetMode ? 'Setting...' : 'Changing...')
            : (isSetMode ? 'Set password' : 'Change password')}
        </Button>
      </form>
    </div>
  );
};

export default ChangePasswordForm;
