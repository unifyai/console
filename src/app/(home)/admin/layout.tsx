import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/user/user';
import { AdminRouteShell } from '@/components/Layout/Shell/AdminRouteShell';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) {
    redirect('/login?signout=true');
  }

  const isUnifyAdmin = user.organizations?.some(
    (o) => o.name === 'Unify' && ['owner', 'admin'].includes(o.roleName?.toLowerCase() ?? '')
  );

  if (!isUnifyAdmin) {
    redirect('/assistants');
  }

  return <AdminRouteShell>{children}</AdminRouteShell>;
}
