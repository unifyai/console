import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/user/user";

const ORCHESTRA_BASE_URL = `${process.env.ORCHESTRA_URL}/v0`;

export async function POST(request: NextRequest) {
    // Get API key from session (fallback to header for backwards compatibility)
    const user = await getCurrentUser();
    const apiKey = user?.api_key || request.headers.get("apiKey");
    
    if (!apiKey) {
        return NextResponse.json({ detail: "Unauthorized - no API key" }, { status: 401 });
    }

    try {
        const requestBody = await request.json();

        const response = await fetch(
            `${ORCHESTRA_BASE_URL}/assistant/photo/generate`,
            {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${apiKey}`,
                    "Content-Type": "application/json",
                    "accept": "application/json",
                },
                body: JSON.stringify(requestBody),
            }
        );
        
        const responseData = await response.json().catch(e => {
            console.error("Failed to parse JSON response from backend (photo/generate):", e);
            if (response.ok) return { detail: "Photo generation initiated, but response was not valid JSON."};
            return { detail: "Invalid JSON response from photo generation service", status: response.status };
        });

        if (!response.ok) {
             console.error(`Backend Error (photo/generate - ${response.status}):`, responseData);
             return NextResponse.json({ detail: responseData.detail || "Failed to generate photo via backend service" }, { status: response.status });
        }
        
        return NextResponse.json(responseData, { status: response.status });

    } catch (error: any) {
        console.error("Error proxying to backend (photo/generate):", error);
        return NextResponse.json({ detail: "Failed to connect to photo generation service", errorDetails: error.message }, { status: 503 });
    }
}