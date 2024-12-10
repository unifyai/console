import OnPrem from '@/components/OnPrem';
import Usage from '@/components/Usage/Usage';
import SkeletonLoader from '@/components/Common/Loaders/SkeletonLoader';
import { Suspense } from 'react';
import { getCurrentUser } from '@/lib/user/user';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: "Usage",
};

const UsagePage = async () => {
  const onPrem = process.env.ON_PREM;
  const user = await getCurrentUser();

  if (!user) {
    console.error("User not found");
    return null;
  }

  return (
    <Suspense fallback={<SkeletonLoader/>}>
    <div className="bg-background px-5 pb-12">
      {onPrem ? (
        <OnPrem />
      ) : (
        <Usage />
      )}
    </div>
    </Suspense>
  );
};

export default UsagePage;