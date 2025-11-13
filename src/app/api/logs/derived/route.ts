import { NextRequest, NextResponse } from "next/server";
import { requireApiKey } from "@/lib/auth/requireApiKey";

const baseUrl = `${process.env.ORCHESTRA_URL}/v0`;

export async function POST(request: NextRequest) {
    const body = await request.json();
    
    const apiKeyOrError = await requireApiKey(request);
    if (apiKeyOrError instanceof NextResponse) return apiKeyOrError;
    const apiKey = apiKeyOrError;
    
    const controller = new AbortController();
    const ttl = setTimeout(() => controller.abort(), 30000);
    const startedAt = Date.now();
    const correlationId = request.headers.get("x-correlation-id") || crypto.randomUUID();
    
    try {
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
        clearTimeout(ttl);
        if (!res.ok) {
            console.warn(JSON.stringify({ route: "/api/logs/derived", method: "POST", upstream: `${baseUrl}/logs/derived`, status: res.status, latencyMs: Date.now() - startedAt, correlationId }));
        }
        return res;
    } catch (e: any) {
        clearTimeout(ttl);
        const msg = e?.message || "Request failed";
        const status = /AbortError|aborted|timeout/i.test(msg) ? 504 : 502;
        console.error(JSON.stringify({ route: "/api/logs/derived", method: "POST", upstream: `${baseUrl}/logs/derived`, error: msg, latencyMs: Date.now() - startedAt, correlationId }));
        return NextResponse.json({ detail: `Upstream ${status === 504 ? 'timeout' : 'error'}: ${msg}` }, { status });
    }
}

export async function PUT(request: NextRequest) {
    const body = await request.json();
    
    const apiKeyOrError = await requireApiKey(request);
    if (apiKeyOrError instanceof NextResponse) return apiKeyOrError;
    const apiKey = apiKeyOrError;
    
    const controller = new AbortController();
    const ttl = setTimeout(() => controller.abort(), 30000);
    const startedAt = Date.now();
    const correlationId = request.headers.get("x-correlation-id") || crypto.randomUUID();
    
    try {
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
        clearTimeout(ttl);
        if (!res.ok) {
            console.warn(JSON.stringify({ route: "/api/logs/derived", method: "PUT", upstream: `${baseUrl}/logs/derived`, status: res.status, latencyMs: Date.now() - startedAt, correlationId }));
        }
        return res;
    } catch (e: any) {
        clearTimeout(ttl);
        const msg = e?.message || "Request failed";
        const status = /AbortError|aborted|timeout/i.test(msg) ? 504 : 502;
        console.error(JSON.stringify({ route: "/api/logs/derived", method: "PUT", upstream: `${baseUrl}/logs/derived`, error: msg, latencyMs: Date.now() - startedAt, correlationId }));
        return NextResponse.json({ detail: `Upstream ${status === 504 ? 'timeout' : 'error'}: ${msg}` }, { status });
    }
}