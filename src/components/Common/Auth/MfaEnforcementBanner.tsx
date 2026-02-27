'use client';

import { ShieldAlert } from 'lucide-react';
import { Button } from '@/components/UI/button';
import Link from 'next/link';

interface MfaEnforcementBannerProps {
  orgName: string;
}

/**
 * Banner displayed when a user must enable MFA to access an org workspace.
 *
 * Shown when the user's organization has `require_mfa=true` and the user
 * has not yet enabled 2FA. Applies to all auth providers (email/password,
 * Google, Microsoft). Directs the user to the profile security settings.
 */
const MfaEnforcementBanner = ({ orgName }: MfaEnforcementBannerProps) => {
  return (
    <div
      className="mx-auto my-8 max-w-lg rounded-lg border border-amber-500/30 bg-amber-50 p-6 dark:border-amber-400/30 dark:bg-amber-950/20"
      data-testid="mfa-enforcement-banner"
    >
      <div className="flex items-start gap-3">
        <ShieldAlert className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-600 dark:text-amber-400" />
        <div className="flex flex-col gap-3">
          <h3 className="font-medium text-amber-800 dark:text-amber-200">
            Two-factor authentication required
          </h3>
          <p className="text-sm text-amber-700 dark:text-amber-300">
            <strong>{orgName}</strong> requires all members to enable two-factor
            authentication. Set up 2FA to access this workspace.
          </p>
          <Link href="/profile#security">
            <Button variant="default" size="sm" data-testid="mfa-setup-redirect-btn">
              Set up two-factor authentication
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
};

export default MfaEnforcementBanner;


