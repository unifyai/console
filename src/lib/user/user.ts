"use server";

import { getServerSession } from "next-auth/next";
import { cache } from "react";
import authOptions from "@/app/api/auth/[...nextauth]/options";
import {OrchestraAdminClient} from "@/lib/orchestra/orchestra-client";
import { Storage } from "@google-cloud/storage";
import { Session, User, UserUpdateRequest } from "@/types/user";
import { ConstructionOutlined } from "@mui/icons-material";
import { readConsoleCookie } from "@/lib/auth/consoleCookie";

/**
 * Retrieves the current user's session information.
 *
 * In on-prem setups, this returns the session information from a local
 * file. Otherwise, it returns the session information from NextAuth.
 *
 * @returns The session information as a Session object if available,
 * otherwise null.
 */
export const getServerSessionCached = cache(() => getServerSession(authOptions));

export async function getSession() {
  if (process.env.ON_PREM) {
    const sessionResponse = await fetch(
      `${process.env.NEXTAUTH_URL}/sessionInfo.json`
    );
    const sessionInfo = (await sessionResponse.json()) as Session;
    return sessionInfo;
  } else {
    // Avoid caching here to ensure per-request cookies (e.g., console_auth) are respected
    const session = await getServerSession(authOptions);
    return session;
  }
}

/**
 * Retrieves a user by their ID.
 * @param id The ID of the user.
 * @returns The user with the given ID.
 */
export async function getUserByID(userID: string) {
  const response = await OrchestraAdminClient.get("/auth-user/by-id", {
    params: { userID },
  }) as { data: User };
  return response.data;
}


/**
 * Retrieves a user by their email address.
 * 
 * @param email - The email address of the user.
 * @returns The user associated with the given email address.
 */
export async function getUserByEmail(email: string) {
  const response = await OrchestraAdminClient.get("/auth-user/by-email", {
    params: { email },
  }) as { data: User };
  return response.data;
}

/**
 * Retrieves the email address of the current user from the session.
 * 
 * @returns {Promise<string | null>} The email address of the current user if available, otherwise null.
 */
export async function getCurrentUserEmail() {
  const email = await getSession().then((session) => session?.user?.email);
  return email;
}

/**
 * Fetches the user information for an on-premise setup.
 * 
 * @returns {Promise<User | null>} The user information as a 
 * User object if available, otherwise null.
 */
export async function getOnPremUser(): Promise<User | null> {
  const userResponse = await fetch(`${process.env.NEXTAUTH_URL}/userInfo.json`);
  const userInfo = (await userResponse.json()) as User;
  return userInfo;
}

/**
 * Retrieves the current user's information.
 * 
 * For on-premise setups, fetches the user information from a local file.
 * For other setups, retrieves the user information based on the user's email
 * from the session.
 * 
 * @returns {Promise<User | null>} The user information as a 
 * User object if available, otherwise null.
 */
export async function getCurrentUser(): Promise<User | null> {
  const session = await getSession();
  if (process.env.ON_PREM) {
    return getOnPremUser();
  } else {
    const email = session?.user?.email;
    if (email) {
      try {
        // Primary path: fetch authoritative user from Orchestra
        return await getUserByEmail(email);
      } catch (error) {
        console.error("[getCurrentUser] Admin lookup failed; entering degraded mode:", error);
        // Degraded path: try to recover apiKey from cookie and synthesize minimal user
        try {
          const cookie = readConsoleCookie();
          const apiKeyFromCookie = cookie?.apiKey ?? "";
          const synthesizedUser: User = {
            // NextAuth's Session.user doesn't reliably include an id; fall back to email
            id: email || "unknown",
            name: session?.user?.name || email.split("@")[0],
            lastName: "",
            jobTitle: "",
            image: session?.user?.image || "",
            email,
            createdAt: new Date().toISOString(),
            apiKey: apiKeyFromCookie, // empty string if unavailable; server routes can fall back to cookie
            stripe_customer_id: "",
            organization: { name: "", level: "" },
            assistant_hiring_approval: null,
            has_claimed_approval_link: "false",
          };
          return synthesizedUser;
        } catch (cookieError) {
          console.error("[getCurrentUser] Failed to synthesize user from cookie:", cookieError);
          return null;
        }
      }
    } else {
      console.error("No user email found in session");
      return null;
    }
  }
}
  

/**
 * Updates a user's information.
 * 
 * @param updatedUser The data to update. Only the fields provided will be updated.
 * 
 * @returns {Promise<User>} The updated user information.
 */
export async function updateUser(updatedUser: UserUpdateRequest): Promise<User> {
  const response = await OrchestraAdminClient.put(
    "/auth-user",
    updatedUser // Send updatedUser as the request body
  ) as { data: User };
  return response.data;
}

/**
 * Deletes a user's account.
 * @param userID The user's id.
 * @returns The response message.
 */
export async function deleteUser(userID: string) {
  const response = await OrchestraAdminClient.delete("/auth-user", {
    params: { user_id: userID },
  }) as { data: string };
  return response.data;
}

/**
 * Updates a user's profile image.
 * 
 * @param id The ID of the user to update.
 * @param image The new profile image as a File object.
 * 
 * @returns {Promise<void>} The promise resolves when the image has been uploaded.
 */
export async function updateUserImage(userID: string, image: File) {
  const file_name = `${process.env.BUCKET_FOLDER}/${userID}.${
    image.name.split(".").at(-1)
  }`;

  const buffer = await image.arrayBuffer();
  const storage = new Storage();
  await storage
    .bucket("console-app-profile-images")
    .file(file_name)
    .save(Buffer.from(buffer));
}