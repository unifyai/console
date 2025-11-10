import { NextRequest, NextResponse } from "next/server";
import { requireApiKey } from "@/lib/auth/requireApiKey";

const baseUrl = `${process.env.ORCHESTRA_URL}/v0`;
const DEBUG_API = process.env.NEXT_PUBLIC_DEBUG_API_ROUTES === "true";

export async function GET(request: NextRequest) {
    const url = new URL(request.url);
    const searchParams = new URLSearchParams(url.search);
    
    // Check if we're getting tab by ID, by parent+name, or listing tabs
    const hasId = searchParams.has('tab_id');
    const hasInterfaceId = searchParams.has('interface_id');
    const hasName = searchParams.has('name');
    
    // Determine endpoint based on parameters
    let endpoint = "/tab/";
    
    // If we have an interface_id but no id or name, we're listing tabs
    if (hasInterfaceId && !hasId && !hasName) {
        endpoint = "/tab/list";
    }
    
    // Let the backend handle the routing based on the query parameters
    const apiKeyOrError = await requireApiKey(request);
    if (apiKeyOrError instanceof NextResponse) return apiKeyOrError;
    const apiKey = apiKeyOrError;
    
    const controller = new AbortController();
    const ttl = setTimeout(() => controller.abort(), 30000);
    const startedAt = Date.now();
    const correlationId = request.headers.get("x-correlation-id") || crypto.randomUUID();
    
    try {
        const res = await fetch(
            `${baseUrl}${endpoint}${url.search}`,
            {
                method: "GET",
                headers: {
                    "Authorization": `Bearer ${apiKey}`,
                    "accept": "application/json",
                    "x-correlation-id": correlationId,
                },
                cache: "no-store",
                signal: controller.signal,
            },
        );
        clearTimeout(ttl);
        if (!res.ok) {
          console.warn(JSON.stringify({ route: "/api/tab", method: "GET", upstream: `${baseUrl}${endpoint}${url.search}`, status: res.status, latencyMs: Date.now() - startedAt, correlationId }));
        }
        return res;
    } catch (e: any) {
        clearTimeout(ttl);
        const msg = e?.message || "Request failed";
        const status = /AbortError|aborted|timeout/i.test(msg) ? 504 : 502;
        console.error(JSON.stringify({ route: "/api/tab", method: "GET", upstream: `${baseUrl}${endpoint}${url.search}`, error: msg, latencyMs: Date.now() - startedAt, correlationId }));
        return NextResponse.json({ detail: `Upstream ${status === 504 ? 'timeout' : 'error'}: ${msg}` }, { status });
    }
}

export async function POST(request: NextRequest) {
    const url = new URL(request.url);
    const searchParams = new URLSearchParams(url.search);
    
    // Check if this is a template operation
    const isExportTemplate = searchParams.has('export_template');
    const isImportTemplate = searchParams.has('import_template');
    
    let endpoint = "/tab/";
    
    if (isExportTemplate) {
        endpoint = "/tab/export_template";
    } else if (isImportTemplate) {
        endpoint = "/tab/import_template";
    }
    
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
            `${baseUrl}${endpoint}`,
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
          console.warn(JSON.stringify({ route: "/api/tab", method: "POST", upstream: `${baseUrl}${endpoint}`, status: res.status, latencyMs: Date.now() - startedAt, correlationId }));
        }
        return res;
    } catch (e: any) {
        clearTimeout(ttl);
        const msg = e?.message || "Request failed";
        const status = /AbortError|aborted|timeout/i.test(msg) ? 504 : 502;
        console.error(JSON.stringify({ route: "/api/tab", method: "POST", upstream: `${baseUrl}${endpoint}`, error: msg, latencyMs: Date.now() - startedAt, correlationId }));
        return NextResponse.json({ detail: `Upstream ${status === 504 ? 'timeout' : 'error'}: ${msg}` }, { status });
    }
}

export async function PUT(request: NextRequest) {
    const body = await request.json();
    const url = new URL(request.url);
    
    const apiKeyOrError = await requireApiKey(request);
    if (apiKeyOrError instanceof NextResponse) return apiKeyOrError;
    const apiKey = apiKeyOrError;
    
    const controller = new AbortController();
    const ttl = setTimeout(() => controller.abort(), 30000);
    const startedAt = Date.now();
    const correlationId = request.headers.get("x-correlation-id") || crypto.randomUUID();
    
    try {
        const res = await fetch(
            `${baseUrl}/tab/${url.search}`,
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
          console.warn(JSON.stringify({ route: "/api/tab", method: "PUT", upstream: `${baseUrl}/tab/${url.search}`, status: res.status, latencyMs: Date.now() - startedAt, correlationId }));
        }
        return res;
    } catch (e: any) {
        clearTimeout(ttl);
        const msg = e?.message || "Request failed";
        const status = /AbortError|aborted|timeout/i.test(msg) ? 504 : 502;
        console.error(JSON.stringify({ route: "/api/tab", method: "PUT", upstream: `${baseUrl}/tab/${url.search}`, error: msg, latencyMs: Date.now() - startedAt, correlationId }));
        return NextResponse.json({ detail: `Upstream ${status === 504 ? 'timeout' : 'error'}: ${msg}` }, { status });
    }
}

export async function DELETE(request: NextRequest) {
    const url = new URL(request.url);
    
    const apiKeyOrError = await requireApiKey(request);
    if (apiKeyOrError instanceof NextResponse) return apiKeyOrError;
    const apiKey = apiKeyOrError;
    
    const controller = new AbortController();
    const ttl = setTimeout(() => controller.abort(), 30000);
    const startedAt = Date.now();
    const correlationId = request.headers.get("x-correlation-id") || crypto.randomUUID();
    
    try {
        const res = await fetch(
            `${baseUrl}/tab/${url.search}`,
            {
                method: "DELETE",
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
          console.warn(JSON.stringify({ route: "/api/tab", method: "DELETE", upstream: `${baseUrl}/tab/${url.search}`, status: res.status, latencyMs: Date.now() - startedAt, correlationId }));
        }
        return res;
    } catch (e: any) {
        clearTimeout(ttl);
        const msg = e?.message || "Request failed";
        const status = /AbortError|aborted|timeout/i.test(msg) ? 504 : 502;
        console.error(JSON.stringify({ route: "/api/tab", method: "DELETE", upstream: `${baseUrl}/tab/${url.search}`, error: msg, latencyMs: Date.now() - startedAt, correlationId }));
        return NextResponse.json({ detail: `Upstream ${status === 504 ? 'timeout' : 'error'}: ${msg}` }, { status });
    }
}

export async function PATCH(request: NextRequest) {
    const body = await request.json();
    const url = new URL(request.url);
    
    const apiKeyOrError = await requireApiKey(request);
    if (apiKeyOrError instanceof NextResponse) return apiKeyOrError;
    const apiKey = apiKeyOrError;
    
    const controller = new AbortController();
    const ttl = setTimeout(() => controller.abort(), 30000);
    const startedAt = Date.now();
    const correlationId = request.headers.get("x-correlation-id") || crypto.randomUUID();
    
    try {
        const res = await fetch(
            `${baseUrl}/tab/${url.search}`,
            {
                method: "PATCH",
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
          console.warn(JSON.stringify({ route: "/api/tab", method: "PATCH", upstream: `${baseUrl}/tab/${url.search}`, status: res.status, latencyMs: Date.now() - startedAt, correlationId }));
        }
        return res;
    } catch (e: any) {
        clearTimeout(ttl);
        const msg = e?.message || "Request failed";
        const status = /AbortError|aborted|timeout/i.test(msg) ? 504 : 502;
        console.error(JSON.stringify({ route: "/api/tab", method: "PATCH", upstream: `${baseUrl}/tab/${url.search}`, error: msg, latencyMs: Date.now() - startedAt, correlationId }));
        return NextResponse.json({ detail: `Upstream ${status === 504 ? 'timeout' : 'error'}: ${msg}` }, { status });
    }
}
