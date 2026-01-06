import {updateUser } from "@/lib/user/user";
import { UserUpdateRequest } from "@/types/user";
import { NextRequest } from "next/server";


/**
 * Handles the form submission for updating a user's profile information.
 * 
 * The request body should contain the following form fields:
 * 
 * - `email`: The new email address of the user.
 * - `name`: The new first name of the user.
 * - `lastName`: The new last name of the user.
 * - `image`: The new profile image as a base64 encoded string.
 * - `jobTitle`: The new job title of the user.
 * - `bio`: The new user bio. 
 * 
 * @param request The request object.
 * 
 * @returns A response object with the updated user information.
 */
export async function POST(request: NextRequest) {

  const id = request.nextUrl.searchParams.get("userID");

  if (!id) {
    return new Response(JSON.stringify({ error: "User ID is required" }), { status: 400 });
  }

  const formData = await request.formData();

  // Update user properties in db
  const phoneNumber = formData.get("phone_number") as string | null;
  const UserUpdateRequest: UserUpdateRequest = {
    email: formData.get("email") as string,
    user_id: id,
    image: formData.get("image") as string,
    name: formData.get("name") as string,
    last_name: formData.get("lastName") as string,
    job_title: formData.get("jobTitle") as string,
    bio: formData.get("bio") as string,
    timezone: formData.get("timezone") as string | null,
    phone_number: phoneNumber === "" ? null : phoneNumber,
  };
  
  const response = await updateUser(UserUpdateRequest);

  return new Response(JSON.stringify(response));
};