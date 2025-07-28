
import { NextRequest, NextResponse } from "next/server";

const ORCHESTRA_BASE_URL = `${process.env.ORCHESTRA_URL}/v0`;

export async function POST(request: NextRequest) {
    const apiKey = request.headers.get("apiKey");
    if (!apiKey) {
        return NextResponse.json({ detail: "API key is missing" }, { status: 401 });
    }

    try {
        const formData = await request.formData(); // Assistant video file

        const response = await fetch(
            `${ORCHESTRA_BASE_URL}/assistant/video/upload`,
            {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${apiKey}`,
                    // Content-Type is set automatically by fetch for FormData
                },
                body: formData,
            }
        );
        
        const responseData = await response.json().catch(e => {
            console.error("Failed to parse JSON response from backend (video/upload):", e);
            if (response.ok) return { detail: "Video upload initiated, but response was not valid JSON."};
            return { detail: "Invalid JSON response from video upload service", status: response.status };
        });

        if (!response.ok) {
             console.error(`Backend Error (video/upload - ${response.status}):`, responseData);
             return NextResponse.json({ detail: responseData.detail || "Failed to upload video via backend service" }, { status: response.status });
        }
        
        // Expects { info: { gcs_url: "..." } } from backend
        return NextResponse.json(responseData, { status: response.status });

    } catch (error: any) {
        console.error("Error proxying to backend (video/upload):", error);
        return NextResponse.json({ detail: "Failed to connect to video upload service", errorDetails: error.message }, { status: 503 });
    }
}