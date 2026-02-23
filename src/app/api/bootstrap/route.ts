import { NextRequest, NextResponse } from 'next/server';
import { getApiKeyFromRequest, unauthorized } from '../_utils/auth';
import { createOrchestraClient } from '@/lib/orchestra/client';

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  // Accept both project and projectName for backwards compatibility
  const project =
    url.searchParams.get('project') || url.searchParams.get('projectName') || undefined;

  const apiKey = await getApiKeyFromRequest(request);
  if (!apiKey) {
    return unauthorized();
  }

  const client = createOrchestraClient(apiKey);

  try {
    // Fetch all data in parallel
    const projectsTreePromise = client
      .GET('/v0/projects/tree', {})
      .then((result) => ({
        ok: !result.error,
        status: result.response.status,
        body: result.data ?? null,
      }))
      .catch(() => ({ ok: false, status: 500, body: null }));

    const interfacesPromise = project
      ? client
          .GET('/v0/interfaces/list', {
            params: { query: { project_name: project } },
          })
          .then((result) => ({
            ok: !result.error,
            status: result.response.status,
            body: result.data ?? null,
          }))
          .catch(() => ({ ok: false, status: 500, body: null }))
      : Promise.resolve({ ok: true, status: 204, body: [] });

    const contextsPromise = project
      ? client
          .GET('/v0/project/{project_name}/contexts', {
            params: { path: { project_name: project } },
          })
          .then((result) => ({
            ok: !result.error,
            status: result.response.status,
            body: result.data ?? null,
          }))
          .catch(() => ({ ok: false, status: 500, body: null }))
      : Promise.resolve({ ok: true, status: 204, body: [] });

    const fieldsPromise = project
      ? client
          .GET('/v0/logs/fields', {
            params: { query: { project_name: project } },
          })
          .then((result) => ({
            ok: !result.error,
            status: result.response.status,
            body: result.data ?? null,
          }))
          .catch(() => ({ ok: false, status: 500, body: null }))
      : Promise.resolve({ ok: true, status: 204, body: [] });

    const [projectsTree, interfaces, contexts, fields] = await Promise.all([
      projectsTreePromise,
      interfacesPromise,
      contextsPromise,
      fieldsPromise,
    ]);

    // Data is already transformed by the client middleware
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
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Bootstrap failed';
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
  }
}
