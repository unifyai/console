'use client';

import { ReactNode } from 'react';
import SkeletonLoader from '../Loaders/SkeletonLoader';

const SinglePaneBody = ({ isPending, body }: { isPending: boolean; body: ReactNode }) => {
  return (
    <div className="h-full overflow-y-auto rounded-md bg-background p-3">
      <div className="flex h-full w-full flex-col gap-3">
        {isPending ? <SkeletonLoader /> : body}
      </div>
    </div>
  );
};

export default SinglePaneBody;
