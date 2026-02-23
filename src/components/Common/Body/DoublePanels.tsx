import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/UI/resizable';
import { ReactNode } from 'react';
import SkeletonLoader from '../Loaders/SkeletonLoader';

export function DoublePanels({
  isLoading,
  first,
  second,
  direction = 'horizontal',
  defaultFirstSize = 50,
  defaultSecondSize = 50,
}: {
  isLoading: boolean;
  first: ReactNode;
  second: ReactNode;
  direction?: 'horizontal' | 'vertical';
  defaultFirstSize?: number;
  defaultSecondSize?: number;
}) {
  return (
    <ResizablePanelGroup
      direction={direction}
      className={`${direction === 'horizontal' ? 'w-full' : 'h-full'} gap-1`}
    >
      <ResizablePanel defaultSize={defaultFirstSize}>
        {isLoading ? <SkeletonLoader /> : first}
      </ResizablePanel>
      <ResizableHandle withHandle />
      <ResizablePanel defaultSize={defaultSecondSize}>
        {isLoading ? <SkeletonLoader /> : second}
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}
