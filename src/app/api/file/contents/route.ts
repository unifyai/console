import { NextRequest } from "next/server";

const baseUrl = `${process.env.ORCHESTRA_URL}/v0/admin`;
const staging = process.env.ORCHESTRA_URL?.includes("staging");

export async function GET(request: NextRequest) {
    const url = new URL(request.url);
    return await fetch(`${baseUrl}/file/contents${url.search}&staging=${staging}`, {
        method: "GET",
        headers: {
            "Authorization": `Bearer ${request.headers.get("apiKey")}`,
            "accept": "application/json",
        },
    });
}