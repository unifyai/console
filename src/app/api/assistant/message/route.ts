import { NextRequest, NextResponse } from "next/server";

const baseUrl = `${process.env.ORCHESTRA_URL}/v0`;

export async function POST(request: NextRequest) {
    const apiKey = request.headers.get("apiKey");
    if (!apiKey) {
        return NextResponse.json({ detail: "API key is missing" }, { status: 401 });
    }

    const requestBody = await request.json();

    try {
        const orchestraResponse = await fetch(
            `${baseUrl}/assistant/message`,
            {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${apiKey}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(requestBody),
            }
        );

        const responseData = await orchestraResponse.json();

        if (!orchestraResponse.ok) {
            return NextResponse.json({ detail: responseData.detail || "Upstream API error" }, { status: orchestraResponse.status });
        }

        return NextResponse.json(responseData, { status: orchestraResponse.status });

    } catch (error: any) {
        console.error("[API /api/assistant/message] Error fetching Orchestra API:", error.message);
        return NextResponse.json({ detail: "Failed to connect to backend API", errorDetails: error.message }, { status: 500 });
    }
}
