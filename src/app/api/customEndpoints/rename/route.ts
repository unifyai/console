import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/user/user";

const baseUrl = `${process.env.ORCHESTRA_URL}/v0`;

export async function POST(request: NextRequest) {
    // Get API key from session (fallback to header for backwards compatibility)
    const user = await getCurrentUser();
    const apiKey = user?.apiKey || request.headers.get("apiKey");
    
    if (!apiKey) {
        return NextResponse.json({ detail: "Unauthorized - no API key" }, { status: 401 });
    }
    
    const url = new URL(request.url);
    return await fetch(
        `${baseUrl}/custom_endpoint/rename${url.search}`,
        {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${apiKey}`
            }
        },
    );
}