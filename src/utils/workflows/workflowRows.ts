/**
 * Orchestra rows → the Workflows view model.
 *
 * The catalogue is platform data: rows on `Workflows/Catalog` in the
 * public-read Builtins project, one shelf for every assistant — exactly like
 * the integrations app catalogue. Installations are per-assistant rows on
 * `Workflows`. Either way the shelf draws without waking an assistant — a
 * hosted assistant is an on-demand job that is usually asleep when someone
 * opens Console.
 */

import { formatTimestamp } from '@/utils/assistants/brain';
import { humanizeTaskLabel } from '@/utils/assistants/tasks';
import type { BrainRow, TaskRow } from '@/types/assistants/brain';
import type {
  Workflow,
  WorkflowArtifact,
  WorkflowCapability,
  WorkflowCategory,
  WorkflowInstallStatus,
  WorkflowInstallation,
  WorkflowManifest,
  WorkflowManifestItem,
  WorkflowParam,
  WorkflowSurfaceKind,
  WorkflowTaskRuntime,
} from '@/types/workflows';

/** A raw requirement as the catalogue publishes it — connection-agnostic. */
export interface CatalogRequirement {
  slug: string;
  name: string;
  /**
   * `"app"` (the default) or `"workspace"`.
   *
   * A workspace is not in the gallery by design — it is the user's own
   * Google or Microsoft account, connected in their profile. Resolving it
   * by slug lookup finds nothing and reports "couldn't check this app"
   * about the one requirement whose answer never depended on the gallery.
   */
  kind: string;
  /** Secret names that answer for this requirement, for the routes that have one. */
  requiredSecrets: string[];
}

/**
 * Unify names the **library** a surface writes into; Console names the
 * **content kind** it holds. Guidance holds procedures, Knowledge holds
 * claims — see `workflowCategories.ts`, which keeps the same split.
 */
const UNIFY_SURFACE_TO_KIND: Record<string, WorkflowSurfaceKind> = {
  guidance: 'procedures',
  procedures: 'procedures',
  functions: 'functions',
  tasks: 'tasks',
  knowledge: 'knowledge',
  canvas: 'canvases',
  canvases: 'canvases',
  data: 'tables',
  tables: 'tables',
};

const CATEGORIES = new Set<WorkflowCategory>(['comms', 'growth', 'ops', 'build']);
const CAPABILITIES = new Set<WorkflowCapability>(['computer', 'filesystem']);

/**
 * Row values arrive either already decoded or as a JSON string, depending on
 * how the surface wrote them. Tolerate both rather than trusting one shape at
 * an untyped boundary.
 */
export function parseJsonField<T>(value: unknown, fallback: T): T {
  if (value === null || value === undefined) return fallback;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return fallback;
    try {
      return JSON.parse(trimmed) as T;
    } catch {
      return fallback;
    }
  }
  return value as T;
}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value : null;
}

function toManifestItems(value: unknown): WorkflowManifestItem[] {
  const raw = parseJsonField<unknown[]>(value, []);
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((entry) => {
    if (typeof entry === 'string') return [{ name: entry }];
    if (!entry || typeof entry !== 'object') return [];
    const record = entry as Record<string, unknown>;
    const name = asString(record.name);
    if (!name) return [];
    const item: WorkflowManifestItem = { name };
    // The schedule string is phrased unify-side so every surface says a
    // cadence identically — render it, never re-derive it.
    const schedule = asString(record.schedule);
    if (schedule) item.schedule = schedule;
    if (record.runsOnce === true || record.runs_once === true) item.runsOnce = true;
    return [item];
  });
}

function toManifest(value: unknown): WorkflowManifest {
  const raw = parseJsonField<Record<string, unknown>>(value, {});
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const manifest: WorkflowManifest = {};
  for (const [surface, entries] of Object.entries(raw)) {
    const kind = UNIFY_SURFACE_TO_KIND[surface.toLowerCase()];
    if (!kind) continue;
    const items = toManifestItems(entries);
    if (items.length === 0) continue;
    manifest[kind] = [...(manifest[kind] ?? []), ...items];
  }
  return manifest;
}

function toParamsSchema(value: unknown): WorkflowParam[] {
  const raw = parseJsonField<unknown>(value, []);
  const entries: Record<string, unknown>[] = Array.isArray(raw)
    ? (raw as Record<string, unknown>[])
    : raw && typeof raw === 'object'
      ? Object.entries(raw as Record<string, unknown>).map(([name, spec]) => ({
          name,
          ...(spec && typeof spec === 'object' ? (spec as Record<string, unknown>) : {}),
        }))
      : [];

  return entries.flatMap((entry) => {
    const name = asString(entry.name);
    if (!name) return [];
    const type = asString(entry.type) ?? 'text';
    return [
      {
        name,
        label: asString(entry.label) ?? name,
        type: (['text', 'textarea', 'number', 'select', 'boolean'].includes(type)
          ? type
          : 'text') as WorkflowParam['type'],
        required: entry.required === true,
        help: asString(entry.help) ?? '',
        options: Array.isArray(entry.options) ? entry.options.map(String) : undefined,
        placeholder: asString(entry.placeholder) ?? undefined,
        suffix: asString(entry.suffix) ?? undefined,
      },
    ];
  });
}

export function catalogRowToWorkflow(row: Record<string, unknown>): Workflow | null {
  const record = row as Record<string, unknown>;
  const slug = asString(record.slug);
  if (!slug) return null;

  const category = asString(record.category)?.toLowerCase() as WorkflowCategory | undefined;
  const capabilities = parseJsonField<unknown[]>(record.capabilities, []);

  return {
    slug,
    name: asString(record.name) ?? slug,
    // An unknown category still belongs on the shelf; group it under Ops
    // rather than dropping a curated workflow the user could install.
    category: category && CATEGORIES.has(category) ? category : 'ops',
    description: asString(record.description) ?? '',
    about: asString(record.about) ?? '',
    version: asString(record.version) ?? '0.0.0',
    iconId: asString(record.iconId) ?? 'briefing',
    requirements: [],
    capabilities: (Array.isArray(capabilities) ? capabilities : [])
      .map((entry) => String(entry).toLowerCase())
      .filter((entry): entry is WorkflowCapability =>
        CAPABILITIES.has(entry as WorkflowCapability)
      ),
    paramsSchema: toParamsSchema(record.paramsSchema),
    sets: toManifest(record.sets),
  };
}

/**
 * One published `Workflows/Content` row → a previewable artifact. Rows
 * carry the unify surface name; the view model speaks in content kinds,
 * same split as the manifest.
 */
export function contentRowToArtifact(row: Record<string, unknown>): WorkflowArtifact | null {
  const record = row as Record<string, unknown>;
  const contentKey = asString(record.contentKey);
  const slug = asString(record.slug);
  const surface = asString(record.surface);
  const kind = surface ? UNIFY_SURFACE_TO_KIND[surface.toLowerCase()] : undefined;
  if (!contentKey || !slug || !kind) return null;

  return {
    contentKey,
    slug,
    kind,
    name: asString(record.name) ?? contentKey,
    body: asString(record.body) ?? '',
    schedule: asString(record.schedule) ?? undefined,
    meta: parseJsonField<Record<string, unknown>>(record.meta, {}),
  };
}

/** Requirements as published — connection state is resolved separately. */
export function catalogRowRequirements(row: Record<string, unknown>): CatalogRequirement[] {
  const raw = parseJsonField<unknown[]>((row as Record<string, unknown>).requirements, []);
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((entry) => {
    if (typeof entry === 'string') {
      return [{ slug: entry, name: entry, kind: 'app', requiredSecrets: [] }];
    }
    if (!entry || typeof entry !== 'object') return [];
    const record = entry as Record<string, unknown>;
    const slug = asString(record.slug);
    if (!slug) return [];
    const secrets = record.requiredSecrets ?? record.required_secrets;
    return [
      {
        slug,
        name: asString(record.name) ?? slug,
        kind: asString(record.kind) ?? 'app',
        requiredSecrets: Array.isArray(secrets) ? secrets.map(String) : [],
      },
    ];
  });
}

/**
 * Only `active` and `partial` are ever stored. `pending_requirements` is
 * derived at read time from requirements, because connections change without
 * the installation row being touched, and `partial` outranks it — something
 * genuinely failed to plant.
 */
function toStoredStatus(value: unknown): WorkflowInstallStatus {
  const raw = asString(value)?.toLowerCase();
  if (raw === 'partial' || raw === 'failed') return 'partial';
  if (raw === 'provisioning') return 'provisioning';
  if (raw === 'uninstalling') return 'uninstalling';
  return 'active';
}

export function installationRowToInstallation(
  row: BrainRow,
  tasks: WorkflowTaskRuntime[] = []
): WorkflowInstallation | null {
  const record = row as Record<string, unknown>;
  const slug = asString(record.slug);
  if (!slug) return null;

  const destinationRaw = asString(record.destination);
  const isTeam = !!destinationRaw && destinationRaw.toLowerCase() !== 'personal';

  return {
    slug,
    status: toStoredStatus(record.status),
    installedVersion: asString(record.version) ?? '0.0.0',
    destination: isTeam
      ? { kind: 'team', teamId: destinationRaw, teamName: destinationRaw, memberCount: 0 }
      : { kind: 'personal' },
    params: parseJsonField<Record<string, string | number | boolean>>(record.params, {}),
    installedAtLabel: record.ts ? formatTimestamp(record.ts) : '',
    tasks,
    planted: toManifest(record.surfaces),
  };
}

/**
 * A workflow has no runtime of its own — next run, last outcome and each
 * task's link all come from the ordinary `Tasks` rows it planted.
 */
export function taskRowToRuntime(row: TaskRow): WorkflowTaskRuntime {
  const record = row as unknown as Record<string, unknown>;
  const enabled = record.enabled !== false && !isPaused(record.lifecycle);
  const nextDueAt = asString(record.nextDueAt);
  const lastRunAt = asString(record.lastRunAt) ?? asString(record.lastExecutionAt);
  const lastOutcome = asString(record.lastRunOutcome) ?? asString(record.lastRunStatus);

  return {
    taskId: String(record.taskId ?? record.name ?? ''),
    name: asString(record.name) ?? 'Untitled task',
    enabled,
    nextRunLabel: enabled
      ? nextDueAt
        ? formatTimestamp(nextDueAt)
        : 'As scheduled'
      : 'Held — waiting on a connection',
    lastRunLabel: lastRunAt
      ? `${humanizeTaskLabel(lastOutcome ?? 'completed')} · ${formatTimestamp(lastRunAt)}`
      : 'Never run',
    lastRunOutcome: toRunOutcome(lastOutcome),
    href: '',
  };
}

function isPaused(lifecycle: unknown): boolean {
  const raw = asString(lifecycle)?.toLowerCase();
  return raw === 'disarmed' || raw === 'completed';
}

function toRunOutcome(value: string | null): WorkflowTaskRuntime['lastRunOutcome'] {
  switch (value?.toLowerCase()) {
    case 'success':
    case 'completed':
      return 'success';
    case 'partial':
      return 'partial';
    case 'failed':
    case 'error':
      return 'failed';
    default:
      return 'never';
  }
}
