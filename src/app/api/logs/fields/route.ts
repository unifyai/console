import { NextRequest } from "next/server";

const baseUrl = `${process.env.ORCHESTRA_URL}/v0`;

export async function GET(request: NextRequest) {
    const url = new URL(request.url);
    return await fetch(
        `${baseUrl}/logs/fields${url.search}`,
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
        `${baseUrl}/logs/fields?delete_empty_logs=True`,
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

export async function PATCH(request: NextRequest) {
    const body = await request.json();

    return await fetch(
        `${baseUrl}/logs/rename_field`,
        {
            method: "PATCH",
            headers: {
                "Authorization": `Bearer ${request.headers.get("apiKey")}`,
                "Content-Type": "application/json",
                "accept": "application/json",
            },
            body: JSON.stringify(body),
        },
    );
}
