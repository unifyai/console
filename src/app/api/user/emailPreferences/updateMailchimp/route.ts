import { getMailchimpUser, addMailchimpUser, updateMailchimpInterests, updateMailchimpUser } from "@/lib/user/email-preferences";

  /**
   * Handles the form submission for updating a user's profile information.
   * 
   * The request body should contain the following form fields:
   * 
   * - `email`: The new email address of the user.
   * - `name`: The new first name of the user.
   * - `last_name`: The new last name of the user.
   * - `image`: The new profile image as a base64 encoded string.
   * - `job_title`: The new job title of the user.
   * 
   * @param request The request object.
   * 
   * @returns A response object with the updated user information.
   */
export async function POST(request: Request) {
  const formData = await request.formData();

  const email = formData.get("email") as string;
  const name = formData.get("name") as string;
  const last_name = formData.get("last_name") as string;
  const subscriptions = JSON.parse(formData.get("subscriptions") as string);

  const user = await getMailchimpUser(email);

  if (!user) {
    await addMailchimpUser(email)
  }

  await updateMailchimpUser(email, name, last_name);

  //turn list of subscriptions into dict with true values
  const updatedInterests: { [key: string]: boolean } = {};
  for (const subscription of subscriptions) {
    updatedInterests[subscription] = true;
  }

  await updateMailchimpInterests(email, updatedInterests);

  return new Response(JSON.stringify({ success: true }));
};