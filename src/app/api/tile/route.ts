import { NextRequest } from "next/server";
import { getApiKeyFromRequest } from "@/lib/auth/getApiKey";

const baseUrl = `${process.env.ORCHESTRA_URL}/v0`;

export async function GET(request: NextRequest) {
    const url = new URL(request.url);
    const searchParams = new URLSearchParams(url.search);
    
    // Check if we're getting a tile by ID, by parent+name, or listing tiles
    const hasId = searchParams.has('tile_id');
    const hasTabId = searchParams.has('tab_id');
    const hasName = searchParams.has('name');
    
    // Determine endpoint based on parameters
    let endpoint = "/tile/";
    
    // If we have a tab_id but no id or name, we're listing tiles
    if (hasTabId && !hasId && !hasName) {
        endpoint = "/tile/list";
    }
    
    // Let the backend handle the routing based on the query parameters
    const apiKey = await getApiKeyFromRequest(request);
    const controller = new AbortController();
    const ttl = setTimeout(() => controller.abort(), 30000);
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
            signal: controller.signal
        },
    );
    clearTimeout(ttl);
    if (!res.ok) {
      console.warn(JSON.stringify({ route: "/api/tile", method: "GET", upstream: `${baseUrl}${endpoint}${url.search}`, status: res.status, latencyMs: Date.now() - startedAt, correlationId }));
    }
    return res;
}

export async function POST(request: NextRequest) {
    const url = new URL(request.url);
    const searchParams = new URLSearchParams(url.search);
    
    // Check if this is a template operation
    const isExportTemplate = searchParams.has('export_template');
    const isImportTemplate = searchParams.has('import_template');
    
    let endpoint = "/tile/";
    
    if (isExportTemplate) {
        endpoint = "/tile/export_template";
    } else if (isImportTemplate) {
        endpoint = "/tile/import_template";
    }
    
    const body = await request.json();
    const apiKey = await getApiKeyFromRequest(request);
    // For POST, we always create a new resource, so the endpoint is fixed
    const controller = new AbortController();
    const ttl = setTimeout(() => controller.abort(), 30000);
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
            signal: controller.signal
        },
    );
    clearTimeout(ttl);
    if (!res.ok) {
      console.warn(JSON.stringify({ route: "/api/tile", method: "POST", upstream: `${baseUrl}${endpoint}`, status: res.status, latencyMs: Date.now() - startedAt, correlationId }));
    }
    return res;
}

export async function PUT(request: NextRequest) {
    const body = await request.json();
    const url = new URL(request.url);
    const apiKey = await getApiKeyFromRequest(request);
    
    // Pass all query parameters to allow both ID and parent+name updates
    const controller = new AbortController();
    const ttl = setTimeout(() => controller.abort(), 30000);
    const startedAt = Date.now();
    const correlationId = request.headers.get("x-correlation-id") || crypto.randomUUID();
    const res = await fetch(
        `${baseUrl}/tile/${url.search}`,
        {
            method: "PUT",
            headers: {
                "Authorization": `Bearer ${apiKey}`,
                "Content-Type": "application/json",
                "x-correlation-id": correlationId,
            },
            body: JSON.stringify(body),
            signal: controller.signal
        },
    );
    clearTimeout(ttl);
    if (!res.ok) {
      console.warn(JSON.stringify({ route: "/api/tile", method: "PUT", upstream: `${baseUrl}/tile/${url.search}`, status: res.status, latencyMs: Date.now() - startedAt, correlationId }));
    }
    return res;
}

export async function DELETE(request: NextRequest) {
    const url = new URL(request.url);
    const apiKey = await getApiKeyFromRequest(request);
    
    // Pass all query parameters to allow both ID and parent+name deletion
    const controller = new AbortController();
    const ttl = setTimeout(() => controller.abort(), 30000);
    const startedAt = Date.now();
    const correlationId = request.headers.get("x-correlation-id") || crypto.randomUUID();
    const res = await fetch(
        `${baseUrl}/tile/${url.search}`,
        {
            method: "DELETE",
            headers: {
                "Authorization": `Bearer ${apiKey}`,
                "accept": "application/json",
                "x-correlation-id": correlationId,
            },
            signal: controller.signal
        },
    );
    clearTimeout(ttl);
    if (!res.ok) {
      console.warn(JSON.stringify({ route: "/api/tile", method: "DELETE", upstream: `${baseUrl}/tile/${url.search}`, status: res.status, latencyMs: Date.now() - startedAt, correlationId }));
    }
    return res;
}

export async function PATCH(request: NextRequest) {
    const body = await request.json();
    const url = new URL(request.url);
    const searchParams = new URLSearchParams(url.search);

    // Check if this is a specialized patch
    const hasTileType = searchParams.has('tile_type');

    // Determine endpoint based on parameters
    let endpoint = "/tile/";
    
    // If we have a tileType, we're patching a specialized tile
    if (hasTileType) {
        endpoint = "/tile/specialized";
    }

    const apiKey = await getApiKeyFromRequest(request);
    // Pass all query parameters to allow both ID and parent+name updates
    const controller = new AbortController();
    const ttl = setTimeout(() => controller.abort(), 30000);
    const startedAt = Date.now();
    const correlationId = request.headers.get("x-correlation-id") || crypto.randomUUID();
    const res = await fetch(
        `${baseUrl}${endpoint}${url.search}`,
        {
            method: "PATCH",
            headers: {
                "Authorization": `Bearer ${apiKey}`,
                "Content-Type": "application/json",
                "x-correlation-id": correlationId,
            },
            body: JSON.stringify(body),
            signal: controller.signal
        },
    );
    clearTimeout(ttl);
    if (!res.ok) {
      console.warn(JSON.stringify({ route: "/api/tile", method: "PATCH", upstream: `${baseUrl}${endpoint}${url.search}`, status: res.status, latencyMs: Date.now() - startedAt, correlationId }));
    }
    return res;
}
