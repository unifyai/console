import fs from 'fs';
import os from 'os';
import path from 'path';
import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const getApiKeyFromRequestMock = vi.hoisted(() => vi.fn());

vi.mock('@/app/api/_utils/auth', () => {
  const jsonResponse = (payload: unknown, status: number) =>
    new Response(JSON.stringify(payload), {
      status,
      headers: { 'Content-Type': 'application/json' },
    });
  return {
    getApiKeyFromRequest: getApiKeyFromRequestMock,
    unauthorized: (message = 'Unauthorized - no API key') => jsonResponse({ error: message }, 401),
    internalError: (message = 'Internal server error') => jsonResponse({ error: message }, 500),
  };
});

function request(assistantId: string): NextRequest {
  return new NextRequest(`http://localhost/api/assistant/${assistantId}/status`);
}

async function loadRoute() {
  vi.resetModules();
  return import('@/app/api/assistant/[assistantId]/status/route');
}

function writeJson(filePath: string, payload: Record<string, unknown>): void {
  fs.writeFileSync(filePath, JSON.stringify(payload), 'utf8');
}

describe('assistant status route', () => {
  let tempDir: string;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('fetch', vi.fn());
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'assistant-status-'));

    process.env.SELF_HOST = '1';
    process.env.NEXT_PUBLIC_SELF_HOST = '1';
    process.env.UNIFY_HOME = tempDir;
    process.env.SELF_HOST_STATE_DIR = tempDir;
    process.env.ORCHESTRA_URL = 'http://127.0.0.1:8000';
    delete process.env.ORCHESTRA_ADMIN_KEY;
    delete process.env.SELF_HOST_COORDINATOR_AGENT_ID;
    delete process.env.SELF_HOST_COORDINATOR_RUNTIME_FILE;
    delete process.env.SELF_HOST_RUNTIME_MODE;

    getApiKeyFromRequestMock.mockResolvedValue('user-api-key');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    fs.rmSync(tempDir, { recursive: true, force: true });
    delete process.env.SELF_HOST;
    delete process.env.NEXT_PUBLIC_SELF_HOST;
    delete process.env.UNIFY_HOME;
    delete process.env.SELF_HOST_STATE_DIR;
    delete process.env.ORCHESTRA_URL;
    delete process.env.ORCHESTRA_ADMIN_KEY;
    delete process.env.SELF_HOST_COORDINATOR_AGENT_ID;
    delete process.env.SELF_HOST_COORDINATOR_RUNTIME_FILE;
    delete process.env.SELF_HOST_RUNTIME_MODE;
  });

  it('rejects unauthenticated requests before reading local runtime state', async () => {
    getApiKeyFromRequestMock.mockResolvedValue(null);
    const { GET } = await loadRoute();

    const response = await GET(request('123'), {
      params: Promise.resolve({ assistantId: '123' }),
    });

    expect(response.status).toBe(401);
  });

  it('reports source self-host Coordinator online when the recorded CM process is alive', async () => {
    writeJson(path.join(tempDir, 'coordinator-runtime.json'), {
      coordinatorAgentId: '123',
      apiKey: 'user-api-key',
    });
    writeJson(path.join(tempDir, 'runtime-state.json'), {
      assistant_id: '123',
      pid: process.pid,
    });
    const fetchSpy = vi.mocked(fetch);
    const { GET } = await loadRoute();

    const response = await GET(request('123'), {
      params: Promise.resolve({ assistantId: '123' }),
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ running: true, jobName: 'local-coordinator-runtime' });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('reports source self-host Coordinator offline when runtime state is stale', async () => {
    writeJson(path.join(tempDir, 'coordinator-runtime.json'), {
      coordinatorAgentId: '123',
      apiKey: 'user-api-key',
    });
    writeJson(path.join(tempDir, 'runtime-state.json'), {
      assistant_id: '123',
      pid: 'not-a-pid',
    });
    const { GET } = await loadRoute();

    const response = await GET(request('123'), {
      params: Promise.resolve({ assistantId: '123' }),
    });
    const body = await response.json();

    expect(body).toEqual({ running: false, jobName: null });
  });

  it('reports compose self-host Coordinator online from the shared runtime file', async () => {
    process.env.SELF_HOST_RUNTIME_MODE = 'compose';
    writeJson(path.join(tempDir, 'coordinator-runtime.json'), {
      coordinatorAgentId: '123',
      apiKey: 'user-api-key',
    });
    const fetchSpy = vi.mocked(fetch);
    const { GET } = await loadRoute();

    const response = await GET(request('123'), {
      params: Promise.resolve({ assistantId: '123' }),
    });
    const body = await response.json();

    expect(body).toEqual({ running: true, jobName: 'compose-coordinator-runtime' });
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
