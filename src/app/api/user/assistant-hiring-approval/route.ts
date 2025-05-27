import { NextRequest, NextResponse } from "next/server";

const baseUrl = `${process.env.ORCHESTRA_URL}/v0`;

export async function POST(request: NextRequest) {
    const apiKey = request.headers.get("apiKey");

    try {
        const response = await fetch(
            `${baseUrl}/user/assistant-hiring-approval`,
            {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${apiKey}`,
                    "Content-Type": "application/json",
                    "accept": "application/json"
                },
            }
        );

        const responseData = await response.json().catch(e => {
            console.error("Failed to parse JSON response from Orchestra API (assistant-hiring-approval):", e);
            return { detail: "Invalid JSON response from backend API", status: response.status };
        });

        if (!response.ok) {
             console.error(`Orchestra API Error (assistant-hiring-approval - ${response.status}):`, responseData);
             return NextResponse.json(responseData, { status: response.status });
        }

        return NextResponse.json(responseData, { status: response.status });

    } catch (error: any) {
        console.error("Error proxying to Orchestra API (assistant-hiring-approval):", error);
        return NextResponse.json({ detail: "Failed to connect to backend API", errorDetails: error.message }, { status: 503 });
    }
}