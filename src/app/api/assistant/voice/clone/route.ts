import { NextRequest, NextResponse } from "next/server";

const ORCHESTRA_BASE_URL = `${process.env.ORCHESTRA_URL}/v0`;

export async function POST(request: NextRequest) {
    const apiKey = request.headers.get("apiKey");
    if (!apiKey) {
        return NextResponse.json({ detail: "API key is missing" }, { status: 401 });
    }

    try {
        const formData = await request.formData();
        // We forward FormData directly to the backend
        const response = await fetch(
            `${ORCHESTRA_BASE_URL}/assistant/voice/clone`,
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
            console.error("Failed to parse JSON response from backend (voice/clone):", e);
            if (response.ok) return { detail: "Voice localization initiated, but response was not valid JSON."};
            return { detail: "Invalid JSON response from voice cloning service", status: response.status };
        });

        if (!response.ok) {
             console.error(`Backend Error (voice/clone - ${response.status}):`, responseData);
             return NextResponse.json({ detail: responseData.detail || "Failed to clone voice via backend service" }, { status: response.status });
        }
        
        return NextResponse.json(responseData, { status: response.status });

    } catch (error: any) {
        console.error("Error proxying to backend (voice/clone):", error);
        return NextResponse.json({ detail: "Failed to connect to voice cloning service", errorDetails: error.message }, { status: 503 });
    }
}