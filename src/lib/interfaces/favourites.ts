"use server";

const baseUrl = `${process.env.ORCHESTRA_URL}/v0`;

import { Favourite } from "@/types/interfaces/grid";

/**
 * Get all favourites for the current user
 */
export const getFavourites = async (apiKey: string): Promise<Favourite[]> => {
  "use server";

  const res = await fetch(`${baseUrl}/project/favorites`, {
    method: "GET",
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  return  await res.json() as Favourite[];
};

/**
 * Create a new favourite for the current user
 */
export const createFavourite = async (apiKey: string) => {
  return async (projectName: string, icon: string, position: number) => {
    "use server";

    try {
      // Validate inputs
      if (!projectName || typeof projectName !== 'string') {
        throw new Error(`Invalid project name: ${projectName}`);
      }
      
      if (!icon || typeof icon !== 'string') {
        icon = "folder"; // Use default if invalid
      }
      
      if (typeof position !== 'number') {
        position = 0; // Use default if invalid
      }
      
      const payload = {
        projectName,
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
  }
};

/**
 * Update an existing favourite
 */
export const updateFavourite = async (apiKey: string) => {
  return async (id: number, updates: { icon?: string; position?: number })=> {
    "use server";
    
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
  }
};

/**
 * Delete a favourite
 */
export const deleteFavourite = async (apiKey: string) => {
  return async (id: number) => {
    "use server";
  
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
  }
};
