import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/user/user';
import { getProjects } from '@/lib/interfaces/projects';
import { getFavourites } from '@/lib/interfaces/favourites';
import FavouritesClient from '@/components/Pages/Favourites/FavouritesClient';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Favourites',
};

export default async function FavouritesPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect('/login?signout=true');
  }

  try {
    const projects = await getProjects();
    const favourites = await getFavourites();

    return (
      <div className="h-full w-full overflow-auto pb-6">
        <FavouritesClient initialProjects={projects} initialFavourites={favourites} />
      </div>
    );
  } catch (error) {
    // Propagate to Next.js error boundary
    throw error;
  }
}
