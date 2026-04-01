'use client';

import { useState } from 'react';
import { ShieldAlert, ShieldCheck } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/UI/dialog';
import { useRouter, usePathname } from 'next/navigation';
import TotpSetup from '@/components/Common/Auth/TotpSetup';

interface MfaEnforcementBannerProps {
  orgName: string;
}

/**
 * Modal displayed when a user must enable MFA to access an org workspace.
 *
 * Shown when the user's organization has `require_mfa=true` and the user
 * has not yet enabled 2FA. The modal is non-dismissible and embeds the
 * full MFA setup flow (QR code → confirm → recovery codes) directly
 * inside the dialog, so the user never has to leave the page.
 *
 * The modal is suppressed on exempt pages (/account, /invite) so the user
 * can complete the MFA setup flow or accept an invite.
 *
 * Uses z-[100] to stay above any other dialogs (z-50).
 */
const MfaEnforcementBanner = ({ orgName }: MfaEnforcementBannerProps) => {
  const router = useRouter();
  const pathname = usePathname();
  const [setupComplete, setSetupComplete] = useState(false);

  // Don't show the modal on pages where the user needs unobstructed access:
  // - /account: to set up MFA via the security tab
  // - /invite or /login/invite: to accept an organization invite
  if (pathname === '/account' || pathname === '/invite' || pathname.startsWith('/login/invite')) {
    return null;
  }

  const handleSetupComplete = () => {
    setSetupComplete(true);
    // Refresh server components so MfaEnforcementGate re-evaluates
    router.refresh();
  };

  return (
    <Dialog open>
      <DialogContent
        hideClose
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
        className="z-[100] sm:max-w-lg"
        overlayClassName="z-[100]"
        data-testid="mfa-enforcement-banner"
      >
        <DialogHeader>
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-950/40">
            {setupComplete ? (
              <ShieldCheck
                className="h-6 w-6 text-green-600 dark:text-green-400"
                data-testid="shield-check-icon"
              />
            ) : (
              <ShieldAlert
                className="h-6 w-6 text-amber-600 dark:text-amber-400"
                data-testid="shield-alert-icon"
              />
            )}
          </div>
          <DialogTitle className="text-center">
            {setupComplete
              ? 'Two-factor authentication enabled'
              : 'Two-factor authentication required'}
          </DialogTitle>
          <DialogDescription className="text-center">
            {setupComplete ? (
              'Your account is now secured with two-factor authentication.'
            ) : (
              <>
                <strong>{orgName}</strong> requires all members to enable two-factor authentication.
                Set up 2FA to access this workspace.
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        {/* Inline MFA setup flow */}
        <div className="pt-2">
          <TotpSetup autoStart onEnabled={handleSetupComplete} />
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default MfaEnforcementBanner;
