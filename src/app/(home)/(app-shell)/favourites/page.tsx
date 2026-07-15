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

export default async function FavouritesPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect('/login?signout=true');
  }

  return (
    <ShellSectionPage sectionId="favourites">
      <div className="brand-chat-bg mx-auto min-h-full w-full space-y-6 p-6 lg:p-8">
        {/* Title paints with the shell; project lists stream in below. */}
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

/** Streams projects + favourites after the page title has already painted. */
async function FavouritesData() {
  const [projects, favourites] = await Promise.all([getProjects(), getFavourites()]);
  return <FavouritesClient initialProjects={projects} initialFavourites={favourites} />;
}
