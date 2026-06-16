'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import LoadingScreen from '@/components/Layout/LoadingScreen';
import { getCurrentUser } from '@/lib/user/user';

export default function Home() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const redirectUser = async () => {
      try {
        const user = await getCurrentUser();
        if (!isMounted) return;

        router.replace(user ? '/assistants' : '/login');
      } catch (error) {
        console.error('Error initializing user:', error);
        if (isMounted) router.replace('/login');
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    redirectUser();
    return () => {
      isMounted = false;
    };
  }, [router]);

  return isLoading ? <LoadingScreen /> : null;
}
