import { getCurrentUser } from '@/lib/user/user';
import { redirect } from 'next/navigation';
import { Button } from '@/components/UI/button';
import Link from 'next/link';
import { XCircle } from 'lucide-react';
import Main from '@/components/Pages/Invite/Main';
import { acceptInviteAction } from '@/lib/user/organization';

interface InvitePageProps {
  searchParams: { token?: string };
}

export default async function InvitePage({ searchParams }: InvitePageProps) {
  const token = searchParams.token;

  // 1. Validate Token Presence
  if (!token) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
        <div className="w-full max-w-md space-y-4 rounded-xl border bg-card p-8 text-center shadow-sm">
          <XCircle className="mx-auto h-8 w-8 text-destructive" />
          <h2 className="text-h2 text-bold">Invalid Invitation</h2>
          <p className="text-body text-muted-foreground">The invitation link is missing a token.</p>
          <Link href="/">
            <Button>Go Home</Button>
          </Link>
        </div>
      </div>
    );
  }

  // 2. Check Authentication
  const user = await getCurrentUser();

  if (!user) {
    // Redirect to login with invite token — login page persists it through OAuth
    const callbackUrl = `/invite?token=${token}`;
    redirect(`/login?invite=${encodeURIComponent(token)}&callbackUrl=${encodeURIComponent(callbackUrl)}`);
  }

  // 3. Initialize Server Action with API Key
  const acceptAction = await acceptInviteAction(user.apiKey);

  // 4. Render Client View — redirects to /assistants on success (org context)
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
      <Main token={token} onAccept={acceptAction} />
    </div>
  );
}
