import { listProviders } from "@/lib/endpoints/endpoints";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/user/user";

/**
 * Handles GET requests to retrieve a list of provider names that support a specific model.
 *
 * Extracts the 'model' query parameter from the request URL,
 * and uses it to fetch the supported providers.
 *
 * @param request - The incoming NextRequest object containing the request information.
 * @returns A JSON response containing a list of provider names.
 */
export async function GET(request: NextRequest) {
    const user = await getCurrentUser();

    if (!user) {
        return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const url = new URL(request.url);
    const model = url.searchParams.get("model");
    const providers = await listProviders(user.apiKey, model!);
    return NextResponse.json(providers);
}