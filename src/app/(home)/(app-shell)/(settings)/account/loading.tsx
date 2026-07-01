import { SectionBodySkeleton } from '@/components/Common/Loaders/Skeletons';
import { SkeletonCard } from '@/components/Common/Loaders/Skeletons';

/** Content-only loading UI — the settings shell persists in the route layout. */
export default function AccountLoading() {
  return (
    <div className="mx-auto w-full max-w-[900px] space-y-6 px-6 py-5">
      <SkeletonCard lines={4} />
      <SkeletonCard lines={3} />
    </div>
  );
}
