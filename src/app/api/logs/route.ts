import { NextRequest, NextResponse } from "next/server";
import { withCacheHeaders } from "../_utils/cacheResponse";
import { getCurrentUser } from "@/lib/user/user";

const baseUrl = `${process.env.ORCHESTRA_URL}/v0`;
const DEBUG_API = process.env.NEXT_PUBLIC_DEBUG_API_ROUTES === "true";

export async function GET(request: NextRequest) {
    const url = new URL(request.url);
    
    // Get API key from session (fallback to header for backwards compatibility)
    const user = await getCurrentUser();
    const apiKey = user?.api_key || request.headers.get("apiKey");
    
    if (!apiKey) {
        return NextResponse.json({ detail: "Unauthorized - no API key" }, { status: 401 });
    }
    
    const controller = new AbortController();
    const ttl = setTimeout(() => controller.abort(), 60000);
    const startedAt = Date.now();
    const correlationId = request.headers.get("x-correlation-id") || crypto.randomUUID();
    
    try {
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
            if (DEBUG_API) {
                console.warn(JSON.stringify({ route: "/api/logs", method: "GET", upstream: `${baseUrl}/logs${url.search}`, status: res.status, latencyMs: Date.now() - startedAt, correlationId }));
            }
        }
        // Cache logs for 30 seconds - data changes frequently
        return withCacheHeaders(res, 'SHORT');
    } catch (e: any) {
        clearTimeout(ttl);
        const msg = e?.message || "Request failed";
        const status = /AbortError|aborted|timeout/i.test(msg) ? 504 : 502;
        console.error(JSON.stringify({ route: "/api/logs", method: "GET", upstream: `${baseUrl}/logs${url.search}`, error: msg, latencyMs: Date.now() - startedAt, correlationId }));
        return NextResponse.json({ detail: `Upstream ${status === 504 ? 'timeout' : 'error'}: ${msg}` }, { status });
    }
}

export async function DELETE(request: NextRequest) {
    const body = await request.json();
    
    // Get API key from session (fallback to header for backwards compatibility)
    const user = await getCurrentUser();
    const apiKey = user?.api_key || request.headers.get("apiKey");
    
    if (!apiKey) {
        return NextResponse.json({ detail: "Unauthorized - no API key" }, { status: 401 });
    }
    
    const controller = new AbortController();
    const ttl = setTimeout(() => controller.abort(), 60000);
    const startedAt = Date.now();
    const correlationId = request.headers.get("x-correlation-id") || crypto.randomUUID();
    
    try {
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
            if (DEBUG_API) {
                console.warn(JSON.stringify({ route: "/api/logs", method: "DELETE", upstream: `${baseUrl}/logs?delete_empty_logs=True`, status: res.status, latencyMs: Date.now() - startedAt, correlationId }));
            }
        }
        return res;
    } catch (e: any) {
        clearTimeout(ttl);
        const msg = e?.message || "Request failed";
        const status = /AbortError|aborted|timeout/i.test(msg) ? 504 : 502;
        console.error(JSON.stringify({ route: "/api/logs", method: "DELETE", upstream: `${baseUrl}/logs?delete_empty_logs=True`, error: msg, latencyMs: Date.now() - startedAt, correlationId }));
        return NextResponse.json({ detail: `Upstream ${status === 504 ? 'timeout' : 'error'}: ${msg}` }, { status });
    }
}

export async function POST(request: NextRequest) {
    const body = await request.json();
    
    // Get API key from session (fallback to header for backwards compatibility)
    const user = await getCurrentUser();
    const apiKey = user?.api_key || request.headers.get("apiKey");
    
    if (!apiKey) {
        return NextResponse.json({ detail: "Unauthorized - no API key" }, { status: 401 });
    }
    
    const controller = new AbortController();
    const ttl = setTimeout(() => controller.abort(), 60000);
    const startedAt = Date.now();
    const correlationId = request.headers.get("x-correlation-id") || crypto.randomUUID();
    
    try {
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
            if (DEBUG_API) {
                console.warn(JSON.stringify({ route: "/api/logs", method: "POST", upstream: `${baseUrl}/logs`, status: res.status, latencyMs: Date.now() - startedAt, correlationId }));
            }
        }
        return res;
    } catch (e: any) {
        clearTimeout(ttl);
        const msg = e?.message || "Request failed";
        const status = /AbortError|aborted|timeout/i.test(msg) ? 504 : 502;
        console.error(JSON.stringify({ route: "/api/logs", method: "POST", upstream: `${baseUrl}/logs`, error: msg, latencyMs: Date.now() - startedAt, correlationId }));
        return NextResponse.json({ detail: `Upstream ${status === 504 ? 'timeout' : 'error'}: ${msg}` }, { status });
    }
}

export async function PUT(request: NextRequest) {
    // Get API key from session (fallback to header for backwards compatibility)
    const user = await getCurrentUser();
    const apiKey = user?.api_key || request.headers.get("apiKey");
    
    if (!apiKey) {
        return NextResponse.json({ detail: "Unauthorized - no API key" }, { status: 401 });
    }

    let body;
    try {
        body = await request.json();
    } catch (error) {
        console.error("Failed to parse JSON body in PUT /api/logs:", error);
        return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    const controller = new AbortController();
    const ttl = setTimeout(() => controller.abort(), 60000);
    const startedAt = Date.now();
    const correlationId = request.headers.get("x-correlation-id") || crypto.randomUUID();
    
    try {
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
            if (DEBUG_API) {
                console.warn(JSON.stringify({ route: "/api/logs", method: "PUT", upstream: `${baseUrl}/logs`, status: res.status, latencyMs: Date.now() - startedAt, correlationId }));
            }
        }
        return res;
    } catch (e: any) {
        clearTimeout(ttl);
        const msg = e?.message || "Request failed";
        const status = /AbortError|aborted|timeout/i.test(msg) ? 504 : 502;
        console.error(JSON.stringify({ route: "/api/logs", method: "PUT", upstream: `${baseUrl}/logs`, error: msg, latencyMs: Date.now() - startedAt, correlationId }));
        return NextResponse.json({ detail: `Upstream ${status === 504 ? 'timeout' : 'error'}: ${msg}` }, { status });
    }
}
