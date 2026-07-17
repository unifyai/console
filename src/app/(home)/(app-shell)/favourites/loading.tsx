import { ShellSectionPage } from '@/components/Layout/Shell/ShellSectionPage';
import { FavouritesBodySkeleton } from '@/components/Pages/Favourites/FavouritesBodySkeleton';

/**
 * Route-level loading UI for /favourites while the segment prepares. Mirrors the
 * synchronous title chrome in `page.tsx` so a slow first paint never shows a
 * header-less body.
 */
export default function FavouritesLoading() {
  return (
    <ShellSectionPage sectionId="favourites">
      <div className="brand-chat-bg mx-auto min-h-full w-full space-y-6 p-6 lg:p-8">
        <div className="mx-auto w-full max-w-6xl">
          <p className="text-label mb-2 uppercase tracking-[0.16em] text-muted-foreground">
            Console
          </p>
          <h1 className="text-h2 font-display text-foreground">Favourites</h1>
          <p className="text-body-muted">
            Choose the projects that should stay pinned across dashboard navigation.
          </p>
        </div>
        <FavouritesBodySkeleton />
      </div>
    </ShellSectionPage>
  );
}
