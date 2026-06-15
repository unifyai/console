import { snakeToCamelObject } from '@/utils/casing';

export type CoordinatorActivityPhase =
  | 'started'
  | 'progress'
  | 'needs_input'
  | 'blocked'
  | 'completed'
  | 'failed';

export type CoordinatorActivityStage =
  | 'discovery'
  | 'requirements'
  | 'proposal'
  | 'confirmation'
  | 'implementation'
  | 'integration_setup'
  | 'validation'
  | 'handoff';

export type CoordinatorActivityStatus = 'ok' | 'error';

export interface CoordinatorActivityEntity {
  type?: string | null;
  id?: string | null;
  name: string;
  [key: string]: unknown;
}

export interface CoordinatorActivityRow {
  activityId: string;
  phase: CoordinatorActivityPhase;
  stage: CoordinatorActivityStage;
  surfaces: string[];
  title: string;
  summary: string | null;
  checklistItemId: number | null;
  relatedEntities: CoordinatorActivityEntity[];
  chatPrompt: string | null;
  chatPromptLabel: string | null;
  correlationId: string | null;
  occurredAt: string;
  status: CoordinatorActivityStatus;
  error: string | null;
  eventId?: string | null;
  [key: string]: unknown;
}

type CoordinatorRawRow = Record<string, unknown>;

const ACTIVE_ACTIVITY_PHASES = new Set<CoordinatorActivityPhase>([
  'started',
  'progress',
  'needs_input',
  'blocked',
  'failed',
]);

const SIDEBAR_INVALIDATING_SURFACES = new Set([
  'colleagues',
  'workspaces',
  'membership',
  'invitations',
]);

const SIDEBAR_INVALIDATING_ENTITIES = new Set(['colleague', 'workspace', 'invitation']);

function stringOrNull(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value : null;
}

function stringOrEmpty(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function numberOrNull(value: unknown): number | null {
  if (typeof value === 'number') return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

export function normalizeActivityPhase(value: unknown): CoordinatorActivityPhase {
  if (
    value === 'started' ||
    value === 'progress' ||
    value === 'needs_input' ||
    value === 'blocked' ||
    value === 'completed' ||
    value === 'failed'
  ) {
    return value;
  }
  return 'progress';
}

export function normalizeActivityStage(value: unknown): CoordinatorActivityStage {
  if (
    value === 'discovery' ||
    value === 'requirements' ||
    value === 'proposal' ||
    value === 'confirmation' ||
    value === 'implementation' ||
    value === 'integration_setup' ||
    value === 'validation' ||
    value === 'handoff'
  ) {
    return value;
  }
  return 'discovery';
}

function normalizeActivityStatus(value: unknown): CoordinatorActivityStatus {
  return value === 'error' ? 'error' : 'ok';
}

function normalizeActivityEntity(entity: unknown): CoordinatorActivityEntity {
  const row = entity && typeof entity === 'object' ? (entity as CoordinatorRawRow) : {};
  return {
    ...row,
    type: stringOrNull(row.type),
    id: stringOrNull(row.id),
    name: stringOrEmpty(row.name),
  };
}

export function normalizeCoordinatorActivityRow(rawRow: CoordinatorRawRow): CoordinatorActivityRow {
  const row = snakeToCamelObject<CoordinatorRawRow>(rawRow);
  return {
    ...row,
    activityId: stringOrEmpty(row.activityId),
    phase: normalizeActivityPhase(row.phase),
    stage: normalizeActivityStage(row.stage),
    surfaces: Array.isArray(row.surfaces)
      ? row.surfaces.filter((item): item is string => typeof item === 'string')
      : [],
    title: stringOrEmpty(row.title),
    summary: stringOrNull(row.summary),
    checklistItemId: numberOrNull(row.checklistItemId),
    relatedEntities: Array.isArray(row.relatedEntities)
      ? row.relatedEntities.map(normalizeActivityEntity)
      : [],
    chatPrompt: stringOrNull(row.chatPrompt),
    chatPromptLabel: stringOrNull(row.chatPromptLabel),
    correlationId: stringOrNull(row.correlationId),
    occurredAt: stringOrEmpty(row.occurredAt),
    status: normalizeActivityStatus(row.status),
    error: stringOrNull(row.error),
    eventId: stringOrNull(row.eventId),
  };
}

export function coordinatorActivityLifecycleKey(activity: CoordinatorActivityRow): string {
  return activity.correlationId?.trim() || activity.activityId;
}

export function coordinatorActivityOccurredAtMillis(activity: CoordinatorActivityRow): number {
  const millis = Date.parse(activity.occurredAt);
  return Number.isFinite(millis) ? millis : 0;
}

export function compareCoordinatorActivities(
  left: CoordinatorActivityRow,
  right: CoordinatorActivityRow
): number {
  return coordinatorActivityOccurredAtMillis(right) - coordinatorActivityOccurredAtMillis(left);
}

export function latestCoordinatorActivityLifecycleRows(
  activities: CoordinatorActivityRow[]
): CoordinatorActivityRow[] {
  const seen = new Set<string>();
  return [...activities].sort(compareCoordinatorActivities).filter((activity) => {
    const key = coordinatorActivityLifecycleKey(activity);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function mergeCoordinatorActivities(
  existing: CoordinatorActivityRow[],
  incoming: CoordinatorActivityRow[]
): CoordinatorActivityRow[] {
  const merged = new Map<string, CoordinatorActivityRow>();
  for (const activity of [...existing, ...incoming]) {
    const key = coordinatorActivityLifecycleKey(activity);
    const current = merged.get(key);
    if (
      !current ||
      coordinatorActivityOccurredAtMillis(activity) >= coordinatorActivityOccurredAtMillis(current)
    ) {
      merged.set(key, activity);
    }
  }
  return Array.from(merged.values()).sort(compareCoordinatorActivities);
}

export function isActiveCoordinatorActivity(activity: CoordinatorActivityRow): boolean {
  return ACTIVE_ACTIVITY_PHASES.has(activity.phase);
}

export function defaultCoordinatorActivityPromptLabel(phase: CoordinatorActivityPhase): string {
  switch (phase) {
    case 'needs_input':
      return 'Continue setup';
    case 'blocked':
      return 'Resolve';
    case 'completed':
      return 'Review';
    case 'failed':
      return 'Troubleshoot';
    case 'started':
    case 'progress':
      return 'Ask for update';
  }
}

export function invalidatesCoordinatorSidebar(activity: CoordinatorActivityRow): boolean {
  if (activity.phase !== 'completed') return false;
  return (
    activity.surfaces.some((surface) => SIDEBAR_INVALIDATING_SURFACES.has(surface)) ||
    activity.relatedEntities.some(
      (entity) => entity.type != null && SIDEBAR_INVALIDATING_ENTITIES.has(entity.type)
    )
  );
}
