import { NextResponse } from 'next/server';
import { execFile } from 'child_process';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { promisify } from 'util';
import { resolveCanonicalPersonalCoordinator } from '@/lib/assistants/coordinatorIdentity';
import { getOrchestraUserClient } from '@/lib/orchestra/orchestra-client';
import { isComposeSelfHostRuntime, isSelfHost } from '@/lib/environment/environment';
import { getCurrentUser } from '@/lib/user/user';
import { writeSelfHostOwner } from '@/lib/self-host/owner';
import type { Assistant } from '@/types/assistants/assistant';

const execFileAsync = promisify(execFile);

const RUNTIME_FILE =
  process.env.SELF_HOST_COORDINATOR_RUNTIME_FILE ??
  path.join(os.homedir(), '.unity', 'coordinator-runtime.json');

function parseAssistantList(raw: unknown): Assistant[] {
  if (!raw || typeof raw !== 'object') return [];
  const record = raw as Record<string, unknown>;
  const list = record.info ?? raw;
  if (!Array.isArray(list)) return [];
  return list as Assistant[];
}

async function persistCoordinatorRuntime(agentId: string, apiKey: string): Promise<void> {
  // In compose mode the Console and the Unity CM run as different uids and
  // share this file over a volume, so it must be world-readable; the volume
  // itself is the privacy boundary. Host mode keeps it owner-only.
  const mode = isComposeSelfHostRuntime() ? 0o644 : 0o600;
  await fs.mkdir(path.dirname(RUNTIME_FILE), { recursive: true });
  await fs.writeFile(
    RUNTIME_FILE,
    JSON.stringify({ coordinatorAgentId: agentId, apiKey }, null, 2),
    { mode }
  );
  // writeFile only applies mode on creation; fix up pre-existing files.
  await fs.chmod(RUNTIME_FILE, mode);
}

/**
 * POST /api/self-host/start-coordinator
 *
 * Starts the local Unity ConversationManager for the signed-in user's
 * personal Coordinator. Self-host installs only.
 */
export async function POST() {
  if (!isSelfHost()) {
    return NextResponse.json({ error: 'not_self_host' }, { status: 404 });
  }

  const user = await getCurrentUser();
  if (!user?.apiKey) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  // Record this account as the local owner so future visits auto sign-in
  // without a password prompt. Done before coordinator resolution so the
  // pointer is captured even if the Coordinator isn't ready yet.
  writeSelfHostOwner({ userId: user.id, email: user.email, name: user.name ?? null });

  const client = await getOrchestraUserClient(user.apiKey);
  const response = await client.get('/assistant');
  const assistants = parseAssistantList(response.data);
  const coordinator = resolveCanonicalPersonalCoordinator(assistants, user.id);

  if (!coordinator?.agentId) {
    return NextResponse.json({ error: 'coordinator_not_found' }, { status: 404 });
  }

  await persistCoordinatorRuntime(coordinator.agentId, user.apiKey);

  if (isComposeSelfHostRuntime()) {
    return NextResponse.json({
      ok: true,
      coordinatorAgentId: coordinator.agentId,
      runtimeMode: 'compose',
    });
  }

  const script = path.join(process.cwd(), 'scripts', 'local.sh');
  try {
    await execFileAsync('bash', [script, 'start-coordinator'], {
      env: {
        ...process.env,
        SELF_HOST: '1',
        SELF_HOST_UNIFY_KEY: user.apiKey,
        SELF_HOST_COORDINATOR_AGENT_ID: coordinator.agentId,
        SELF_HOST_COORDINATOR_RUNTIME_FILE: RUNTIME_FILE,
      },
      timeout: 120_000,
    });
    return NextResponse.json({
      ok: true,
      coordinatorAgentId: coordinator.agentId,
      runtimeMode: 'host',
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error
        ? error.message
        : typeof error === 'string'
          ? error
          : 'Failed to start Coordinator runtime';
    return NextResponse.json({ error: 'start_failed', message }, { status: 500 });
  }
}
