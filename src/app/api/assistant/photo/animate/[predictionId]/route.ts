import { NextRequest, NextResponse } from "next/server";

const ORCHESTRA_BASE_URL = `${process.env.ORCHESTRA_URL}/v0`;

export async function GET(
    request: NextRequest,
    { params }: { params: { predictionId: string } }
) {
    const apiKey = request.headers.get("apiKey");
    if (!apiKey) {
        return NextResponse.json({ detail: "API key is missing" }, { status: 401 });
    }

    try {
        const response = await fetch(
            `${ORCHESTRA_BASE_URL}/assistant/photo/animate/${params.predictionId}`,
            {
                method: "GET",
                headers: {
                    "Authorization": `Bearer ${apiKey}`,
                },
                cache: 'no-store', // Ensure we get the latest status
            }
        );
        
        const responseData = await response.json();

        if (!response.ok) {
             console.error(`Backend Error (photo/animate GET - ${response.status}):`, responseData);
             return NextResponse.json({ detail: responseData.detail || "Failed to get animation status" }, { status: response.status });
        }
        
        return NextResponse.json(responseData, { status: response.status });

    } catch (error: any) {
        console.error("Error proxying to backend (photo/animate GET):", error);
        return NextResponse.json({ detail: "Failed to connect to animation service", errorDetails: error.message }, { status: 503 });
    }
}
