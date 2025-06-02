import { NextRequest, NextResponse } from "next/server";

const ORCHESTRA_BASE_URL = `${process.env.ORCHESTRA_URL}/v0`;

export async function POST(request: NextRequest) {
    const apiKey = request.headers.get("apiKey");
    if (!apiKey) {
        return NextResponse.json({ detail: "API key is missing" }, { status: 401 });
    }

    try {
        const requestBody = await request.json();
        const response = await fetch(
            `${ORCHESTRA_BASE_URL}/assistant/voice/localize`,
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
            console.error("Failed to parse JSON response from backend (voice/localize):", e);
            if (response.ok) return { info: "Voice localization initiated, but response was not valid JSON."};
            return { detail: "Invalid JSON response from voice localization service", status: response.status };
        });

        if (!response.ok) {
             console.error(`Backend Error (voice/localize - ${response.status}):`, responseData);
             return NextResponse.json({ detail: responseData.detail || "Failed to localize voice via backend service" }, { status: response.status });
        }
        
        return NextResponse.json(responseData, { status: response.status });

    } catch (error: any) {
        console.error("Error proxying to backend (voice/localize):", error);
        return NextResponse.json({ detail: "Failed to connect to voice localization service", errorDetails: error.message }, { status: 503 });
    }
}