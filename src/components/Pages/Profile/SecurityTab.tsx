'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { signOut } from 'next-auth/react';
import { User } from '@/types/user';
import ChangePasswordForm from './ChangePassword';
import SecondaryButton from '../../Common/Buttons/Secondary';
import DeleteDialog from '../../Common/Dialogs/Delete';
import { deleteUser } from '@/lib/user/user';
import { Loader2 } from 'lucide-react';
import SecuritySettings from '@/app/(home)/profile/security-settings';

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
        <h2 className="text-title">Account Actions</h2>
        <div className="mt-4 flex items-center gap-3">
          <SecondaryButton
            label="Sign Out"
            onClick={async () => {
              await signOut({ redirect: false });
              router.push('/login');
            }}
          />
          <DeleteDialog
            args={[user.id]}
            deletingFunction={deleteUser}
            onDelete={() => {
              // Navigate with ?signout=true so the login page clears the
              // stale JWT cookie before rendering (prevents the brief
              // redirect loop back to /assistants).
              router.push('/login?signout=true');
            }}
            type="account"
            text="Delete Account"
            icon={null}
            variant="destructive"
            expectedResponseType={'string'}
          />
        </div>
      </div>
    </div>
  );
};

export default SecurityTab;

