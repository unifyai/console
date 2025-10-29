import { NextRequest } from "next/server";
import { getApiKeyFromRequest } from "@/lib/auth/getApiKey";

const baseUrl = `${process.env.ORCHESTRA_URL}/v0`;

export async function GET(request: NextRequest) {
    const url = new URL(request.url);
    const apiKey = await getApiKeyFromRequest(request);
    const controller = new AbortController();
    const ttl = setTimeout(() => controller.abort(), 30000);
    const startedAt = Date.now();
    const correlationId = request.headers.get("x-correlation-id") || crypto.randomUUID();
    const res = await fetch(
        `${baseUrl}/logs${url.search}`,
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
        console.warn(JSON.stringify({ route: "/api/logs", method: "GET", upstream: `${baseUrl}/logs${url.search}`, status: res.status, latencyMs: Date.now() - startedAt, correlationId }));
    }
    return res;
}

export async function DELETE(request: NextRequest) {
    const body = await request.json();
    const apiKey = await getApiKeyFromRequest(request);
    const controller = new AbortController();
    const ttl = setTimeout(() => controller.abort(), 30000);
    const startedAt = Date.now();
    const correlationId = request.headers.get("x-correlation-id") || crypto.randomUUID();
    const res = await fetch(
        `${baseUrl}/logs?delete_empty_logs=True`,
        {
            method: "DELETE",
            headers: {
                "Authorization": `Bearer ${apiKey}`,
                "Content-Type": "application/json",
                "x-correlation-id": correlationId,
            },
            body: JSON.stringify(body),
            signal: controller.signal,
        },
    );
    clearTimeout(ttl);
    if (!res.ok) {
        console.warn(JSON.stringify({ route: "/api/logs", method: "DELETE", upstream: `${baseUrl}/logs?delete_empty_logs=True`, status: res.status, latencyMs: Date.now() - startedAt, correlationId }));
    }
    return res;
}

export async function POST(request: NextRequest) {
    const body = await request.json();
    const apiKey = await getApiKeyFromRequest(request);
    const controller = new AbortController();
    const ttl = setTimeout(() => controller.abort(), 30000);
    const startedAt = Date.now();
    const correlationId = request.headers.get("x-correlation-id") || crypto.randomUUID();
    const res = await fetch(
        `${baseUrl}/logs`,
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
    clearTimeout(ttl);
    if (!res.ok) {
        console.warn(JSON.stringify({ route: "/api/logs", method: "POST", upstream: `${baseUrl}/logs`, status: res.status, latencyMs: Date.now() - startedAt, correlationId }));
    }
    return res;
}

export async function PUT(request: NextRequest) {
    const apiKey = await getApiKeyFromRequest(request);

    let body;
    try {
        body = await request.json();
    } catch (error) {
        console.error("Failed to parse JSON body in PUT /api/logs:", error);
        return new Response(JSON.stringify({ error: "Invalid request body" }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
        });
    }

    const controller = new AbortController();
    const ttl = setTimeout(() => controller.abort(), 30000);
    const startedAt = Date.now();
    const correlationId = request.headers.get("x-correlation-id") || crypto.randomUUID();
    const res = await fetch(
        `${baseUrl}/logs`,
        {
            method: "PUT",
            headers: {
                "Authorization": `Bearer ${apiKey}`,
                "Content-Type": "application/json",
                "accept": "application/json",
                "x-correlation-id": correlationId
            },
            body: JSON.stringify(body),
            signal: controller.signal
        }
    );
    clearTimeout(ttl);
    if (!res.ok) {
        console.warn(JSON.stringify({ route: "/api/logs", method: "PUT", upstream: `${baseUrl}/logs`, status: res.status, latencyMs: Date.now() - startedAt, correlationId }));
    }
    return res;
}