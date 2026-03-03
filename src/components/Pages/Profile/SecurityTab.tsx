'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { User } from '@/types/user';
import ChangePasswordForm from './ChangePassword';
import { Loader2, Trash2 } from 'lucide-react';
import { Button } from '@/components/UI/button';
import SecuritySettings from '@/components/Pages/Profile/SecuritySettings';
import MfaModal, { type MfaCodeType } from '@/components/Common/Auth/MfaModal';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/UI/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/UI/alert-dialog';
import { toast } from 'sonner';

interface EmailCredentials {
  hasEmailAccount: boolean;
  emailVerified?: boolean;
  createdAt?: string;
  passwordChangedAt?: string;
}

const SecurityTab = ({ user }: { user: User }) => {
  const router = useRouter();
  const [credentials, setCredentials] = useState<EmailCredentials | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // MFA status (for card label)
  const [mfaEnabled, setMfaEnabled] = useState<boolean | null>(null);

  // Modal state
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showMfaSettingsModal, setShowMfaSettingsModal] = useState(false);

  // Delete account state
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | undefined>();
  const [showMfaModal, setShowMfaModal] = useState(false);

  const fetchMfaStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/mfa/status');
      if (res.ok) {
        const data = await res.json();
        setMfaEnabled(data.enabled ?? false);
      } else {
        setMfaEnabled(false);
      }
    } catch {
      setMfaEnabled(false);
    }
  }, []);

  useEffect(() => {
    const fetchCredentials = async () => {
      try {
        const res = await fetch('/api/auth/email/credentials');
        if (res.ok) {
          const data = await res.json();
          setCredentials(data);
        } else {
          setCredentials({ hasEmailAccount: false });
        }
      } catch {
        setCredentials({ hasEmailAccount: false });
      } finally {
        setIsLoading(false);
      }
    };
    fetchCredentials();
    fetchMfaStatus();
  }, [fetchMfaStatus]);

  const performDelete = useCallback(
    async (mfaCode?: string) => {
      setIsDeleting(true);
      setDeleteError(undefined);

      try {
        const headers: Record<string, string> = {};
        if (mfaCode) {
          headers['x-mfa-code'] = mfaCode;
        }

        const res = await fetch('/api/user/delete-account', {
          method: 'DELETE',
          headers,
        });

        if (!res.ok) {
          const data = await res.json();

          // If MFA is required, show the MFA modal
          if (res.status === 403 && data.error === 'mfa_required') {
            setShowMfaModal(true);
            setIsDeleting(false);
            return;
          }

          setDeleteError(data.message ?? data.error ?? 'Account deletion failed.');
          setIsDeleting(false);
          return;
        }

        toast.success('Account deleted successfully.');
        router.push('/login?signout=true');
      } catch {
        setDeleteError('Account deletion failed. Please try again.');
        setIsDeleting(false);
      }
    },
    [router],
  );

  const handleMfaVerify = useCallback(
    async (code: string, type: MfaCodeType): Promise<boolean> => {
      try {
        const headerKey = type === 'recovery' ? 'x-mfa-recovery-code' : 'x-mfa-code';
        const res = await fetch('/api/user/delete-account', {
          method: 'DELETE',
          headers: { [headerKey]: code },
        });

        if (!res.ok) {
          return false;
        }

        toast.success('Account deleted successfully.');
        setShowMfaModal(false);
        router.push('/login?signout=true');
        return true;
      } catch {
        return false;
      }
    },
    [router],
  );

  const hasEmailAccount = credentials?.hasEmailAccount ?? false;

  return (
    <div className="flex flex-col gap-4">
      {/* Password Card */}
      <div className="rounded-lg border p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-col gap-1">
            <h3 className="text-title">Password</h3>
            <p className="text-caption">
              {isLoading
                ? 'Loading...'
                : hasEmailAccount
                  ? "Update your account's password used for email login."
                  : 'You signed in with an external provider. Set a password to also sign in with your email address.'}
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowPasswordModal(true)}
            disabled={isLoading}
            data-testid="open-password-modal-btn"
          >
            {hasEmailAccount ? 'Change Password' : 'Set Password'}
          </Button>
        </div>
      </div>

      {/* 2FA Card */}
      <div className="rounded-lg border p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-col gap-1">
            <h3 className="text-title">Two-Factor Authentication</h3>
            <p className="text-caption">
              {mfaEnabled
                ? 'Two-factor authentication is enabled on your account.'
                : 'Enable two factor authentication to secure your account.'}
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowMfaSettingsModal(true)}
            data-testid="open-2fa-modal-btn"
          >
            {mfaEnabled ? 'Manage 2FA' : 'Enable 2FA'}
          </Button>
        </div>
      </div>

      {/* Danger Zone */}
      <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4">
        <h3 className="text-h3 text-destructive">Danger Zone</h3>
        <p className="mt-1 text-caption">
          Deleting your account is irreversible. All your data will be permanently removed.
        </p>
        <div className="mt-4">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="destructive"
                size="sm"
                className="gap-2"
                data-testid="delete-account-btn"
              >
                <Trash2 className="h-4 w-4" />
                Delete Account
              </Button>
            </AlertDialogTrigger>

            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete Account</AlertDialogTitle>
                <AlertDialogDescription>
                  You are about to delete your account. This is an irreversible action.
                  All your data will be permanently removed.
                </AlertDialogDescription>
              </AlertDialogHeader>
              {deleteError && (
                <p className="text-caption text-destructive">{deleteError}</p>
              )}
              <AlertDialogFooter>
                <AlertDialogCancel
                  onClick={() => setDeleteError(undefined)}
                  disabled={isDeleting}
                >
                  Cancel
                </AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => performDelete()}
                  disabled={isDeleting}
                  className="hover:bg-destructive/90 bg-destructive text-destructive-foreground"
                  data-testid="confirm-delete-btn"
                >
                  {isDeleting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Deleting...
                    </>
                  ) : (
                    'Proceed'
                  )}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      {/* Password Modal */}
      <Dialog open={showPasswordModal} onOpenChange={setShowPasswordModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{hasEmailAccount ? 'Change Password' : 'Set Password'}</DialogTitle>
            <DialogDescription>
              {hasEmailAccount
                ? 'Enter your current password and choose a new one.'
                : 'Set a password to also sign in with your email address.'}
            </DialogDescription>
          </DialogHeader>
          <ChangePasswordForm
            hasEmailAccount={hasEmailAccount}
            onPasswordSet={() => {
              setCredentials((prev) => prev ? { ...prev, hasEmailAccount: true } : prev);
              setShowPasswordModal(false);
            }}
            onSuccess={() => setShowPasswordModal(false)}
          />
        </DialogContent>
      </Dialog>

      {/* 2FA Settings Modal */}
      <Dialog
        open={showMfaSettingsModal}
        onOpenChange={(open) => {
          setShowMfaSettingsModal(open);
          if (!open) fetchMfaStatus();
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Two-Factor Authentication</DialogTitle>
            <DialogDescription>
              {mfaEnabled
                ? 'Manage your two-factor authentication settings.'
                : 'Set up two-factor authentication to secure your account.'}
            </DialogDescription>
          </DialogHeader>
          <SecuritySettings />
        </DialogContent>
      </Dialog>

      {/* MFA Modal for protected deletion */}
      <MfaModal
        open={showMfaModal}
        onClose={() => setShowMfaModal(false)}
        onVerify={handleMfaVerify}
        title="Verify Identity"
        description="Account deletion requires MFA verification. Enter your TOTP code to continue."
      />
    </div>
  );
};

export default SecurityTab;
