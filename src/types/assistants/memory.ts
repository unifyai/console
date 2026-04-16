/**
 * Memory tab types for the assistant right pane.
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

export type MemoryContext =
  | 'Contacts'
  | 'Transcripts'
  | 'Knowledge'
  | 'Tasks'
  | 'Guidance'
  | 'Functions';

export type TaskMemoryView = 'Tasks' | 'Activity';

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
  timestamp: string | null;
  content: string | null;
  exchangeId: number | null;
}

export interface KnowledgeRow {
  [key: string]: unknown;
}

export interface TaskScheduleRow {
  startAt?: string | null;
  prevTask?: number | null;
  nextTask?: number | null;
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
  entrypoint?: number | string | null;
  repeat?: unknown[] | null;
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
  [key: string]: unknown;
}

export interface FunctionRow {
  name: string | null;
  language: string | null;
  argspec: string | null;
  docstring: string | null;
  implementation: string | null;
  [key: string]: unknown;
}

export type MemoryRow =
  | ContactRow
  | TranscriptRow
  | KnowledgeRow
  | TaskRow
  | TaskRunRow
  | GuidanceRow
  | FunctionRow;

export interface MemoryContextData<T extends MemoryRow = MemoryRow> {
  rows: T[];
  count: number;
  fields: string[];
}

export const MEMORY_CONTEXTS: MemoryContext[] = [
  'Contacts',
  'Transcripts',
  'Knowledge',
  'Tasks',
  'Guidance',
  'Functions',
];
