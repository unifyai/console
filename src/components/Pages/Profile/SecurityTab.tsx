'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { signOut } from 'next-auth/react';
import { User } from '@/types/user';
import ChangePasswordForm from './ChangePassword';
import SecondaryButton from '../../Common/Buttons/Secondary';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/UI/button';
import SecuritySettings from '@/app/(home)/profile/security-settings';
import MfaModal, { type MfaCodeType } from '@/components/Common/Auth/MfaModal';
import BaseDialog from '@/components/Common/Dialogs/Base';
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

  // Delete account state
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | undefined>();
  const [showMfaModal, setShowMfaModal] = useState(false);

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
  }, []);

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
            setShowDeleteConfirm(false);
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

  return (
    <div className="flex flex-col gap-8">
      {/* Change Password Section */}
      <div>
        <h2 className="text-title">Password</h2>
        {isLoading ? (
          <div className="mt-4 flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-body">Loading...</span>
          </div>
        ) : (
          <ChangePasswordForm
            hasEmailAccount={credentials?.hasEmailAccount ?? false}
            onPasswordSet={() => setCredentials((prev) => prev ? { ...prev, hasEmailAccount: true } : prev)}
          />
        )}
      </div>

      {/* Two-Factor Authentication Section */}
      <div>
        <h2 className="text-title">Two-Factor Authentication</h2>
        <div className="mt-4">
          <SecuritySettings />
        </div>
      </div>

      {/* Sign Out & Delete Account Section */}
      <div>
        <h2 className="text-title">Session</h2>
        <div className="mt-4 flex items-center gap-3">
          <SecondaryButton
            label="Sign Out"
            onClick={async () => {
              await signOut({ redirect: false });
              router.push('/login');
            }}
          />
          <Button
            variant="destructive"
            className='h-8'
            onClick={() => {
              setDeleteError(undefined);
              setShowDeleteConfirm(true);
            }}
            data-testid="delete-account-btn"
          >
            Delete Account
          </Button>
        </div>
      </div>

      {/* Delete Account Confirmation Dialog */}
      <BaseDialog
        button={null}
        title="Delete Account ?"
        body={
          <div className="text-body">
            {deleteError ? (
              <p className="text-destructive">{deleteError}</p>
            ) : (
              <p>
                You are about to delete your account. This is an irreversible action.
                All your data will be permanently removed.
              </p>
            )}
          </div>
        }
        footer={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setShowDeleteConfirm(false);
                setDeleteError(undefined);
              }}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => performDelete()}
              disabled={isDeleting}
              data-testid="confirm-delete-btn"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                'Delete'
              )}
            </Button>
          </div>
        }
        open={showDeleteConfirm}
        setOpen={setShowDeleteConfirm}
      />

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
