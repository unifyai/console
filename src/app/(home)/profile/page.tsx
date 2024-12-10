import { Suspense } from "react";

import { getCurrentUser } from "@/lib/user/user";

import Main from "@/components/Profile/Main";
import SkeletonLoader from "@/components/Common/Loaders/SkeletonLoader";

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
    return null;
  }

  return (
    <Suspense fallback={<SkeletonLoader />}>
      <Main user={user} onPrem={onPrem} />
    </Suspense>
  );
};

export default ProfilePage;