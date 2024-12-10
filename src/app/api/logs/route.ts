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
    return await fetch(
        `${baseUrl}/logs`,
        {
            method: "DELETE",
            headers: {
                "Authorization": `Bearer ${request.headers.get("apiKey")}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify(request.body)
        },
    );
}
