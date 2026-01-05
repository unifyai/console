import { NextRequest, NextResponse } from "next/server";
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
            `${baseUrl}/logs/columns${url.search}`,
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
        if (!res.ok && DEBUG_API) {
            console.warn(JSON.stringify({ route: "/api/logs/columns", method: "GET", upstream: `${baseUrl}/logs/columns${url.search}`, status: res.status, latencyMs: Date.now() - startedAt, correlationId }));
        }
        return res;
    } catch (e: any) {
        clearTimeout(ttl);
        const msg = e?.message || "Request failed";
        const status = /AbortError|aborted|timeout/i.test(msg) ? 504 : 502;
        console.error(JSON.stringify({ route: "/api/logs/columns", method: "GET", upstream: `${baseUrl}/logs/columns${url.search}`, error: msg, latencyMs: Date.now() - startedAt, correlationId }));
        return NextResponse.json({ detail: `Upstream ${status === 504 ? 'timeout' : 'error'}: ${msg}` }, { status });
    }
}
