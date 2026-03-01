import { getCurrentUser } from '@/lib/user/user';
import { redirect } from 'next/navigation';
import WorkspaceContent from '@/components/Pages/Onboarding/WorkspaceContent';
import { createOrganizationAction } from '@/lib/orchestra/api/organization';
import { updateOnboardingAction } from '@/lib/user/onboarding';

/**
 * /login/onboarding — Onboarding flow for new users.
 *
 * Currently renders the workspace selection step (personal vs. organization).
 * Future onboarding steps can be added here by reading
 * `session.onboardingStep` and rendering the appropriate component.
 *
 * Lives under the `/login` layout so it shares the same card-with-halo shell.
 *
 * For OAuth users this page is reached via the `onboardingStep` JWT flag +
 * middleware redirect. For email/password users the verification flow
 * redirects here directly.
 */
export default async function OnboardingPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect('/login');
  }

  const createOrgAction = await createOrganizationAction(user.apiKey);
  const onUpdateOnboarding = await updateOnboardingAction(user.apiKey);

  // Pass existing organizations so the client component can detect whether
  // the workspace step's side effect (org creation) already happened — e.g.
  // if the user created an org but the onboarding step update failed and
  // they resumed later.
  const existingOrgs = user.organizations ?? [];

  return (
    <WorkspaceContent
      onCreateOrg={createOrgAction}
      onUpdateOnboarding={onUpdateOnboarding}
      existingOrgs={existingOrgs}
    />
  );
}
