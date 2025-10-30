import { NextRequest, NextResponse } from "next/server";
import { requireApiKey } from "@/lib/auth/requireApiKey";

const baseUrl = `${process.env.ORCHESTRA_URL}/v0`;

export async function GET(request: NextRequest) {
  const apiKeyOrError = await requireApiKey(request);
  if (apiKeyOrError instanceof NextResponse) return apiKeyOrError;
  const apiKey = apiKeyOrError;
  
  try {
    const url = `${baseUrl}/projects/tree`;
    const startedAt = Date.now();
    const controller = new AbortController();
    const ttl = setTimeout(() => controller.abort(), 30000);
    const res = await fetch(url, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        accept: "application/json",
      },
      cache: "no-store",
      signal: controller.signal,
    });
    clearTimeout(ttl);
    const body = await res.text();
    const latencyMs = Date.now() - startedAt;
    if (!res.ok) {
      console.warn(JSON.stringify({
        route: "/api/projects/tree",
        upstream: url,
        status: res.status,
        latencyMs,
      }));
    }
    return new NextResponse(body, { status: res.status, headers: {
      "Content-Type": "application/json",
      // Enable edge caching with short TTL and SWR
      "Cache-Control": "s-maxage=60, stale-while-revalidate=120",
    } });
  } catch (e: any) {
    const msg = e?.message || "Failed to fetch project tree";
    const status = /AbortError|aborted|timeout/i.test(msg) ? 504 : 502;
    console.error('[/api/projects/tree] Error:', msg);
    return NextResponse.json({ detail: msg }, { status });
  }
} 