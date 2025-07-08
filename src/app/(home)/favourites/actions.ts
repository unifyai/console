"use server";

import { getProjects } from "@/lib/interfaces/projects";
import { getCurrentUser } from "@/lib/user/user";

const baseUrl = `${process.env.ORCHESTRA_URL}/v0`;

interface Favourite {
  id: number;
  project: string;
  icon: string;
  position: number;
}

/**
 * Get all favourites for the current user
 */
export const getFavourites = async (apiKey: string): Promise<Favourite[]> => {
  const res = await fetch(`${baseUrl}/project/favorites`, {
    method: "GET",
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  return  await res.json() as Favourite[];
};

/**
 * Create a new favourite for the current user
 */
export const createFavourite = async (apiKey: string, project: string, icon: string, position: number) => {
  try {
    // Validate inputs
    if (!project || typeof project !== 'string') {
      throw new Error(`Invalid project name: ${project}`);
    }
    
    if (!icon || typeof icon !== 'string') {
      icon = "folder"; // Use default if invalid
    }
    
    if (typeof position !== 'number') {
      position = 0; // Use default if invalid
    }
    
    const payload = {
      project,
      icon,
      position
    };
    
    // Make the API request
    const res = await fetch(`${baseUrl}/project/favorites`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload),
    });

    // Get response text for better debugging
    const responseText = await res.text();

    // Parse the response if it's JSON
    let responseData;
    try {
      responseData = JSON.parse(responseText);
    } catch (e) {
      throw new Error(`Invalid JSON response: ${responseText}`);
    }

    return responseData as Favourite;
  } catch (error) {
    console.error("Error in createFavourite:", error);
    throw error;
  }
};

/**
 * Update an existing favourite
 */
export const updateFavourite = async (apiKey: string, id: number, updates: { icon?: string; position?: number }) => {
  try {    
    const res = await fetch(`${baseUrl}/project/favorites/${id}`, {
      method: "PATCH",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(updates),
    });
    return await res.json() as Favourite;
  } catch (error) {
    console.error("Error in updateFavourite:", error);
    throw error;
  }
};

/**
 * Delete a favourite
 */
export const deleteFavourite = async (apiKey: string, id: number) => {
  try {
    const res = await fetch(`${baseUrl}/project/favorites/${id}`, {
      method: "DELETE",
      headers: {
        "Authorization": `Bearer ${apiKey}`
      },
    });

    return await res.ok as boolean;

  } catch (error) {
    console.error("Error in deleteFavourite:", error);
    throw error;
  }
};

/**
 * Get a specific favourite by ID
 */
export const getFavourite = async (apiKey: string, id: number) => {
    const res = await fetch(`${baseUrl}/project/favorites/${id}`, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${apiKey}`
      },
      cache: "no-store",
    });

  return await res.json() as Favourite;
};

export const fetchProjectsForFavourites = async (apiKey: string) => {
  return await getProjects(apiKey);
};

// ---------------- New helper action ----------------
// This action can be safely imported and called from client components. It resolves
// the current user on the server, fetches their favourites and returns them.
/**
 * Fetch the favourites for the currently authenticated user.
 *
 * This helper automatically retrieves the user's API key on the server,
 * so the client does not need to know or pass it around. It simply returns
 * the list of favourites (or an empty list if the user is not authenticated).
 */
export const getUserFavourites = async (): Promise<Favourite[]> => {
  const user = await getCurrentUser();
  if (!user) {
    console.warn("getUserFavourites: no current user – returning empty array");
    return [];
  }
  return await getFavourites(user.apiKey);
}; 