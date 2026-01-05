import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/user/user";

const baseUrl = `${process.env.ORCHESTRA_URL}/v0`;
const DEBUG_API = process.env.NEXT_PUBLIC_DEBUG_API_ROUTES === "true";
const ENABLE_BULK = process.env.ENABLE_BULK_TILE_PATCH !== "false"; // default enabled unless explicitly disabled

type UpdateItem = {
  id?: string;
  tab_id?: string;
  name?: string;
  updateData: Record<string, any>;
};

export async function POST(request: NextRequest) {
  const t0 = Date.now();
  if (!ENABLE_BULK) {
    return NextResponse.json({ detail: "Bulk patch disabled" }, { status: 501 });
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ detail: "Invalid JSON body" }, { status: 400 });
  }

  const updates: UpdateItem[] = Array.isArray(body?.updates) ? body.updates : [];
  if (!updates.length) {
    return NextResponse.json({ results: [], errors: [] }, { status: 200 });
  }

  // Get API key from session (fallback to header for backwards compatibility)
  const user = await getCurrentUser();
  const apiKey = user?.api_key || request.headers.get("apiKey");
  
  if (!apiKey) {
    return NextResponse.json({ detail: "Unauthorized - no API key" }, { status: 401 });
  }
  const correlationId = request.headers.get("x-correlation-id") || crypto.randomUUID();

  const results: any[] = [];
  const errors: Array<{ id?: string; tab_id?: string; name?: string; error: string }> = [];

  // Throttle concurrency to avoid overwhelming upstream
  const CONCURRENCY = 5;
  const chunks: UpdateItem[][] = [];
  for (let i = 0; i < updates.length; i += CONCURRENCY) {
    chunks.push(updates.slice(i, i + CONCURRENCY));
  }

  for (const chunk of chunks) {
    const responses = await Promise.allSettled(
      chunk.map(async (u) => {
        // Build URL based on id or (tab_id + name)
        let url = "";
        if (u.id) {
          url = `${baseUrl}/tile/?tile_id=${encodeURIComponent(u.id)}`;
        } else if (u.tab_id && u.name) {
          const qs = new URLSearchParams({ tab_id: u.tab_id, name: u.name });
          url = `${baseUrl}/tile/?${qs.toString()}`;
        } else {
          throw new Error("Missing id or (tab_id + name)");
        }

        const controller = new AbortController();
        const ttl = setTimeout(() => controller.abort(), 60000);
        try {
          const res = await fetch(url, {
            method: "PATCH",
            headers: {
              "Authorization": `Bearer ${apiKey}`,
              "Content-Type": "application/json",
              "x-correlation-id": correlationId,
            },
            body: JSON.stringify(u.updateData || {}),
            signal: controller.signal,
          });
          clearTimeout(ttl);

          if (!res.ok) {
            const text = await res.text().catch(() => String(res.status));
            throw new Error(`Upstream ${res.status}: ${text}`);
          }
          const json = await res.json().catch(() => ({}));
          return { ok: true, ref: { id: u.id, tab_id: u.tab_id, name: u.name }, data: json };
        } catch (e: any) {
          clearTimeout(ttl);
          throw new Error(e?.message || "Bulk patch failed");
        }
      })
    );

    responses.forEach((r, idx) => {
      const ref = chunk[idx];
      if (r.status === "fulfilled" && (r.value as any)?.ok) {
        results.push((r.value as any).data);
      } else {
        errors.push({ id: ref.id, tab_id: ref.tab_id, name: ref.name, error: (r as any)?.reason?.message || "Failed" });
      }
    });
  }

  if (DEBUG_API) {
    try {
      console.log(JSON.stringify({
        route: "/api/tile/bulk/patch",
        method: "POST",
        count: updates.length,
        results: results.length,
        errors: errors.length,
        ms: Date.now() - t0,
        correlationId,
      }));
    } catch {}
  }

  return NextResponse.json({ results, errors }, { status: 200 });
}
