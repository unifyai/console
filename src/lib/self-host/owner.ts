/**
 * Durable record of the local self-host owner.
 *
 * Self-host is a single-owner, single-machine product: one human runs their own
 * Console. Once they have created their account we persist a tiny pointer to it
 * on disk so subsequent visits can sign them in automatically without ever
 * showing a password prompt. The file lives next to the other self-host runtime
 * state under ~/.unity (overridable via SELF_HOST_STATE_DIR / UNIFY_HOME).
 *
 * This is intentionally a local-machine trust boundary: anyone who can read
 * this file already controls the machine and the local admin key.
 */

import fs from 'fs';
import os from 'os';
import path from 'path';

export interface SelfHostOwner {
  userId: string;
  email: string;
  name?: string | null;
}

function ownerFilePath(): string {
  if (process.env.SELF_HOST_OWNER_FILE) {
    return process.env.SELF_HOST_OWNER_FILE;
  }
  const stateDir =
    process.env.SELF_HOST_STATE_DIR || process.env.UNIFY_HOME || path.join(os.homedir(), '.unity');
  return path.join(stateDir, 'self-host-owner.json');
}

/** Returns the persisted owner, or null when no account has been created yet. */
export function readSelfHostOwner(): SelfHostOwner | null {
  try {
    const raw = fs.readFileSync(ownerFilePath(), 'utf-8');
    const data = JSON.parse(raw);
    if (data && typeof data.email === 'string' && typeof data.userId === 'string') {
      return { userId: data.userId, email: data.email, name: data.name ?? null };
    }
    return null;
  } catch {
    return null;
  }
}

/** Records the local owner so future visits can auto sign-in. Best-effort. */
export function writeSelfHostOwner(owner: SelfHostOwner): void {
  try {
    const file = ownerFilePath();
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify(owner, null, 2), { mode: 0o600 });
    // writeFile only applies mode on creation; fix up pre-existing files.
    fs.chmodSync(file, 0o600);
  } catch {
    // Best-effort: if we can't persist, auto-login is simply unavailable and
    // the user falls back to the create-account screen.
  }
}

/** Drops the owner pointer (e.g. when the local DB was reset and it is stale). */
export function clearSelfHostOwner(): void {
  try {
    fs.rmSync(ownerFilePath(), { force: true });
  } catch {
    // ignore
  }
}
