'use client';

import { useState, FormEvent } from 'react';
import { Button } from '@/components/UI/button';
import { PasswordInput } from '@/components/Common/Input/Password';
import { toast } from 'sonner';

interface ChangePasswordFormProps {
  /** Whether the user has email/password credentials (controls visibility) */
  hasEmailAccount: boolean;
}

const ChangePasswordForm = ({ hasEmailAccount }: ChangePasswordFormProps) => {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | undefined>();

  if (!hasEmailAccount) {
    return null;
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(undefined);

    if (newPassword !== confirmPassword) {
      setError('New passwords do not match');
      return;
    }

    if (newPassword.length < 8) {
      setError('New password must be at least 8 characters');
      return;
    }

    if (currentPassword === newPassword) {
      setError('New password must be different from current password');
      return;
    }

    setIsLoading(true);

    try {
      const res = await fetch('/api/auth/email/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.message || data.detail || 'Password change failed');
        setIsLoading(false);
        return;
      }

      toast.success('Password changed successfully');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="mt-2" data-testid="change-password-section">
      <form onSubmit={handleSubmit} className="flex flex-col gap-3 max-w-md">
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
              setError(undefined);
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
          disabled={isLoading || !currentPassword || !newPassword || !confirmPassword}
          className="w-fit"
          data-testid="change-password-btn"
        >
          {isLoading ? 'Changing...' : 'Change password'}
        </Button>
      </form>
    </div>
  );
};

export default ChangePasswordForm;

