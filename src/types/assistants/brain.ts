/**
 * Brain tab types for the assistant right pane.
 *
 * CamelCase mirrors of the Python Pydantic models in Unity's
 * contact_manager, transcript_manager, knowledge_manager,
 * task_scheduler, guidance, and function modules.
 *
 * Orchestra stores these in:
 *   {userId}/{assistantId}/Contacts
 *   {userId}/{assistantId}/Transcripts
 *   {userId}/{assistantId}/Knowledge
 *   {userId}/{assistantId}/Tasks
 *   {userId}/{assistantId}/Tasks/Runs
 *   {userId}/{assistantId}/Guidance
 *   {userId}/{assistantId}/Functions  (sub-contexts: Compositional, Primitives, VirtualEnvs, Meta)
 */

export type BrainContext =
  | 'Contacts'
  | 'Transcripts'
  | 'Knowledge'
  | 'Tasks'
  | 'Guidance'
  | 'Functions';

export type TaskBrainView = 'Tasks' | 'Activity';

export interface ContactRow {
  contactId: number;
  firstName: string | null;
  surname: string | null;
  emailAddress: string | null;
  phoneNumber: string | null;
  whatsappNumber: string | null;
  discordId: string | null;
  bio: string | null;
  rollingSummary: string | null;
  timezone: string | null;
  isSystem: boolean | null;
}

export interface TranscriptRow {
  messageId: number;
  medium: string | null;
  senderId: number | null;
  receiverIds: number[] | null;
  authoringAssistantId: number | null;
  timestamp: string | null;
  content: string | null;
  exchangeId: number | null;
}

/** Claim kinds in the typed Knowledge ledger. */
export type KnowledgeKind =
  | 'fact'
  | 'policy'
  | 'definition'
  | 'decision'
  | 'constraint'
  | 'insight'
  | 'preference';

/** Lifecycle statuses for a knowledge claim. */
export type KnowledgeStatus = 'active' | 'superseded' | 'invalidated';

/** Provenance kinds attached to a claim via `sourceRefs`. */
export type KnowledgeSourceKind =
  | 'user_statement'
  | 'transcript'
  | 'file'
  | 'data'
  | 'contact'
  | 'web'
  | 'actor_trajectory'
  | 'derived_from_knowledge'
  | 'manual';

/** One provenance pointer supporting a knowledge claim. */
export interface KnowledgeSourceRef {
  kind: KnowledgeSourceKind | string;
  note?: string | null;
  fileId?: number | null;
  filepath?: string | null;
  context?: string | null;
  url?: string | null;
  exchangeId?: number | null;
  knowledgeId?: number | null;
  contactId?: number | null;
}

export interface StaleReason {
  kind: 'missing_dependency';
  depKind: string;
  id?: number | null;
  name?: string | null;
  path?: string | null;
  context?: string | null;
  message: string;
}

/**
 * One typed claim in the flat `Knowledge` Orchestra context.
 * CamelCase mirror of Unity's `knowledge_manager.types.knowledge.Knowledge`.
 */
export interface KnowledgeClaim {
  knowledgeId: number;
  title: string;
  content: string;
  kind: KnowledgeKind | string;
  topics: string[];
  sourceRefs: KnowledgeSourceRef[];
  confidence: number | null;
  observedAt: string | null;
  validFrom: string | null;
  validUntil: string | null;
  status: KnowledgeStatus | string;
  supersedesIds: number[];
  supersededById: number | null;
  staleReasons: StaleReason[];
  isBuiltin: boolean;
  customKey: string | null;
  customHash: string | null;
  authoringAssistantId: number | null;
  /** Optional display scope when present on federated / seeded rows. */
  scope?: string | null;
  updatedAt?: string | null;
  createdAt?: string | null;
  ts?: string | null;
}

/** Alias kept for BrainRow / column helpers. */
export type KnowledgeRow = KnowledgeClaim;

export interface TaskScheduleRow {
  startAt?: string | null;
  [key: string]: unknown;
}

export interface TaskTriggerRow {
  medium?: string | null;
  fromContactIds?: number[] | null;
  omitContactIds?: number[] | null;
  interrupt?: boolean | null;
  recurring?: boolean | null;
  [key: string]: unknown;
}

export interface TaskRepeatPatternRow {
  frequency?: string | null;
  interval?: number | null;
  weekdays?: string[] | null;
  count?: number | null;
  until?: string | null;
  timeOfDay?: string | null;
  [key: string]: unknown;
}

export interface TaskRow {
  taskId: number;
  name: string | null;
  description: string | null;
  status: string | null;
  triggerType: string | null;
  nextDueAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  schedule?: TaskScheduleRow | null;
  trigger?: TaskTriggerRow | null;
  offline?: boolean | null;
  requiresFilesystem?: boolean | null;
  requiresComputer?: boolean | null;
  entrypoint?: number | string | null;
  repeat?: TaskRepeatPatternRow[] | null;
  [key: string]: unknown;
}

export interface TaskRunRow {
  taskId: number | null;
  taskName: string | null;
  taskDescription: string | null;
  sourceType: string | null;
  state: string | null;
  scheduledFor: string | null;
  sourceMedium: string | null;
  sourceContactDisplayName: string | null;
  startedAt: string | null;
  completedAt: string | null;
  [key: string]: unknown;
}

export interface GuidanceRow {
  title: string | null;
  content: string | null;
  linkedImages: string[] | null;
  staleReasons: StaleReason[];
  [key: string]: unknown;
}

export interface FunctionRow {
  name: string | null;
  language: string | null;
  argspec: string | null;
  docstring: string | null;
  implementation: string | null;
  staleReasons: StaleReason[];
  [key: string]: unknown;
}

export type BrainRow =
  | ContactRow
  | TranscriptRow
  | KnowledgeRow
  | TaskRow
  | TaskRunRow
  | GuidanceRow
  | FunctionRow;

/** Log-page payload. `T` is unconstrained so callers can fetch non-Brain contexts
 *  (e.g. coordinator activity) through the same client helper. */
export interface BrainContextData<T = BrainRow> {
  rows: T[];
  count: number;
  fields: string[];
  hasMore?: boolean;
}

export const BRAIN_CONTEXTS: BrainContext[] = [
  'Contacts',
  'Transcripts',
  'Knowledge',
  'Tasks',
  'Guidance',
  'Functions',
];
