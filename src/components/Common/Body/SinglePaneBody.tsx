'use client';

import { ReactNode } from 'react';
import SkeletonLoader from '../Loaders/SkeletonLoader';

const SinglePaneBody = ({ isPending, body }: { isPending: boolean; body: ReactNode }) => {
  return (
    <div className="bg-card/80 h-full overflow-y-auto rounded-xl border border-border p-3 shadow-sm">
      <div className="flex h-full w-full flex-col gap-3">
        {isPending ? <SkeletonLoader /> : body}
      </div>
    </div>
  );
};

export default SinglePaneBody;
