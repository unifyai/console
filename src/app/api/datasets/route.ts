import { NextRequest } from "next/server";

const baseUrl = `${process.env.ORCHESTRA_URL}/v0`;

export async function GET(request: NextRequest) {
    const response = await fetch(
        `${baseUrl}/datasets/`, 
        {
            method: "GET",
            headers: {
                "Authorization": `Bearer ${request.headers.get("apiKey")}`,
                "accept": "application/json",
            },
        }
    );
    if (!response.ok) {
       throw new Error("Network error");
    }
    return response;
}
