import { NextRequest } from "next/server";
import { getApiKeyFromRequest } from "@/lib/auth/getApiKey";

const baseUrl = `${process.env.ORCHESTRA_URL}/v0`;

export async function GET(
    request: NextRequest,
    { params }: { params: { metricName: string, keyName: string } }
) {
    const url = new URL(request.url);
    const apiKey = await getApiKeyFromRequest(request);
    const controller = new AbortController();
    const ttl = setTimeout(() => controller.abort(), 30000);
    const startedAt = Date.now();
    const correlationId = request.headers.get("x-correlation-id") || crypto.randomUUID();
    const res = await fetch(
        `${baseUrl}/logs/metric/${params.metricName}${url.search}`,
        {
            method: "GET",
            headers: {
                "Authorization": `Bearer ${apiKey}`,
                "accept": "application/json",
                "x-correlation-id": correlationId,
            },
            signal: controller.signal,
        },
    );
    clearTimeout(ttl);
    if (!res.ok) {
        console.warn(JSON.stringify({ route: "/api/logs/[metricName]", method: "GET", upstream: `${baseUrl}/logs/metric/${params.metricName}${url.search}`, status: res.status, latencyMs: Date.now() - startedAt, correlationId }));
    }
    return res;
}
