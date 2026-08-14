import type { BrainContext } from '@/types/assistants/brain';

/** Scopes that have a tab-level search field in the assistants shell. */
export type TabSearchScope =
  | 'chat'
  | 'actions'
  | 'canvas'
  | 'tasks'
  | 'workflows'
  | 'integrations'
  | 'contacts'
  | 'transcripts'
  | 'knowledge'
  | 'functions'
  | 'guidance'
  | 'data'
  | 'secrets';

const BRAIN_CONTEXT_SEARCH_SCOPE: Record<BrainContext, TabSearchScope> = {
  Contacts: 'contacts',
  Transcripts: 'transcripts',
  Knowledge: 'knowledge',
  Tasks: 'tasks',
  Guidance: 'guidance',
  Functions: 'functions',
};

/** Canonical assistant tab search placeholder: `Search {scope}…` */
export function tabSearchPlaceholder(scope: TabSearchScope): string {
  return `Search ${scope}…`;
}

export function tabSearchPlaceholderForBrainContext(context: BrainContext): string {
  return tabSearchPlaceholder(BRAIN_CONTEXT_SEARCH_SCOPE[context]);
}
