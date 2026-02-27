'use client';

import { ShieldAlert } from 'lucide-react';
import { Button } from '@/components/UI/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/UI/dialog';
import { useRouter, usePathname } from 'next/navigation';

interface MfaEnforcementBannerProps {
  orgName: string;
}

/**
 * Modal displayed when a user must enable MFA to access an org workspace.
 *
 * Shown when the user's organization has `require_mfa=true` and the user
 * has not yet enabled 2FA. The modal is non-dismissible — the user must
 * navigate to their profile security settings to set up 2FA.
 *
 * The modal is suppressed on exempt pages (/profile, /invite) so the user
 * can complete the MFA setup flow or accept an invite.
 *
 * Uses z-[100] to stay above any other dialogs (z-50).
 */
const MfaEnforcementBanner = ({ orgName }: MfaEnforcementBannerProps) => {
  const router = useRouter();
  const pathname = usePathname();

  // Don't show the modal on pages where the user needs unobstructed access:
  // - /profile: to set up MFA via the security tab
  // - /invite: to accept an organization invite
  if (pathname === '/profile' || pathname === '/invite') {
    return null;
  }

  return (
    <Dialog open>
      <DialogContent
        hideClose
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
        className="sm:max-w-md z-[100]"
        overlayClassName="z-[100]"
        data-testid="mfa-enforcement-banner"
      >
        <DialogHeader>
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-950/40">
            <ShieldAlert
              className="h-6 w-6 text-amber-600 dark:text-amber-400"
              data-testid="shield-alert-icon"
            />
          </div>
          <DialogTitle className="text-center">
            Two-factor authentication required
          </DialogTitle>
          <DialogDescription className="text-center">
            <strong>{orgName}</strong> requires all members to enable two-factor
            authentication. Set up 2FA to access this workspace.
          </DialogDescription>
        </DialogHeader>

        <div className="flex justify-center pt-2">
          <Button
            onClick={() => router.push('/profile?tab=security')}
            data-testid="mfa-setup-redirect-btn"
          >
            Set up two-factor authentication
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default MfaEnforcementBanner;
