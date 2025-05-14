import { NextRequest, NextResponse } from "next/server";

const baseUrl = `${process.env.ORCHESTRA_URL}/v0`;

export async function GET(request: NextRequest) {
    return await fetch(
        `${baseUrl}/assistant`,
        {
            method: "GET",
            headers: {
                "Authorization": `Bearer ${request.headers.get("apiKey")}`,
                "accept": "application/json",
            }
        },
    );
}

export async function POST(request: NextRequest) {
    const apiKey = request.headers.get("apiKey");
    const requestBody = await request.json();

    try {
        const response = await fetch(
            `${process.env.ORCHESTRA_URL}/v0/assistant`,
            {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${apiKey}`,
                    "Content-Type": "application/json",
                    "accept": "application/json"
                },
                body: JSON.stringify(requestBody)
            }
        );

        const responseClone = response.clone();
        const responseData = await responseClone.json().catch(e => {
            console.error("Failed to parse JSON response from Unify API", e);
            return { error: "Invalid JSON response from backend API", status: response.status };
        });

        if (!response.ok) {
             console.error(`Unify API Error (${response.status}):`, responseData);
             return NextResponse.json(responseData, { status: response.status });
        }

        return response;

    } catch (error: any) {
        console.error("Error fetching Unify API in /api/assistant POST:", error);
        return NextResponse.json({ error: "Failed to connect to backend API", details: error.message }, { status: 500 });
    }
}