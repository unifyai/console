/**
 * A published artifact, in the shape its own page already renders.
 *
 * The Workflows drawer shows a bundled artifact by handing these to the very
 * components the Functions / Tasks / Guidance / Knowledge pages use, so a
 * preview cannot drift from the page it is previewing. The adapters live here
 * rather than in a component because they are a data translation and nothing
 * else, and because what is missing pre-install is a fact about the shelf that
 * is worth stating in one place.
 *
 * Nothing is invented. Before an install there is no run history, no next run,
 * no armed state, no function id and no canvas token; the native formatters
 * already answer `—` for an absent field, and every native chip is
 * conditionally rendered, so the honest thing is to pass what exists and let
 * them degrade.
 */

import type { WorkflowArtifact } from '@/types/workflows';
import type { FunctionEntry } from '@/utils/assistants/functions';
import type { TaskRow } from '@/types/assistants/brain';

function asString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map((entry) => String(entry)) : [];
}

/**
 * A bundled function as `FunctionEntry`, for `FunctionDetailBody`.
 *
 * `functionId` is null and `staleReasons` empty because neither exists until
 * the function is planted — the id is assigned on insert, and staleness is a
 * property of a live row's relationship to its source.
 */
export function artifactAsFunctionEntry(artifact: WorkflowArtifact): FunctionEntry {
  const meta = artifact.meta ?? {};
  const precondition = meta.precondition;
  return {
    functionId: null,
    name: artifact.name,
    language: asString(meta.language) || 'python',
    argspec: asString(meta.argspec),
    // The row's body IS the docstring for a function; the surface stores it
    // there so every artifact kind has one readable field.
    docstring: artifact.body,
    implementation: asString(meta.implementation) || null,
    dependsOn: asStringArray(meta.depends_on ?? meta.dependsOn),
    guidanceIds: (Array.isArray(meta.guidance_ids ?? meta.guidanceIds)
      ? ((meta.guidance_ids ?? meta.guidanceIds) as unknown[])
      : []
    )
      .map((entry) => Number(entry))
      .filter((entry) => Number.isFinite(entry)),
    staleReasons: [],
    precondition:
      precondition && typeof precondition === 'object'
        ? (precondition as Record<string, unknown>)
        : null,
    isPrimitive: meta.is_primitive === true || meta.isPrimitive === true,
    verify: meta.verify === true,
  };
}

/**
 * A bundled task as a partial `TaskRow`, for `getTaskCardFields`.
 *
 * Deliberately fed through the native formatter rather than formatted here:
 * TYPE, TRIGGER, CADENCE, START, NEXT RUN and PRIORITY are decided in one place
 * for both surfaces, and the fields with no pre-install answer come back `—`
 * from it rather than from a second set of rules invented here.
 */
export function artifactAsTaskRow(artifact: WorkflowArtifact): TaskRow {
  const meta = artifact.meta ?? {};
  return {
    name: artifact.name,
    description: artifact.body,
    repeat: meta.repeat,
    trigger: meta.trigger,
    priority: asString(meta.priority) || undefined,
    tags: asStringArray(meta.tags),
    schedule: meta.schedule,
    deadline: meta.deadline,
  } as unknown as TaskRow;
}

/** Topic/kind chips a claim's own page shows, when the shelf carries them. */
export function artifactClaimMeta(artifact: WorkflowArtifact): {
  kind: string;
  status: string;
  topics: string[];
} {
  const meta = artifact.meta ?? {};
  return {
    kind: asString(meta.kind),
    status: asString(meta.status),
    topics: asStringArray(meta.topics),
  };
}

/** Function names a procedure composes, when the shelf carries them. */
export function artifactProcedureFunctions(artifact: WorkflowArtifact): string[] {
  return asStringArray(artifact.meta?.function_names ?? artifact.meta?.functionNames);
}

/**
 * What a bundled canvas reads and what it can do.
 *
 * Deliberately no source: a canvas's `view.tsx` is never published to the shelf,
 * because raw TypeScript is noise for someone deciding whether to install and
 * the code is an implementation detail rather than the answer. Unlike a
 * function, where the implementation *is* what a reader came for.
 */
export function artifactCanvasMeta(artifact: WorkflowArtifact): {
  bindsTo: string[];
  actions: string[];
} {
  const meta = artifact.meta ?? {};
  return {
    bindsTo: asStringArray(meta.binds_to ?? meta.bindsTo),
    actions: asStringArray(meta.actions),
  };
}
