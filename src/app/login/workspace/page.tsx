import { getCurrentUser } from '@/lib/user/user';
import { redirect } from 'next/navigation';
import WorkspaceContent from './workspace-content';
import { createOrganizationAction } from '@/lib/orchestra/api/organization';

/**
 * /login/workspace — Workspace onboarding for new users.
 *
 * Shown after first sign-up so the user can decide whether to use a personal
 * workspace or create an organization right away. This prevents the common
 * pain point of setting up billing/resources in a personal workspace only to
 * discover later that an organization is needed.
 *
 * Lives under the `/login` layout so it shares the same card-with-halo shell.
 *
 * For OAuth users this page is reached via the `needsOnboarding` JWT flag +
 * middleware redirect. For email/password users the verification flow
 * redirects here directly.
 */
export default async function WorkspacePage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect('/login');
  }

  const createOrgAction = await createOrganizationAction(user.apiKey);

  return <WorkspaceContent onCreateOrg={createOrgAction} />;
}

