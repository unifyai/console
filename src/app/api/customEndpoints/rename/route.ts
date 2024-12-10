import { NextRequest } from "next/server";

const baseUrl = `${process.env.ORCHESTRA_URL}/v0`;

export async function POST(request: NextRequest) {
    const url = new URL(request.url);
    return await fetch(
        `${baseUrl}/custom_endpoint/rename${url.search}`,
        {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${request.headers.get("apiKey")}`
            }
        },
    );
}