import { execFile } from 'child_process';
import { access } from 'fs/promises';
import path from 'path';
import { promisify } from 'util';
import { NextResponse } from 'next/server';
import { isSelfHost } from '@/lib/environment/environment';
import { getCurrentUser } from '@/lib/user/user';

const execFileAsync = promisify(execFile);

function resetEnabled(): boolean {
  return isSelfHost() && process.env.NODE_ENV === 'development';
}

function resolveDeployRepoPath(): string {
  return (
    process.env.UNIFY_DEPLOY_REPO_PATH ??
    process.env.DEPLOY_REPO_PATH ??
    path.resolve(process.cwd(), '..', 'unity-deploy')
  );
}

function resolveConsoleRepoPath(): string {
  return process.cwd();
}

async function resolveBashPath(): Promise<string> {
  if (process.platform !== 'darwin') return 'bash';
  const homebrewBash = '/opt/homebrew/bin/bash';
  try {
    await access(homebrewBash);
    return homebrewBash;
  } catch {
    return 'bash';
  }
}

async function restartCoordinatorRuntime(): Promise<void> {
  await execFileAsync(
    await resolveBashPath(),
    [
      path.join(resolveConsoleRepoPath(), 'scripts', 'local.sh'),
      'start-runtime-backend',
      '--self-host',
    ],
    {
      env: {
        ...process.env,
        SELF_HOST: '1',
        UNIFY_STACK_ORCHESTRATOR: 'console-local-harness',
      },
      timeout: 180_000,
      maxBuffer: 1024 * 1024,
    }
  );
}

export async function POST() {
  if (!resetEnabled()) {
    return NextResponse.json({ error: 'not_available' }, { status: 404 });
  }

  const user = await getCurrentUser();
  if (!user?.apiKey) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const script = path.join(resolveDeployRepoPath(), 'selfhost', 'reset_db.sh');
  try {
    const { stdout } = await execFileAsync(await resolveBashPath(), [script, '--yes'], {
      env: {
        ...process.env,
        SELF_HOST: '1',
        SELF_HOST_RESET_API_KEY: user.apiKey,
      },
      timeout: 180_000,
      maxBuffer: 1024 * 1024,
    });
    const lastLine = stdout.trim().split('\n').filter(Boolean).at(-1);
    const payload = lastLine ? JSON.parse(lastLine) : { ok: true };
    await restartCoordinatorRuntime();
    return NextResponse.json(payload);
  } catch (error: unknown) {
    const message =
      error instanceof Error
        ? error.message
        : typeof error === 'string'
          ? error
          : 'Local reset failed';
    return NextResponse.json({ error: 'reset_failed', message }, { status: 500 });
  }
}
