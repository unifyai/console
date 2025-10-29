import { NextRequest } from "next/server";
import { getApiKeyFromRequest } from "@/lib/auth/getApiKey";

const baseUrl = `${process.env.ORCHESTRA_URL}/v0`;

export async function POST(request: NextRequest) {
    const body = await request.json();
    const apiKey = await getApiKeyFromRequest(request);
    const controller = new AbortController();
    const ttl = setTimeout(() => controller.abort(), 30000);
    const startedAt = Date.now();
    const correlationId = request.headers.get("x-correlation-id") || crypto.randomUUID();
    const res = await fetch(
        `${baseUrl}/logs/derived`,
        {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${apiKey}`,
                "Content-Type": "application/json",
                "x-correlation-id": correlationId,
            },
            body: JSON.stringify(body),
            signal: controller.signal,
        },
    );
    if (!res.ok) {
        console.warn(JSON.stringify({ route: "/api/logs/derived", method: "POST", upstream: `${baseUrl}/logs/derived`, status: res.status, latencyMs: Date.now() - startedAt, correlationId }));
    }
    clearTimeout(ttl);
    return res;
}

export async function PUT(request: NextRequest) {
    const body = await request.json();
    const apiKey = await getApiKeyFromRequest(request);
    const controller = new AbortController();
    const ttl = setTimeout(() => controller.abort(), 30000);
    const startedAt = Date.now();
    const correlationId = request.headers.get("x-correlation-id") || crypto.randomUUID();
    const res = await fetch(
        `${baseUrl}/logs/derived`,
        {
            method: "PUT",
            headers: {
                "Authorization": `Bearer ${apiKey}`,
                "Content-Type": "application/json",
                "x-correlation-id": correlationId,
            },
            body: JSON.stringify(body),
            signal: controller.signal,
        },
    );
    if (!res.ok) {
        console.warn(JSON.stringify({ route: "/api/logs/derived", method: "PUT", upstream: `${baseUrl}/logs/derived`, status: res.status, latencyMs: Date.now() - startedAt, correlationId }));
    }
    clearTimeout(ttl);
    return res;
}