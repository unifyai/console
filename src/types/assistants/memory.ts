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

export type TaskMemoryView = 'Definitions' | 'Activations' | 'Runs';

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

export interface TaskRow {
  taskId: number;
  instanceId: string | null;
  status: string | null;
  priority: number | null;
  entrypoint: string | null;
  triggerType: string | null;
  nextDueAt: string | null;
  createdAt: string | null;
  [key: string]: unknown;
}

export interface TaskActivationRow {
  activationKey: string | null;
  taskId: number | null;
  assistantId: string | null;
  activationKind: string | null;
  executionMode: string | null;
  status: string | null;
  taskName: string | null;
  taskDescription: string | null;
  nextDueAt: string | null;
  triggerMedium: string | null;
  activationRevision: string | null;
  lastMaterializedAt: string | null;
  [key: string]: unknown;
}

export interface TaskRunRow {
  runId: number | null;
  runKey: string | null;
  taskId: number | null;
  assistantId: string | null;
  sourceType: string | null;
  executionMode: string | null;
  state: string | null;
  scheduledFor: string | null;
  sourceMedium: string | null;
  sourceRef: string | null;
  sourceContactId: string | null;
  startedAt: string | null;
  completedAt: string | null;
  jobName: string | null;
  resultSummary: string | null;
  error: string | null;
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
  | TaskActivationRow
  | TaskRunRow
  | GuidanceRow
  | FunctionRow;

export interface MemoryContextData<T extends MemoryRow = MemoryRow> {
  rows: T[];
  count: number;
  fields: string[];
}

export interface MemoryPaneData {
  contacts: MemoryContextData<ContactRow>;
  transcripts: MemoryContextData<TranscriptRow>;
  knowledge: MemoryContextData<KnowledgeRow>;
  tasks: MemoryContextData<TaskRow>;
  taskActivations: MemoryContextData<TaskActivationRow>;
  taskRuns: MemoryContextData<TaskRunRow>;
  guidance: MemoryContextData<GuidanceRow>;
  functions: MemoryContextData<FunctionRow>;
}

export const MEMORY_CONTEXTS: MemoryContext[] = [
  'Contacts',
  'Transcripts',
  'Knowledge',
  'Tasks',
  'Guidance',
  'Functions',
];
