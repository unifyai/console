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
            `${ORCHESTRA_BASE_URL}/assistant/photo/edit`,
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
            console.error("Failed to parse JSON response from backend (photo/edit):", e);
            if (response.ok) return { detail: "Photo edit initiated, but response was not valid JSON."};
            return { detail: "Invalid JSON response from photo editing service", status: response.status };
        });

        if (!response.ok) {
             console.error(`Backend Error (photo/edit - ${response.status}):`, responseData);
             return NextResponse.json({ detail: responseData.detail || "Failed to edit photo via backend service" }, { status: response.status });
        }
        
        return NextResponse.json(responseData, { status: response.status });

    } catch (error: any) {
        console.error("Error proxying to backend (photo/edit):", error);
        return NextResponse.json({ detail: "Failed to connect to photo editing service", errorDetails: error.message }, { status: 503 });
    }
}