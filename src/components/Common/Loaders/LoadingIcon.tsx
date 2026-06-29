'use client';

import { BrandLoader } from '@unity/brand/components';

/**
 * LoadingIcon renders the Unify cube loading animation.
 *
 * Props:
 * - height/width: bounding size in px. Defaults to 150.
 */
const LoadingIcon = ({ height = 150, width = 150 }: { height?: number; width?: number }) => {
  return (
    <div className="flex flex-col gap-6 bg-transparent py-10">
      <BrandLoader size={Math.min(height, width)} />
    </div>
  );
};

export default LoadingIcon;
