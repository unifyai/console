import fs from 'fs';
import os from 'os';
import path from 'path';
import { NextRequest, NextResponse } from 'next/server';
import { getApiKeyFromRequest, unauthorized, internalError } from '../../../_utils/auth';
import { isComposeSelfHostRuntime, isSelfHost } from '@/lib/environment/environment';
import { snakeToCamelObject } from '@/utils/casing';

const ORCHESTRA_BASE_URL = `${process.env.ORCHESTRA_URL}/v0`;
const ORCHESTRA_ADMIN_KEY = process.env.ORCHESTRA_ADMIN_KEY;
const SELF_HOST_SOURCE_JOB_NAME = 'local-coordinator-runtime';
const SELF_HOST_COMPOSE_JOB_NAME = 'compose-coordinator-runtime';

type AssistantStatusPayload = {
  running: boolean;
  jobName: string | null;
};

function unityHome(): string {
  return process.env.UNIFY_HOME ?? path.join(os.homedir(), '.unity');
}

function selfHostStateDir(): string {
  return process.env.SELF_HOST_STATE_DIR ?? unityHome();
}

function coordinatorRuntimeFile(): string {
  return (
    process.env.SELF_HOST_COORDINATOR_RUNTIME_FILE ??
    path.join(selfHostStateDir(), 'coordinator-runtime.json')
  );
}

function runtimeStateFile(): string {
  return path.join(selfHostStateDir(), 'runtime-state.json');
}

function readJsonFile(filePath: string): Record<string, unknown> | null {
  if (!fs.existsSync(filePath)) return null;
  try {
    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function stringValue(value: unknown): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return String(value);
  return '';
}

function localCoordinatorAssistantId(): string {
  const configured = process.env.SELF_HOST_COORDINATOR_AGENT_ID;
  if (configured) return configured;

  const runtime = readJsonFile(coordinatorRuntimeFile());
  return stringValue(runtime?.coordinatorAgentId ?? runtime?.coordinator_agent_id);
}

function processIsAlive(pidValue: unknown): boolean {
  const pid = Number(pidValue);
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function sourceSelfHostStatus(assistantId: string): AssistantStatusPayload {
  const runtimeState = readJsonFile(runtimeStateFile());
  const runningAssistantId = stringValue(runtimeState?.assistant_id);
  const running = runningAssistantId === assistantId && processIsAlive(runtimeState?.pid);

  return {
    running,
    jobName: running ? SELF_HOST_SOURCE_JOB_NAME : null,
  };
}

function selfHostStatus(assistantId: string): AssistantStatusPayload | null {
  if (!isSelfHost()) return null;

  const coordinatorId = localCoordinatorAssistantId();
  if (!coordinatorId || coordinatorId !== assistantId) return null;

  // Compose self-host runs the Coordinator in a sibling container, outside the
  // process namespace visible to Console.
  if (isComposeSelfHostRuntime()) {
    return { running: true, jobName: SELF_HOST_COMPOSE_JOB_NAME };
  }

  return sourceSelfHostStatus(assistantId);
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ assistantId: string }> }
) {
  const { assistantId } = await params;
  // Verify user is authenticated
  const apiKey = await getApiKeyFromRequest(request);
  if (!apiKey) {
    return unauthorized();
  }

  const localStatus = selfHostStatus(assistantId);
  if (localStatus) {
    return NextResponse.json(localStatus);
  }

  // Admin endpoints require ORCHESTRA_ADMIN_KEY
  if (!ORCHESTRA_ADMIN_KEY) {
    console.error('[API /assistant/[id]/status] ORCHESTRA_ADMIN_KEY not configured');
    return internalError('Server configuration error');
  }

  try {
    const response = await fetch(`${ORCHESTRA_BASE_URL}/admin/assistant/${assistantId}/status`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${ORCHESTRA_ADMIN_KEY}`,
        'Content-Type': 'application/json',
      },
      // Add a no-cache header to ensure we get the latest status
      cache: 'no-store',
    });

    // Read the body as text ONCE.
    const responseText = await response.text();
    let responseData;

    // Try to parse the text as JSON.
    try {
      responseData = JSON.parse(responseText);
    } catch (e) {
      // If parsing fails, it's not JSON. Use the raw text as the detail.
      // This handles the case where the backend returns an HTML 404 page.
      responseData = { detail: responseText || 'Received a non-JSON response from the backend.' };
    }

    if (!response.ok) {
      console.error(
        `Backend Error (assistant status - ${response.status}) for assistant ${assistantId}:`,
        responseData
      );
      // Ensure responseData has a 'detail' property for the client.
      const detail = responseData.detail || JSON.stringify(responseData);
      return NextResponse.json({ detail }, { status: response.status });
    }

    // Orchestra wraps responses in { info: ... }, unwrap for cleaner client API
    const payload =
      responseData && typeof responseData === 'object' && 'info' in responseData
        ? responseData.info
        : responseData;
    const camelCaseResponse = snakeToCamelObject(payload);

    return NextResponse.json(camelCaseResponse, { status: response.status });
  } catch (error: any) {
    console.error(
      `Error proxying to backend for assistant status (assistant ${assistantId}):`,
      error
    );
    return internalError('Failed to connect to assistant status service');
  }
}
