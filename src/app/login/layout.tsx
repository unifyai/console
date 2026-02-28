import React, { Suspense } from 'react';
import type { Metadata } from 'next';
import BaseLayout from '@/components/Pages/Providers/Base';
import Scaffold from '@/components/Layout/LandingNav/Scaffold';

export const metadata: Metadata = {
  title: 'Login',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <Scaffold navbar={false} footer={false} fullScreen>
      <BaseLayout>
        <Suspense>{children}</Suspense>
      </BaseLayout>
    </Scaffold>
  );
}
