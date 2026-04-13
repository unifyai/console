/**
 * Memory tab types for the assistant right pane.
 *
 * CamelCase mirrors of the Python Pydantic models in Unity's
 * contact_manager, transcript_manager, knowledge_manager, and
 * task_scheduler modules.
 *
 * Orchestra stores these in:
 *   {userId}/{assistantId}/Contacts
 *   {userId}/{assistantId}/Transcripts
 *   {userId}/{assistantId}/Knowledge
 *   {userId}/{assistantId}/Tasks
 */

export type MemoryContext = 'Contacts' | 'Transcripts' | 'Knowledge' | 'Tasks';

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
}

export type MemoryRow = ContactRow | TranscriptRow | KnowledgeRow | TaskRow;

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
}

export const MEMORY_CONTEXTS: MemoryContext[] = ['Contacts', 'Transcripts', 'Knowledge', 'Tasks'];
