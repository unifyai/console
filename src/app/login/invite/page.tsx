import { getCurrentUser } from '@/lib/user/user';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { XCircle } from 'lucide-react';
import InviteContent from '@/components/Pages/Invite/Main';
import { acceptInviteAction } from '@/lib/user/organization';
import { patchSessionAndRedirect } from '@/lib/user/onboarding';

interface InvitePageProps {
  searchParams: { token?: string };
}

/**
 * /login/invite — Accept an organization invitation.
 *
 * This server component lives under the `/login` layout so it shares the
 * same card-with-halo shell used by the login and MFA pages, providing a
 * seamless visual flow for new users: login → invite → MFA setup.
 *
 * Auth check:
 *   - If the user is NOT authenticated, they are redirected to `/login`
 *     with the invite token preserved (via `?invite=` param and `callbackUrl`).
 *     After login the callback brings them back here.
 *   - If authenticated, the invite is processed inline.
 */
export default async function InvitePage({ searchParams }: InvitePageProps) {
  const token = searchParams.token;

  // 1. Validate Token Presence
  if (!token) {
    return (
      <div className="m-auto flex w-full max-w-md flex-col items-center gap-4 text-center">
        <XCircle className="h-8 w-8 text-destructive" />
        <h2 className="text-h2 font-bold">Invalid Invitation</h2>
        <p className="text-body text-muted-foreground">The invitation link is missing a token.</p>
        <Link
          href="/"
          className="text-body hover:bg-primary/90 mt-2 rounded-md bg-primary px-4 py-2 text-primary-foreground"
        >
          Go Home
        </Link>
      </div>
    );
  }

  // 2. Check Authentication
  const user = await getCurrentUser();

  if (!user) {
    // Redirect to login with invite token — login page persists it through OAuth.
    // The callbackUrl brings the user back here after authentication.
    const callbackUrl = `/login/invite?token=${token}`;
    redirect(
      `/login?invite=${encodeURIComponent(token)}&callbackUrl=${encodeURIComponent(callbackUrl)}`
    );
  }

  // 3. Initialize Server Action with API Key
  const acceptAction = await acceptInviteAction(user.apiKey);

  // 4. Render Client View
  return (
    <InviteContent token={token} onAccept={acceptAction} onPatchSession={patchSessionAndRedirect} />
  );
}
