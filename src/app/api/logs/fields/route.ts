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
        `${baseUrl}/logs/fields${url.search}`,
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
        console.warn(JSON.stringify({ route: "/api/logs/fields", method: "GET", upstream: `${baseUrl}/logs/fields${url.search}`, status: res.status, latencyMs: Date.now() - startedAt, correlationId }));
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
        `${baseUrl}/logs/fields?delete_empty_logs=True`,
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
        console.warn(JSON.stringify({ route: "/api/logs/fields", method: "DELETE", upstream: `${baseUrl}/logs/fields?delete_empty_logs=True`, status: res.status, latencyMs: Date.now() - startedAt, correlationId }));
    }
    return res;
}

export async function PATCH(request: NextRequest) {
    const body = await request.json();
    const apiKey = await getApiKeyFromRequest(request);
    const controller = new AbortController();
    const ttl = setTimeout(() => controller.abort(), 30000);
    const startedAt = Date.now();
    const correlationId = request.headers.get("x-correlation-id") || crypto.randomUUID();
    const res = await fetch(
        `${baseUrl}/logs/rename_field`,
        {
            method: "PATCH",
            headers: {
                "Authorization": `Bearer ${apiKey}`,
                "Content-Type": "application/json",
                "accept": "application/json",
                "x-correlation-id": correlationId,
            },
            body: JSON.stringify(body),
            signal: controller.signal,
        },
    );
    clearTimeout(ttl);
    if (!res.ok) {
        console.warn(JSON.stringify({ route: "/api/logs/fields", method: "PATCH", upstream: `${baseUrl}/logs/rename_field`, status: res.status, latencyMs: Date.now() - startedAt, correlationId }));
    }
    return res;
}
