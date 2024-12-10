import {OrchestraAdminClient} from "../orchestra/orchestra-client";

/**
 * Retrieves the credit balance for a specific user.
 * 
 * @param userID - The ID of the user whose credits are to be retrieved.
 * @returns The user's credit balance.
 */
export async function getUserCredits(userID: string) {
    const response = await OrchestraAdminClient.get("/auth-user/credits", {
        params: { id: userID },
    });
    return response.data;
}