#!/usr/bin/env node
import { execSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { resolve } from 'node:path';

const mode = process.argv[2] ?? '';
const repoRoot = resolve(import.meta.dirname, '..');
const unityHome = process.env.UNIFY_HOME || `${homedir()}/.unity`;
const stackStatePath = `${process.env.SELF_HOST_STATE_DIR || unityHome}/full-stack-state.json`;

function run(command) {
  try {
    return execSync(command, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return '';
  }
}

function hasListener(ports) {
  const args = ports.map((port) => `-iTCP:${port}`).join(' ');
  return Boolean(run(`lsof -nP ${args} -sTCP:LISTEN`));
}

function hasAllListeners(ports) {
  return ports.every((port) => hasListener([port]));
}

function stackStateIsActive() {
  if (existsSync(stackStatePath)) {
    try {
      const state = JSON.parse(readFileSync(stackStatePath, 'utf8'));
      if (state.mode && state.mode !== 'source') return false;
    } catch {
      return false;
    }
  }
  return hasAllListeners(['8000', '8001']);
}

function sameCheckoutNextDevIsRunning() {
  const escapedRoot = repoRoot.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const output = run('ps -axo pid,ppid,pgid,stat,etime,command');
  return new RegExp(`${escapedRoot}.*(next dev|next-server|npm run dev)`).test(output);
}

if (mode === 'predev') {
  const orchestrated = Boolean(process.env.UNIFY_STACK_ORCHESTRATOR);
  const explicitlyAllowed = process.env.UNIFY_ALLOW_ISOLATED_CONSOLE === '1';
  if (!orchestrated && !explicitlyAllowed && stackStateIsActive()) {
    console.error('Refusing bare `npm run dev`: a full local Unity stack appears to be running.');
    console.error('Use `unity-deploy/selfhost/stack.sh repair-console` or `status` instead.');
    console.error(
      'Override only for intentionally isolated Console work: UNIFY_ALLOW_ISOLATED_CONSOLE=1 npm run dev'
    );
    process.exit(1);
  }
}

if (mode === 'prebuild') {
  if (process.env.UNIFY_ALLOW_LIVE_BUILD === '1') process.exit(0);
  if (sameCheckoutNextDevIsRunning()) {
    console.error('Refusing `next build` while a Next dev server is running from this checkout.');
    console.error('`next build` and `next dev` share .next and can corrupt live chunks.');
    console.error('Use `npm run ci:live-safe` here, or run the full build in a separate worktree.');
    console.error(
      'Override only when no browser/dev server depends on this checkout: UNIFY_ALLOW_LIVE_BUILD=1 npm run build'
    );
    process.exit(1);
  }
}
