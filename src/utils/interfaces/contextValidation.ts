/**
 * Utility functions for validating context existence and detecting deleted contexts.
 */

import type { Context } from '@/types/interfaces/grid';

/**
 * Checks if a given context exists in the list of available contexts.
 * A context is considered to exist if:
 * - It matches an available context exactly, OR
 * - It is a prefix of an available context (e.g., "project" matches "project/subcontext")
 *
 * @param context - The context to check
 * @param availableContexts - List of available contexts
 * @returns true if context exists or if there's no context to check, false otherwise
 */
export function contextExistsInAvailableContexts(
  context: string | null | undefined,
  availableContexts: Context[]
): boolean {
  // No context set - nothing to validate
  if (!context) return true;

  // Contexts not loaded yet - assume valid to avoid false positives
  if (availableContexts.length === 0) return true;

  // Check if context matches exactly or is a prefix of any available context
  return availableContexts.some((c) => c.name === context || c.name.startsWith(context + '/'));
}

/**
 * Determines if a context should be considered "not found" for UI purposes.
 * This handles both explicit API 404 responses and contexts that don't exist
 * in the available contexts list (e.g., deleted contexts that API doesn't properly 404).
 *
 * @param params - Parameters for the check
 * @param params.apiContextNotFound - Whether the API explicitly returned contextNotFound
 * @param params.context - The current context
 * @param params.availableContexts - List of available contexts
 * @param params.isLoadingContexts - Whether contexts are still being loaded
 * @returns true if context should be treated as not found
 */
export function isEffectiveContextNotFound({
  apiContextNotFound,
  context,
  availableContexts,
  isLoadingContexts,
}: {
  apiContextNotFound: boolean | undefined;
  context: string | null | undefined;
  availableContexts: Context[];
  isLoadingContexts: boolean;
}): boolean {
  // If API explicitly says context not found, trust it
  if (apiContextNotFound) return true;

  // If contexts are still loading, don't make a determination yet
  if (isLoadingContexts) return false;

  // Check if context exists in available contexts
  const contextExists = contextExistsInAvailableContexts(context, availableContexts);

  // Context is "not found" if it's set but doesn't exist in available contexts
  return !contextExists;
}
