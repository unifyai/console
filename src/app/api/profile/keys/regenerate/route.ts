import { regenerateUserKey } from "@/lib/user/key";
import { NextRequest } from "next/server";


/**
 * Regenerates the API key for the current user or active workspace.
 *
 * @returns {Response} A JSON response with the new API key.
 */
export async function GET(Request: NextRequest) {
    const userID = Request.nextUrl.searchParams.get("UserID");
    const organizationID = Request.nextUrl.searchParams.get("OrganizationID");

    if (!userID) {
        return new Response(JSON.stringify({ error: "User ID is required" }), { status: 400 });
    }

    // If OrganizationID is provided, it will regenerate the org key
    const key = await regenerateUserKey(userID, organizationID || undefined);
    return new Response(JSON.stringify({ key }), { status: 200 });
}