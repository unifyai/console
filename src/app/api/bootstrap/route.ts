import { NextRequest, NextResponse } from "next/server";
import { requireApiKey } from "@/lib/auth/requireApiKey";

const baseUrl = `${process.env.ORCHESTRA_URL}/v0`;

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const project = url.searchParams.get("project") || undefined;
  
  const apiKeyOrError = await requireApiKey(request);
  if (apiKeyOrError instanceof NextResponse) return apiKeyOrError;
  const apiKey = apiKeyOrError;

  const controller = new AbortController();
  const ttl = setTimeout(() => controller.abort(), 90000); // 90s timeout - bootstrap aggregates multiple slow endpoints
  try {
    const headers = {
      "Authorization": `Bearer ${apiKey}`,
      "accept": "application/json",
    } as const;

    const projectsTreePromise = fetch(`${baseUrl}/projects/tree`, {
      method: "GET",
      headers,
      cache: "no-store",
      signal: controller.signal,
    }).then(async (res) => ({ ok: res.ok, status: res.status, body: await res.json().catch(() => null) }));

    const interfacesPromise = project
      ? fetch(`${baseUrl}/interfaces/list?project=${encodeURIComponent(project)}`, {
          method: "GET",
          headers,
          cache: "no-store",
          signal: controller.signal,
        }).then(async (res) => ({ ok: res.ok, status: res.status, body: await res.json().catch(() => null) }))
      : Promise.resolve({ ok: true, status: 204, body: [] });

    const contextsPromise = project
      ? fetch(`${baseUrl}/project/${encodeURIComponent(project)}/contexts`, {
          method: "GET",
          headers: { ...headers, "Content-Type": "application/json" },
          signal: controller.signal,
        }).then(async (res) => ({ ok: res.ok, status: res.status, body: await res.json().catch(() => null) }))
      : Promise.resolve({ ok: true, status: 204, body: [] });

    const fieldsPromise = project
      ? fetch(`${baseUrl}/logs/fields?project=${encodeURIComponent(project)}`, {
          method: "GET",
          headers,
          signal: controller.signal,
        }).then(async (res) => ({ ok: res.ok, status: res.status, body: await res.json().catch(() => null) }))
      : Promise.resolve({ ok: true, status: 204, body: [] });

    const [projectsTree, interfaces, contexts, fields] = await Promise.all([
      projectsTreePromise,
      interfacesPromise,
      contextsPromise,
      fieldsPromise,
    ]);

    const responseBody = {
      project,
      projectsTree: Array.isArray(projectsTree.body) ? projectsTree.body : [],
      interfaces: Array.isArray(interfaces.body) ? interfaces.body : [],
      contexts: Array.isArray(contexts.body) ? contexts.body : [],
      fields: Array.isArray(fields.body) ? fields.body : [],
      fetchedAt: new Date().toISOString(),
      statuses: {
        projectsTree: projectsTree.status,
        interfaces: interfaces.status,
        contexts: contexts.status,
        fields: fields.status,
      },
    };

    return NextResponse.json(responseBody, { status: 200 });
  } catch (e: any) {
    const msg = e?.message || "Bootstrap failed";
    const status = /AbortError|aborted|timeout/i.test(msg) ? 504 : 502;
    console.error('[/api/bootstrap] Error:', msg, e);
    return NextResponse.json({ 
      error: "Bootstrap failed", 
      detail: msg,
      project 
    }, { status });
  } finally {
    clearTimeout(ttl);
  }
}



