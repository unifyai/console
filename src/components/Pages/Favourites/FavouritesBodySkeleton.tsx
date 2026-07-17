import { SkeletonCard } from '@/components/Common/Loaders/Skeletons';

/**
 * Body placeholder for the Favourites surface: the two project-selection cards.
 * Shared by the route-level `loading.tsx` (navigation) and the page's Suspense
 * fallback (data streaming) so both show the same shape.
 */
export function FavouritesBodySkeleton() {
  return (
    <div className="mx-auto w-full max-w-6xl">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <SkeletonCard lines={6} />
        <SkeletonCard lines={6} />
      </div>
    </div>
  );
}
