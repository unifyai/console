'use server';

import { requireUserApiKey } from '@/lib/server-action-session';
// get contexts
export async function getContexts(project: string, signal?: AbortSignal) {
  const apiKey = await requireUserApiKey();
  const response = await fetch(`${process.env.NEXTAUTH_URL}/api/context/${project}`, {
    method: 'GET',
    headers: { apiKey: apiKey },
    signal,
  });
  return await response.json();
}

// create context
export async function createContext(name: string, project: string) {
  const apiKey = await requireUserApiKey();
  const response = await fetch(`${process.env.NEXTAUTH_URL}/api/context/${project}`, {
    method: 'POST',
    headers: { apiKey: apiKey },
    body: JSON.stringify({ name }),
  });
  return await response.json();
}

// delete context (supports nested names)
export async function deleteContext(project: string, context: string) {
  const apiKey = await requireUserApiKey();
  const encoded = encodeURIComponent(context);
  const response = await fetch(`${process.env.NEXTAUTH_URL}/api/context/${project}/${encoded}`, {
    method: 'DELETE',
    headers: { apiKey: apiKey },
  });
  return await response.json();
}

// rename context (supports nested names)
export async function renameContext(project: string, currentName: string, newName: string) {
  const apiKey = await requireUserApiKey();
  const encoded = encodeURIComponent(currentName);
  const response = await fetch(`${process.env.NEXTAUTH_URL}/api/context/${project}/${encoded}`, {
    method: 'PATCH',
    headers: { apiKey: apiKey },
    body: JSON.stringify({ name: newName }),
  });
  return await response.json();
}
