'use client';

import React from 'react';

/**
 * LoadingIcon component renders an SVG loading indicator.
 *
 * Props:
 * - height: The height of the SVG loading icon. Defaults to 150.
 * - width: The width of the SVG loading icon. Defaults to 150.
 *
 * Usage:
 * This component is used to display a loading animation while content is being fetched or processed.
 */
const LoadingIcon = ({ height = 150, width = 150 }: { height?: number; width?: number }) => {
  return (
    <div className="flex flex-col gap-6 bg-transparent py-10">
      <object
        type="image/svg+xml"
        data="/icons/unify-loading.svg"
        height={height}
        width={width}
        className="bg-transparent"
      />
    </div>
  );
};

export default LoadingIcon;
