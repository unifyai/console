import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/user/user";

const COMMUNICATION_URL = process.env.COMMUNICATION_URL;

export async function GET(request: NextRequest) {
    // Get API key from session (fallback to header for backwards compatibility)
    const user = await getCurrentUser();
    const apiKey = user?.api_key || request.headers.get("apiKey");
    
    if (!apiKey) {
        return NextResponse.json({ detail: "Unauthorized - no API key" }, { status: 401 });
    }
    try {
        const response = await fetch(
            `${COMMUNICATION_URL}/social/available-platforms`,
            {
                method: "GET",
                headers: {
                    "Authorization": `Bearer ${apiKey}`,
                },
            }
        );

        const responseData = await response.json().catch(() => null);

        if (!response.ok) {
            console.error(`[API /api/contact/social/available-platforms GET] - Backend error (${response.status}):`, responseData);
            return NextResponse.json({ detail: responseData?.detail || "Unknown error from social platforms API" }, { status: response.status });
        }
        
        if (responseData && responseData.success && typeof responseData.platforms === 'object' && responseData.platforms !== null) {
            const platformsData = responseData.platforms as Record<string, number>;
            const platforms = Object.entries(platformsData).map(([name, cost]) => ({ name, cost }));
            return NextResponse.json({ success: true, platforms: platforms }, { status: 200 });
        }

        console.error(`[API /api/contact/social/available-platforms GET] - Invalid response format from backend:`, responseData);
        return NextResponse.json({ detail: "Invalid response format from social platforms API" }, { status: 502 });

    } catch (error: any) {
        console.error(`[API /api/contact/social/available-platforms GET] - Fetch error:`, error.message);
        return NextResponse.json({ detail: "Failed to connect to social platforms service", errorDetails: error.message }, { status: 503 });
    }
}