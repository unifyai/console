import { NextRequest } from "next/server";

const baseUrl = `${process.env.ORCHESTRA_URL}/v0`;

export async function PUT(request: NextRequest) {
    const body = await request.json();
    return await fetch(
        `${baseUrl}/logs/derived`,
        {
            method: "PUT",
            headers: {
                "Authorization": `Bearer ${request.headers.get("apiKey")}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify(body)
        },
    );
}