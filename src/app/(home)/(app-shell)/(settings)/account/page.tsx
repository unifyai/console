import { Suspense } from 'react';

import { getCurrentUser } from '@/lib/user/user';
import { resolveAuthMode } from '@/lib/environment/environment';

import Main from '@/components/Pages/Profile/Main';
import { GithubDeprecationBanner } from '@/components/Pages/Profile/GithubDeprecationBanner';
import SkeletonLoader from '@/components/Common/Loaders/SkeletonLoader';
import { redirect } from 'next/navigation';

/**
 * AccountPage is a Next.js page component that renders the user account page.
 *
 * The page displays the user's account information, and newsletter preferences.
 *
 * @returns {JSX.Element} The AccountPage component.
 */
const AccountPage = async () => {
  // External-auth deployments manage identity upstream, so profile fields are
  // read-only here.
  const externalIdentity = resolveAuthMode() === 'external';

  // Get current user
  const user = await getCurrentUser();

  if (!user) {
    redirect('/login?signout=true');
  }

  return (
    <div className="flex h-full w-full flex-col overflow-hidden">
      <GithubDeprecationBanner />
      <Suspense fallback={<SkeletonLoader />}>
        <Main user={user} externalIdentity={externalIdentity} />
      </Suspense>
    </div>
  );
};

export default AccountPage;
