import { NextRequest } from "next/server";
import { getApiKeyFromRequest } from "@/lib/auth/getApiKey";

const baseUrl = `${process.env.ORCHESTRA_URL}/v0`;

export async function GET(
    request: NextRequest,
    { params }: { params: { projectName: string } }
) {
    const apiKey = await getApiKeyFromRequest(request);
    const controller = new AbortController();
    const ttl = setTimeout(() => controller.abort(), 30000);
    const startedAt = Date.now();
    const correlationId = request.headers.get("x-correlation-id") || crypto.randomUUID();
    const res = await fetch(
        `${baseUrl}/project/${params.projectName}/contexts`,
        {
            method: "GET",
            headers: {
                "Authorization": `Bearer ${apiKey}`,
                "Content-Type": "application/json",
                "x-correlation-id": correlationId,
            },
            signal: controller.signal,
        },
    );
    clearTimeout(ttl);
    if (!res.ok) {
        console.warn(JSON.stringify({ route: "/api/context/[projectName]", method: "GET", upstream: `${baseUrl}/project/${params.projectName}/contexts`, status: res.status, latencyMs: Date.now() - startedAt, correlationId }));
    }
    return res;
}

export async function POST(
    request: NextRequest,
    { params }: { params: { projectName: string } }
) {
    const body = await request.json();
    const apiKey = await getApiKeyFromRequest(request);
    const controller = new AbortController();
    const ttl = setTimeout(() => controller.abort(), 30000);
    const startedAt = Date.now();
    const correlationId = request.headers.get("x-correlation-id") || crypto.randomUUID();
    const res = await fetch(
        `${baseUrl}/project/${params.projectName}/contexts`,
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
        console.warn(JSON.stringify({ route: "/api/context/[projectName]", method: "POST", upstream: `${baseUrl}/project/${params.projectName}/contexts`, status: res.status, latencyMs: Date.now() - startedAt, correlationId }));
    }
    return res;
}

export async function DELETE(
    request: NextRequest,
    { params }: { params: { projectName: string } }
) {
    const apiKey = await getApiKeyFromRequest(request);
    const controller = new AbortController();
    const ttl = setTimeout(() => controller.abort(), 30000);
    const startedAt = Date.now();
    const correlationId = request.headers.get("x-correlation-id") || crypto.randomUUID();
    const res = await fetch(
        `${baseUrl}/project/${params.projectName}/contexts`,
        {
            method: "DELETE",
            headers: {
                "Authorization": `Bearer ${apiKey}`,
                "Content-Type": "application/json",
                "x-correlation-id": correlationId,
            },
            signal: controller.signal,
        },
    );
    clearTimeout(ttl);
    if (!res.ok) {
        console.warn(JSON.stringify({ route: "/api/context/[projectName]", method: "DELETE", upstream: `${baseUrl}/project/${params.projectName}/contexts`, status: res.status, latencyMs: Date.now() - startedAt, correlationId }));
    }
    return res;
}
