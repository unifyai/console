import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/user/user';
import { getProjects } from '@/lib/interfaces/projects';
import { getFavourites } from '@/lib/interfaces/favourites';
import FavouritesClient from '@/components/Pages/Favourites/FavouritesClient';
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

  const projects = await getProjects();
  const favourites = await getFavourites();

  return (
    <ShellSectionPage sectionId="favourites">
      <FavouritesClient initialProjects={projects} initialFavourites={favourites} />
    </ShellSectionPage>
  );
}
