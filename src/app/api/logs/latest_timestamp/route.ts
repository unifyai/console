import { NextRequest, NextResponse } from "next/server";
import { requireApiKey } from "@/lib/auth/requireApiKey";

const baseUrl = `${process.env.ORCHESTRA_URL}/v0`;

export async function GET(request: NextRequest) {
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
            `${baseUrl}/logs/latest_timestamp${url.search}`,
            {
                method: "GET",
                headers: {
                    "Authorization": `Bearer ${apiKey}`,
                    "x-correlation-id": correlationId,
                },
                signal: controller.signal,
            },
        );
        clearTimeout(ttl);
        if (!res.ok) {
            console.warn(JSON.stringify({ route: "/api/logs/latest_timestamp", method: "GET", upstream: `${baseUrl}/logs/latest_timestamp${url.search}`, status: res.status, latencyMs: Date.now() - startedAt, correlationId }));
        }
        return res;
    } catch (e: any) {
        clearTimeout(ttl);
        const msg = e?.message || "Request failed";
        const status = /AbortError|aborted|timeout/i.test(msg) ? 504 : 502;
        console.error(JSON.stringify({ route: "/api/logs/latest_timestamp", method: "GET", upstream: `${baseUrl}/logs/latest_timestamp${url.search}`, error: msg, latencyMs: Date.now() - startedAt, correlationId }));
        return NextResponse.json({ detail: `Upstream ${status === 504 ? 'timeout' : 'error'}: ${msg}` }, { status });
    }
}
