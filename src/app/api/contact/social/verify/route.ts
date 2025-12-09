import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/user/user";

const COMMUNICATION_URL = process.env.COMMUNICATION_URL;

export async function POST(request: NextRequest) {
    // Get API key from session (fallback to header for backwards compatibility)
    const user = await getCurrentUser();
    const apiKey = user?.apiKey || request.headers.get("apiKey");
    
    if (!apiKey) {
        return NextResponse.json({ detail: "Unauthorized - no API key" }, { status: 401 });
    }

    let requestBody;
    try {
        requestBody = await request.json();
    } catch (error) {
        return NextResponse.json({ detail: "Invalid request body" }, { status: 400 });
    }

    const { platform, account_identifier } = requestBody;
    if (!platform || !account_identifier) {
        return NextResponse.json({ detail: "Missing required fields: platform, account_identifier" }, { status: 400 });
    }

    try {
        const response = await fetch(
            `${COMMUNICATION_URL}/social/verify`,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${apiKey}`,
                },
                body: JSON.stringify({ platform, account_identifier })
            }
        );
        
        const responseData = await response.json().catch(() => null);

        if (!response.ok) {
            console.error(`[API /api/contact/social/verify POST] - Backend error (${response.status}):`, responseData);
            return NextResponse.json({ detail: responseData?.detail || "Unknown error from verification service" }, { status: response.status });
        }

        return NextResponse.json(responseData, { status: response.status });

    } catch (error: any) {
        console.error(`[API /api/contact/social/verify POST] - Fetch error:`, error.message);
        return NextResponse.json({ detail: "Failed to connect to verification service", errorDetails: error.message }, { status: 503 });
    }
}