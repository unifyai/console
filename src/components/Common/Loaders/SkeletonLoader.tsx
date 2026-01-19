'use client';

import React from 'react';
import { Skeleton } from '@/components/UI/skeleton';

const SkeletonLoader = () => {
  return (
    <Skeleton className="flex h-full w-full rounded-md">
      <div className="w-full rounded-md bg-muted" />
    </Skeleton>
  );
};

export default SkeletonLoader;
