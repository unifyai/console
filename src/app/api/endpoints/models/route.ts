import { listModels } from "@/lib/endpoints/endpoints";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/user/user";

/**
 * Handles GET requests to retrieve a list of model names supported by the given provider.
 *
 * Extracts the 'provider' query parameter from the request URL,
 * and uses it to fetch the supported model names.
 *
 * @param request - The incoming NextRequest object containing the request information.
 * @returns A JSON response containing a list of model names.
 */
export async function GET(request: NextRequest) {
    const user = await getCurrentUser();

    if (!user) {
        return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const url = new URL(request.url);
    const provider = url.searchParams.get("provider");
    const models = await listModels(user.api_key, provider!);

    return NextResponse.json(models);
}