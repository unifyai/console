import { redirect } from 'next/navigation';

interface InvitePageProps {
  searchParams: { token?: string };
}

/**
 * Legacy invite route — redirects to /login/invite.
 *
 * Kept for backward compatibility with existing invite emails that link to
 * `/invite?token=abc`. New invite links point directly to `/login/invite`.
 */
export default function InvitePage({ searchParams }: InvitePageProps) {
  const token = searchParams.token;
  if (token) {
    redirect(`/login/invite?token=${encodeURIComponent(token)}`);
  }
  redirect('/login/invite');
}
