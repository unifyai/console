'use client';

import { ReactNode, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import SkeletonLoader from '../Loaders/SkeletonLoader';

const DualPaneBody = ({
  isPending,
  leftPane,
  rightPane,
}: {
  isPending: boolean;
  leftPane: ReactNode;
  rightPane: ReactNode;
}) => {
  const currentSearchParams = useSearchParams();
  const [searchParams, setSearchParams] = useState<{ [key: string]: string }>(
    Object.fromEntries(currentSearchParams ? currentSearchParams.entries() : [])
  );
  const foldPanel = searchParams?.panel || 'dual';

  return (
    <div className="flex h-full w-full flex-col justify-between gap-2 lg:flex-row">
      {foldPanel === 'right' ? null : (
        <div
          className={`h-full w-full rounded-md bg-background ${foldPanel != 'left' ? 'max-h-[50%] lg:max-h-[100%] lg:max-w-[50%]' : ''}`}
        >
          {isPending ? <SkeletonLoader /> : leftPane}
        </div>
      )}
      {foldPanel === 'right' ? null : (
        <div
          className={`h-full w-full rounded-md ${foldPanel != 'right' ? 'max-h-[50%] lg:max-h-[100%] lg:max-w-[50%]' : ''}`}
        >
          {isPending ? <SkeletonLoader /> : rightPane}
        </div>
      )}
    </div>
  );
};

export default DualPaneBody;
