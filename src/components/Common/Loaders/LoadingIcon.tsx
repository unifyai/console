'use client';

import React from 'react';
import { Loader } from '@/components/Common/Loader';

/**
 * Standalone loading indicator. Renders the canonical on-brand block-mark
 * `Loader` sized to the requested footprint, so every surface shows the same
 * loading animation. The `height`/`width` props are kept for call-site
 * compatibility and map to the loader's square slot size.
 */
const LoadingIcon = ({ height = 150, width = 150 }: { height?: number; width?: number }) => {
  return (
    <div className="flex flex-col items-center gap-6 bg-transparent py-10">
      <Loader size={Math.min(height, width)} />
    </div>
  );
};

export default LoadingIcon;
