import {regenerateUserKey } from "@/lib/user/key";
import { NextRequest } from "next/server";


/**
 * Regenerates the API key for the current user.
 *
 * @returns {Response} A JSON response with the new API key.
 */
export async function GET(Request: NextRequest) {
    const userID = Request.nextUrl.searchParams.get("UserID");
   
    if (!userID) {
        return new Response(JSON.stringify({ error: "User ID is required" }), { status: 400 });
    }
    const key = await regenerateUserKey(userID);
    return new Response(JSON.stringify({ key }), { status: 200 });
}
