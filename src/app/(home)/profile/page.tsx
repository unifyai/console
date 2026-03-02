import { Suspense } from 'react';

import { getCurrentUser } from '@/lib/user/user';

import Main from '@/components/Pages/Profile/Main';
import { GithubDeprecationBanner } from '@/components/Pages/Profile/GithubDeprecationBanner';
import SkeletonLoader from '@/components/Common/Loaders/SkeletonLoader';
import { redirect } from 'next/navigation';

/**
 * ProfilePage is a Next.js page component that renders the user profile page.
 *
 * The page displays the user's profile information, and newsletter preferences.
 *
 * @returns {JSX.Element} The ProfilePage component.
 */
const ProfilePage = async () => {
  const onPrem = process.env.ON_PREM;

  // Get current user
  const user = await getCurrentUser();

  if (!user) {
    redirect('/login?signout=true');
  }

  return (
    <div className="h-full w-full overflow-auto">
      <GithubDeprecationBanner />
      <div className="p-1">
        <Suspense fallback={<SkeletonLoader />}>
          <Main user={user} onPrem={onPrem} />
        </Suspense>
      </div>
    </div>
  );
};

export default ProfilePage;
