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
      <Suspense fallback={<FavouritesBodySkeleton />}>
        <FavouritesData />
      </Suspense>
    </ShellSectionPage>
  );
}

/** Streams the projects + favourites so the section header paints immediately. */
async function FavouritesData() {
  const [projects, favourites] = await Promise.all([getProjects(), getFavourites()]);
  return <FavouritesClient initialProjects={projects} initialFavourites={favourites} />;
}
