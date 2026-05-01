import type { Assistant } from '@/types/assistants/assistant';
import { roots, type ContextRoot } from '@/lib/assistants/scope';

export type { ContextRoot };
export { roots };

export async function readAcrossRoots<T>(
  assistant: Assistant,
  fetchFor: (root: ContextRoot) => Promise<T[]>
): Promise<T[]> {
  const results = await Promise.all(roots(assistant).map((root) => fetchFor(root)));
  return results.flat();
}
