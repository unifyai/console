import { redirect } from 'next/navigation';

interface InvitePageProps {
  searchParams: Promise<{ token?: string }>;
}

/**
 * Legacy invite route — redirects to /login/invite.
 *
 * Kept for backward compatibility with existing invite emails that link to
 * `/invite?token=abc`. New invite links point directly to `/login/invite`.
 */
export default async function InvitePage({ searchParams }: InvitePageProps) {
  const { token } = await searchParams;
  if (token) {
    redirect(`/login/invite?token=${encodeURIComponent(token)}`);
  }
  redirect('/login/invite');
}
