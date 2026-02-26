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
        ) : credentials?.hasEmailAccount ? (
          <ChangePasswordForm hasEmailAccount={true} />
        ) : (
          <p className="text-body mt-2 text-muted-foreground">
            Your account uses external authentication (e.g. Google). Password management is not available.
          </p>
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
            onClick={() => {
              signOut();
              router.push('/login');
            }}
          />
          <DeleteDialog
            args={[user.id]}
            deletingFunction={deleteUser}
            onDelete={() => {
              router.push('/login');
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

