import { NextRequest, NextResponse } from "next/server";

const COMMUNICATION_URL = process.env.COMMUNICATION_URL;

export async function GET(request: NextRequest) {
    const apiKey = request.headers.get("apiKey");
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