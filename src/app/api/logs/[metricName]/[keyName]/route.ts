import { NextRequest } from "next/server";

const baseUrl = `${process.env.ORCHESTRA_URL}/v0`;

export async function GET(
    request: NextRequest,
    { params }: { params: { metricName: string, keyName: string } }
) {
    const url = new URL(request.url);
    return await fetch(
        `${baseUrl}/logs/metric/${params.metricName}/${params.keyName}${url.search}`,
        {
            method: "GET",
            headers: {
                "Authorization": `Bearer ${request.headers.get("apiKey")}`,
                "accept": "application/json",
            }
        },
    );
}
