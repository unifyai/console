import { NextRequest } from "next/server";

const baseUrl = `${process.env.ORCHESTRA_URL}/v0`;

export async function GET(request: NextRequest) {
    const url = new URL(request.url);
    return await fetch(
        `${baseUrl}/logs${url.search}`,
        {
            method: "GET",
            headers: {
                "Authorization": `Bearer ${request.headers.get("apiKey")}`,
                "accept": "application/json",
            }
        },
    );
}

export async function DELETE(request: NextRequest) {
    const body = await request.json();
    return await fetch(
        `${baseUrl}/logs?delete_empty_logs=True`,
        {
            method: "DELETE",
            headers: {
                "Authorization": `Bearer ${request.headers.get("apiKey")}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify(body)
        },
    );
}

export async function POST(request: NextRequest) {
    const body = await request.json();
    return await fetch(
        `${baseUrl}/logs`,
        {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${request.headers.get("apiKey")}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify(body)
        },
    );
}

export async function PUT(request: NextRequest) {
    const apiKey = request.headers.get("apiKey");

    let body;
    try {
        body = await request.json();
    } catch (error) {
        console.error("Failed to parse JSON body in PUT /api/logs:", error);
        return new Response(JSON.stringify({ error: "Invalid request body" }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
        });
    }

    return await fetch(
        `${baseUrl}/logs`,
        {
            method: "PUT",
            headers: {
                "Authorization": `Bearer ${apiKey}`,
                "Content-Type": "application/json",
                "accept": "application/json"
            },
            body: JSON.stringify(body)
        }
    );
}