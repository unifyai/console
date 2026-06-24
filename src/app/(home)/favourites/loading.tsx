import { ShellSectionPage } from '@/components/Layout/Shell/ShellSectionPage';
import { SkeletonCard } from '@/components/Common/Loaders/Skeletons';

/**
 * Route-level loading UI for /favourites. Renders the section header
 * immediately (inside the persistent rail) with skeletons for the two
 * project-selection cards while projects and favourites resolve.
 */
export default function FavouritesLoading() {
  return (
    <ShellSectionPage sectionId="favourites">
      <div className="mx-auto w-full max-w-6xl space-y-6 p-8">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <SkeletonCard lines={6} />
          <SkeletonCard lines={6} />
        </div>
      </div>
    </ShellSectionPage>
  );
}
