import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/user/user';
import { snakeToCamelObject } from '@/utils/casing';

const baseUrl = `${process.env.ORCHESTRA_URL}/v0`;

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  // Accept both project and projectName for backwards compatibility
  const project =
    url.searchParams.get('project') || url.searchParams.get('projectName') || undefined;

  // Get API key from session (fallback to header for backwards compatibility)
  const user = await getCurrentUser();
  const apiKey = user?.apiKey || request.headers.get('apiKey');

  if (!apiKey) {
    return NextResponse.json({ detail: 'Unauthorized - no API key' }, { status: 401 });
  }

  const controller = new AbortController();
  const ttl = setTimeout(() => controller.abort(), 90000); // 90s timeout - bootstrap aggregates multiple slow endpoints
  try {
    const headers = {
      Authorization: `Bearer ${apiKey}`,
      accept: 'application/json',
    } as const;

    const projectsTreePromise = fetch(`${baseUrl}/projects/tree`, {
      method: 'GET',
      headers,
      cache: 'no-store',
      signal: controller.signal,
    }).then(async (res) => ({
      ok: res.ok,
      status: res.status,
      body: await res.json().catch(() => null),
    }));

    const interfacesPromise = project
      ? fetch(`${baseUrl}/interfaces/list?project_name=${encodeURIComponent(project)}`, {
          method: 'GET',
          headers,
          cache: 'no-store',
          signal: controller.signal,
        }).then(async (res) => ({
          ok: res.ok,
          status: res.status,
          body: await res.json().catch(() => null),
        }))
      : Promise.resolve({ ok: true, status: 204, body: [] });

    const contextsPromise = project
      ? fetch(`${baseUrl}/project/${encodeURIComponent(project)}/contexts`, {
          method: 'GET',
          headers: { ...headers, 'Content-Type': 'application/json' },
          signal: controller.signal,
        }).then(async (res) => ({
          ok: res.ok,
          status: res.status,
          body: await res.json().catch(() => null),
        }))
      : Promise.resolve({ ok: true, status: 204, body: [] });

    const fieldsPromise = project
      ? fetch(`${baseUrl}/logs/fields?project_name=${encodeURIComponent(project)}`, {
          method: 'GET',
          headers,
          signal: controller.signal,
        }).then(async (res) => ({
          ok: res.ok,
          status: res.status,
          body: await res.json().catch(() => null),
        }))
      : Promise.resolve({ ok: true, status: 204, body: [] });

    const [projectsTree, interfaces, contexts, fields] = await Promise.all([
      projectsTreePromise,
      interfacesPromise,
      contextsPromise,
      fieldsPromise,
    ]);

    // Transform each response body to camelCase
    const transformedProjectsTree = Array.isArray(projectsTree.body)
      ? snakeToCamelObject(projectsTree.body)
      : [];
    const transformedInterfaces = Array.isArray(interfaces.body)
      ? snakeToCamelObject(interfaces.body)
      : [];
    const transformedContexts = Array.isArray(contexts.body)
      ? snakeToCamelObject(contexts.body)
      : [];
    const transformedFields = Array.isArray(fields.body) ? snakeToCamelObject(fields.body) : [];

    const responseBody = {
      project,
      projectsTree: transformedProjectsTree,
      interfaces: transformedInterfaces,
      contexts: transformedContexts,
      fields: transformedFields,
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
    const msg = e?.message || 'Bootstrap failed';
    const status = /AbortError|aborted|timeout/i.test(msg) ? 504 : 502;
    console.error('[/api/bootstrap] Error:', msg, e);
    return NextResponse.json(
      {
        error: 'Bootstrap failed',
        detail: msg,
        project,
      },
      { status }
    );
  } finally {
    clearTimeout(ttl);
  }
}
