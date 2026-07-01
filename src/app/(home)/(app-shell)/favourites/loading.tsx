import { ShellSectionPage } from '@/components/Layout/Shell/ShellSectionPage';
import { FavouritesBodySkeleton } from '@/components/Pages/Favourites/FavouritesBodySkeleton';

/**
 * Route-level loading UI for /favourites. Renders the section header
 * immediately (inside the persistent rail) with skeletons for the two
 * project-selection cards while projects and favourites resolve.
 */
export default function FavouritesLoading() {
  return (
    <ShellSectionPage sectionId="favourites">
      <FavouritesBodySkeleton />
    </ShellSectionPage>
  );
}
