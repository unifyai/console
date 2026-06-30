'use client';

import React from 'react';
import { Suspense } from 'react';
import { SectionBodySkeleton } from '@/components/Common/Loaders/Skeletons';

/**
 * SuspenseLoader wraps async children with the platform-standard skeleton
 * placeholder instead of the legacy favicon spinner.
 */
const SuspenseLoader = ({ message, children }: { message: string; children?: React.ReactNode }) => {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[240px] w-full flex-col gap-3">
          {message ? <p className="text-body px-6 pt-6 text-muted-foreground">{message}</p> : null}
          <SectionBodySkeleton className="flex-1" />
        </div>
      }
    >
      {children}
    </Suspense>
  );
};

export default SuspenseLoader;
