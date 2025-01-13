import OnPrem from '@/components/OnPrem';
import Usage from '@/components/Usage/Usage';
import SkeletonLoader from '@/components/Common/Loaders/SkeletonLoader';
import { Suspense } from 'react';
import { getCurrentUser } from '@/lib/user/user';
import { Metadata } from 'next';
import { signOut } from 'next-auth/react';
import { redirect } from 'next/navigation';

export const metadata: Metadata = {
  title: "Usage",
};

const UsagePage = async () => {
  const onPrem = process.env.ON_PREM;
  const user = await getCurrentUser();

  if (!user) {
    console.error("User not found");
    signOut();
    redirect('/login');
  }

  return (
    <div className="w-full h-full p-1 overflow-auto">
      <Suspense fallback={<SkeletonLoader />}>
        <div className="bg-background px-5 pb-12">
          {onPrem ? (
            <OnPrem />
          ) : (
            <Usage />
          )}
        </div>
      </Suspense>
    </div>
  );
};

export default UsagePage;