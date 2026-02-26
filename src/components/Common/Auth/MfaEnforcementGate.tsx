import { getCurrentUser } from '@/lib/user/user';
import MfaEnforcementBanner from './MfaEnforcementBanner';

/**
 * Server component that checks whether the current user needs to set up MFA
 * for their active org workspace.
 *
 * When MFA setup is required, the enforcement banner is shown **above** the
 * page content. The children are still rendered (e.g. so the user can
 * navigate to /profile to set up MFA), but the banner makes the requirement
 * visually prominent.
 *
 * Pages that should be **blocked** when MFA is not set up (e.g. assistants,
 * interfaces) can use the ``blocking`` prop to replace children entirely.
 */
export default async function MfaEnforcementGate({
  children,
  blocking = false,
}: {
  children: React.ReactNode;
  blocking?: boolean;
}) {
  const user = await getCurrentUser();

  if (user?.mfaSetupRequired) {
    if (blocking) {
      return <MfaEnforcementBanner orgName={user.mfaSetupRequired.orgName} />;
    }
    return (
      <>
        <MfaEnforcementBanner orgName={user.mfaSetupRequired.orgName} />
        {children}
      </>
    );
  }

  return <>{children}</>;
}

