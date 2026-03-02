import { getCurrentUser } from '@/lib/user/user';
import { redirect } from 'next/navigation';
import WorkspaceContent from '@/components/Pages/Onboarding/WorkspaceContent';
import { createOrganizationAction } from '@/lib/orchestra/api/organization';
import {
  updateOnboardingAction,
  patchSessionAndRedirect,
} from '@/lib/user/onboarding';

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

  const existingOrgs = user.organizations ?? [];

  // ── Idempotency: auto-complete if the user already has an org ─────────
  // This covers the case where the user joined an org via invite but the
  // client-side JWT update failed, leaving the stale `onboardingStep` flag
  // in the cookie. We handle it server-side: mark the backend step complete
  // (best-effort) then patch the JWT cookie and redirect.
  if (existingOrgs.length > 0) {
    const latestOrg = existingOrgs[existingOrgs.length - 1];
    try {
      await onUpdateOnboarding({
        currentStep: 'completed',
        stepData: {
          selectedType: 'organization',
          organizationId: String(latestOrg.id),
          organizationName: latestOrg.name,
          autoCompleted: true,
        },
      });
    } catch {
      // Best-effort — the idempotency check will handle it next time.
    }
    await patchSessionAndRedirect({ onboardingStep: 'completed' });
  }

  return (
    <WorkspaceContent
      onCreateOrg={createOrgAction}
      onUpdateOnboarding={onUpdateOnboarding}
      onPatchSession={patchSessionAndRedirect}
    />
  );
}
