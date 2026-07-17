import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/user/user';
import { getProjects } from '@/lib/interfaces/projects';
import { getFavourites } from '@/lib/interfaces/favourites';
import FavouritesClient from '@/components/Pages/Favourites/FavouritesClient';
import { FavouritesBodySkeleton } from '@/components/Pages/Favourites/FavouritesBodySkeleton';
import { ShellSectionPage } from '@/components/Layout/Shell/ShellSectionPage';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Favourites',
};

/**
 * Title and shell chrome are synchronous so they paint in the first RSC flight.
 * Auth and project lists resolve inside Suspense — awaiting getCurrentUser in the
 * page body would block the heading until the session round-trip finishes.
 */
export default function FavouritesPage() {
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
        <Suspense fallback={<FavouritesBodySkeleton />}>
          <FavouritesData />
        </Suspense>
      </div>
    </ShellSectionPage>
  );
}

async function FavouritesData() {
  const user = await getCurrentUser();
  if (!user) {
    redirect('/login?signout=true');
  }
  const [projects, favourites] = await Promise.all([getProjects(), getFavourites()]);
  return <FavouritesClient initialProjects={projects} initialFavourites={favourites} />;
}
