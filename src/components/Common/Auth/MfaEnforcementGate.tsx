import { getCurrentUser } from '@/lib/user/user';
import MfaEnforcementBanner from './MfaEnforcementBanner';

/**
 * Server component that checks whether the current user needs to set up MFA
 * for their active org workspace.
 *
 * When MFA setup is required, a non-dismissible modal overlay is shown on top
 * of the page content. The children are still rendered underneath so the user
 * can navigate (e.g. to /account to set up MFA) once they click the CTA.
 *
 * The ``blocking`` prop is retained for API compatibility but no longer
 * changes the visual behaviour — the modal always overlays the page.
 */
export default async function MfaEnforcementGate({
  children,
  blocking: _blocking = false,
}: {
  children: React.ReactNode;
  blocking?: boolean;
}) {
  const user = await getCurrentUser();

  if (user?.mfaSetupRequired) {
    return (
      <>
        <MfaEnforcementBanner orgName={user.mfaSetupRequired.orgName} />
        {children}
      </>
    );
  }

  return <>{children}</>;
}
