import { NextRequest } from "next/server";

const baseUrl = `${process.env.ORCHESTRA_URL}/v0/admin`;
const staging = process.env.ORCHESTRA_URL?.includes("staging");

export async function POST(request: NextRequest) {
    const { user_id, project, files } = await request.json();

    const response = await fetch(`${baseUrl}/file`, {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${request.headers.get("apiKey")}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({ user_id, project, files, staging }),
    });

    return response;
}

export async function GET(request: NextRequest) {
    const url = new URL(request.url);
    return await fetch(`${baseUrl}/file${url.search}&staging=${staging}`, {
        method: "GET",
        headers: {
            "Authorization": `Bearer ${request.headers.get("apiKey")}`,
            "accept": "application/json",
        },
    });
}

export async function DELETE(request: NextRequest) {
    const url = new URL(request.url);
    return await fetch(`${baseUrl}/file${url.search}&staging=${staging}`, {
        method: "DELETE",
        headers: {
            "Authorization": `Bearer ${request.headers.get("apiKey")}`,
            "accept": "application/json",
        },
    });
}