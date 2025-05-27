import { NextRequest, NextResponse } from "next/server";

const baseUrl = `${process.env.ORCHESTRA_URL}/v0`;

export async function POST(request: NextRequest) {

    const apiKey = request.headers.get("apiKey");
    const requestBody = await request.json();
    const { token } = requestBody;
    if (!token) {
        return NextResponse.json({ detail: "Missing required field: token" }, { status: 400 });
    }

    try {
        const response = await fetch(
            `${baseUrl}/user/claim-assistant-hiring-one-time-link`,
            {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${apiKey}`,
                    "Content-Type": "application/json",
                    "accept": "application/json"
                },
                body: JSON.stringify({ token })
            }
        );

        const responseData = await response.json().catch(e => {
            console.error("Failed to parse JSON response from Orchestra API (claim-assistant-hiring-one-time-link):", e);
            return { detail: "Invalid JSON response from backend API", status: response.status };
        });

        if (!response.ok) {
             console.error(`Orchestra API Error (claim-assistant-hiring-one-time-link - ${response.status}):`, responseData);
             return NextResponse.json(responseData, { status: response.status });
        }

        return NextResponse.json(responseData, { status: response.status });

    } catch (error: any) {
        console.error("Error proxying to Orchestra API (claim-assistant-hiring-one-time-link):", error);
        return NextResponse.json({ detail: "Failed to connect to backend API", errorDetails: error.message }, { status: 503 });
    }
}