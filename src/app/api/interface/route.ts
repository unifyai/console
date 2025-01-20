import { NextRequest } from "next/server";

// const baseUrl = `${process.env.ORCHESTRA_URL}/v0`;
const baseUrl = "http://localhost:8000/v0";

export async function GET(request: NextRequest) {
    const url = new URL(request.url);
    return await fetch(
        `${baseUrl}/interface${url.search}`,
        {
            method: "GET",
            headers: {
                "Authorization": `Bearer ${request.headers.get("apiKey")}`,
                "accept": "application/json",
            }
        },
    );
}

export async function PUT(request: NextRequest) {
    const body = await request.json();
    return await fetch(
        `${baseUrl}/interface`,
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

export async function POST(request: NextRequest) {
    const body = await request.json();
    return await fetch(
        `${baseUrl}/interface`,
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
