import { NextRequest } from "next/server";

const baseUrl = `${process.env.ORCHESTRA_URL}/v0`;

export async function POST(request: NextRequest) {
    const url = new URL(request.url);
    return await fetch(
        `${baseUrl}/custom_api_key${url.search}`,
        {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${request.headers.get("apiKey")}`
            }
        },
    );
}

export async function GET(request: NextRequest) {
    const url = new URL(request.url);
    return await fetch(
        `${baseUrl}/custom_api_key${url.search}`,
        {
            method: "GET",
            headers: {
                "Authorization": `Bearer ${request.headers.get("apiKey")}`
            }
        },
    );
}

export async function DELETE(request: NextRequest) {
    const url = new URL(request.url);
    return await fetch(
        `${baseUrl}/custom_api_key${url.search}`,
        {
            method: "DELETE",
            headers: {
                "Authorization": `Bearer ${request.headers.get("apiKey")}`
            }
        },
    );
}
