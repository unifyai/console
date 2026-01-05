import { NextRequest, NextResponse } from "next/server";
import { withCacheHeaders } from "../_utils/cacheResponse";
import { getCurrentUser } from "@/lib/user/user";

const baseUrl = `${process.env.ORCHESTRA_URL}/v0`;
const DEBUG_API = process.env.NEXT_PUBLIC_DEBUG_API_ROUTES === "true";

export async function GET(request: NextRequest) {
    const url = new URL(request.url);
    const searchParams = new URLSearchParams(url.search);
    
    // Get API key from session (fallback to header for backwards compatibility)
    const user = await getCurrentUser();
    const apiKey = user?.api_key || request.headers.get("apiKey");
    
    if (!apiKey) {
        return NextResponse.json({ detail: "Unauthorized - no API key" }, { status: 401 });
    }
    
    // Check if we're getting interface by ID, by path components, or listing interfaces
    const hasInterfaceId = searchParams.has('interface_id');
    const hasProjectId = searchParams.has('project');
    const hasName = searchParams.has('name');
    
    // Determine endpoint based on parameters
    let endpoint = "/interfaces/";
    
    // If project is present but no name or id, we're listing
    if (hasProjectId && !hasName && !hasInterfaceId) {
        endpoint = "/interfaces/list";
    }
    
    try {
      const controller = new AbortController();
      const ttl = setTimeout(() => controller.abort(), 60000);
      const startedAt = Date.now();
      const correlationId = request.headers.get("x-correlation-id") || crypto.randomUUID();
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
      if (!res.ok && DEBUG_API) {
        console.warn(JSON.stringify({ route: "/api/interface", method: "GET", upstream: `${baseUrl}${endpoint}${url.search}`, status: res.status, latencyMs: Date.now() - startedAt, correlationId }));
      }
      // Cache interface data for 60 seconds
      return withCacheHeaders(res, 'MEDIUM');
    } catch (e: any) {
      const msg = e?.message || "Request failed";
      const status = /AbortError|aborted/i.test(msg) ? 504 : 502;
      return NextResponse.json({ detail: `Upstream ${status === 504 ? 'timeout' : 'error'} calling ${baseUrl}${endpoint}${url.search}: ${msg}` }, { status });
    }
}

export async function PUT(request: NextRequest) {
    const body = await request.json();
    const url = new URL(request.url);
    
    // Get API key from session (fallback to header for backwards compatibility)
    const user = await getCurrentUser();
    const apiKey = user?.api_key || request.headers.get("apiKey");
    
    if (!apiKey) {
        return NextResponse.json({ detail: "Unauthorized - no API key" }, { status: 401 });
    }
    
    try {
      const controller = new AbortController();
      const ttl = setTimeout(() => controller.abort(), 60000);
      const startedAt = Date.now();
      const correlationId = request.headers.get("x-correlation-id") || crypto.randomUUID();
      const res = await fetch(
          `${baseUrl}/interfaces/${url.search}`,
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
      if (!res.ok && DEBUG_API) {
        console.warn(JSON.stringify({ route: "/api/interface", method: "PUT", upstream: `${baseUrl}/interfaces/${url.search}`, status: res.status, latencyMs: Date.now() - startedAt, correlationId }));
      }
      return res;
    } catch (e: any) {
      const msg = e?.message || "Request failed";
      const status = /AbortError|aborted/i.test(msg) ? 504 : 502;
      return NextResponse.json({ detail: `Upstream ${status === 504 ? 'timeout' : 'error'} calling ${baseUrl}/interfaces/${url.search}: ${msg}` }, { status });
    }
}

export async function POST(request: NextRequest) {
    const url = new URL(request.url);
    const searchParams = new URLSearchParams(url.search);
    
    // Get API key from session (fallback to header for backwards compatibility)
    const user = await getCurrentUser();
    const apiKey = user?.api_key || request.headers.get("apiKey");
    
    if (!apiKey) {
        return NextResponse.json({ detail: "Unauthorized - no API key" }, { status: 401 });
    }
    
    // Check if this is a template operation
    const isExportTemplate = searchParams.has('export_template');
    const isImportTemplate = searchParams.has('import_template');
    
    let endpoint = "/interfaces/";
    
    if (isExportTemplate) {
        endpoint = "/interfaces/export_template";
    } else if (isImportTemplate) {
        endpoint = "/interfaces/import_template";
    }
    
    const body = await request.json();
    
    try {
      // For POST, we always create a new resource, so the endpoint is fixed
      const controller = new AbortController();
      const ttl = setTimeout(() => controller.abort(), 60000);
      const startedAt = Date.now();
      const correlationId = request.headers.get("x-correlation-id") || crypto.randomUUID();
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
      if (!res.ok && DEBUG_API) {
        console.warn(JSON.stringify({ route: "/api/interface", method: "POST", upstream: `${baseUrl}${endpoint}`, status: res.status, latencyMs: Date.now() - startedAt, correlationId }));
      }
      return res;
    } catch (e: any) {
      const msg = e?.message || "Request failed";
      const status = /AbortError|aborted/i.test(msg) ? 504 : 502;
      return NextResponse.json({ detail: `Upstream ${status === 504 ? 'timeout' : 'error'} calling ${baseUrl}${endpoint}: ${msg}` }, { status });
    }
}

export async function DELETE(request: NextRequest) {
    const url = new URL(request.url);
    
    // Get API key from session (fallback to header for backwards compatibility)
    const user = await getCurrentUser();
    const apiKey = user?.api_key || request.headers.get("apiKey");
    
    if (!apiKey) {
        return NextResponse.json({ detail: "Unauthorized - no API key" }, { status: 401 });
    }
    
    try {
      // Pass all query parameters to allow both ID and path-based deletion
      const controller = new AbortController();
      const ttl = setTimeout(() => controller.abort(), 60000);
      const startedAt = Date.now();
      const correlationId = request.headers.get("x-correlation-id") || crypto.randomUUID();
      const res = await fetch(
          `${baseUrl}/interfaces/${url.search}`,
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
      if (!res.ok && DEBUG_API) {
        console.warn(JSON.stringify({ route: "/api/interface", method: "DELETE", upstream: `${baseUrl}/interfaces/${url.search}`, status: res.status, latencyMs: Date.now() - startedAt, correlationId }));
      }
      return res;
    } catch (e: any) {
      const msg = e?.message || "Request failed";
      const status = /AbortError|aborted/i.test(msg) ? 504 : 502;
      return NextResponse.json({ detail: `Upstream ${status === 504 ? 'timeout' : 'error'} calling ${baseUrl}/interfaces/${url.search}: ${msg}` }, { status });
    }
}
