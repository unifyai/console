import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/user/user';

/** Authenticated users land on Assistants; guests go to login. */
export default async function Home() {
  let user = null;
  try {
    user = await getCurrentUser();
  } catch {
    redirect('/login');
  }
  redirect(user ? '/assistants' : '/login');
}
