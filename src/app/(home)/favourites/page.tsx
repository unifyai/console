import { redirect } from "next/navigation";
import { signOut } from "next-auth/react";
import { getCurrentUser } from "@/lib/user/user";
import { getProjects } from "@/lib/interfaces/projects";
import { getFavourites } from "@/app/(home)/favourites/actions";
import FavouritesClient from "@/components/Pages/Favourites/FavouritesClient";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Favourites",
};

export default async function FavouritesPage() {
  const user = await getCurrentUser();
  if (!user) {
    signOut();
    redirect("/login");
  }

  const apiKey = user!.apiKey;

  try {
    const fetchProjects = await getProjects(apiKey);
    const projects = await fetchProjects();
    const favourites = await getFavourites(apiKey);

    return (
      <div className="w-full h-full overflow-auto pb-6">
        <FavouritesClient
          initialProjects={projects}
          initialFavourites={favourites}
          apiKey={apiKey}
        />
      </div>
    );
  } catch (error) {
    // Propagate to Next.js error boundary
    throw error;
  }
} 