/**
 * Client helpers for Assistants Data-pane context list/create via Console proxies.
 * Keeps the Data pane free of Interfaces server-action coupling.
 */

const PROJECT = 'Assistants';

export async function listAssistantsContexts(): Promise<string[]> {
  const res = await fetch(`/api/context/${PROJECT}`, { cache: 'no-store' });
  if (!res.ok) {
    console.error('Failed to list contexts', await res.text().catch(() => res.status));
    return [];
  }
  const raw: unknown = await res.json();
  if (!Array.isArray(raw)) return [];
  return raw
    .map((c) => (typeof c === 'string' ? c : (c as { name?: string })?.name))
    .filter((name): name is string => Boolean(name));
}

export async function createAssistantsContext(name: string): Promise<{ ok: boolean }> {
  const res = await fetch(`/api/context/${PROJECT}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  });
  if (!res.ok) {
    console.error('Failed to create context', await res.text().catch(() => res.status));
    return { ok: false };
  }
  return { ok: true };
}

function contextApiPath(name: string): string {
  // Slash-separated segments so the catch-all [...contextName] route receives
  // each path part (nested Assistants contexts include `/`).
  return `/api/context/${PROJECT}/${name
    .split('/')
    .filter(Boolean)
    .map((segment) => encodeURIComponent(segment))
    .join('/')}`;
}

/** Rename an Assistants context to a new full context path. */
export async function renameAssistantsContext(
  currentName: string,
  newName: string
): Promise<{ ok: boolean }> {
  const res = await fetch(contextApiPath(currentName), {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: newName }),
  });
  if (!res.ok) {
    console.error('Failed to rename context', await res.text().catch(() => res.status));
    return { ok: false };
  }
  return { ok: true };
}

/** Permanently delete an Assistants context and its rows. */
export async function deleteAssistantsContext(name: string): Promise<{ ok: boolean }> {
  const res = await fetch(contextApiPath(name), { method: 'DELETE' });
  if (!res.ok) {
    console.error('Failed to delete context', await res.text().catch(() => res.status));
    return { ok: false };
  }
  return { ok: true };
}
