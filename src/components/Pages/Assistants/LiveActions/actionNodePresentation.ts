import {
  Bookmark,
  BookOpen,
  Boxes,
  CircleDot,
  Cpu,
  FileText,
  Globe,
  KeyRound,
  ListChecks,
  MessageCircle,
  MessageSquare,
  Play,
  RefreshCw,
  Repeat,
  SquareTerminal,
  Users,
  Wrench,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import type { ActionNode } from '@/types/assistants/action';

/** Visual kind for the color-coded icon box on root action rows. */
export type ActionNodeKind = 'request' | 'note' | 'question' | 'default';

export interface ActionNodePresentation {
  icon: LucideIcon;
  tooltip: string;
  kind: ActionNodeKind;
}

const DEFAULT_PRESENTATION: ActionNodePresentation = {
  icon: CircleDot,
  tooltip: 'event',
  kind: 'default',
};

/**
 * Icon, tooltip and colour for an action node, keyed by the **stable**
 * identity unify emits — the manager class and method that produced the
 * event (`SkillManager.store`, `CodeActActor.act.execute_code`), never the
 * human-facing `display_label`.
 *
 * Display labels are copy: unify's product-vocabulary sweep rewords them
 * freely, and a matcher that reads them fails silently — the row keeps
 * rendering, just with the generic icon, so a rename is only noticed from a
 * screenshot weeks later. Manager and method names are identifiers and
 * change under review.
 *
 * Keys are matched most-specific first: full dotted path, then
 * `Manager.method`, then the bare method or tool name, then the manager.
 */
export const ACTION_PRESENTATION_BY_IDENTITY = new Map<string, ActionNodePresentation>([
  // Actor loop
  ['CodeActActor', { icon: Zap, tooltip: 'action', kind: 'request' }],
  ['CodeActActor.act', { icon: Zap, tooltip: 'action', kind: 'request' }],
  ['execute_code', { icon: SquareTerminal, tooltip: 'code execution', kind: 'request' }],
  ['execute_function', { icon: Play, tooltip: 'function execution', kind: 'request' }],
  ['search_web', { icon: Globe, tooltip: 'web search', kind: 'question' }],
  ['answer_question', { icon: MessageCircle, tooltip: 'question answering', kind: 'question' }],

  // Stores — a skill is the umbrella over functions, procedures and claims.
  ['SkillManager', { icon: Bookmark, tooltip: 'storage', kind: 'note' }],
  ['SkillManager.store', { icon: Bookmark, tooltip: 'storage', kind: 'note' }],
  ['SkillManager.search', { icon: Bookmark, tooltip: 'storage', kind: 'note' }],
  ['store_skills', { icon: Bookmark, tooltip: 'storage', kind: 'note' }],
  ['search_skills', { icon: Bookmark, tooltip: 'storage', kind: 'note' }],

  ['KnowledgeManager', { icon: BookOpen, tooltip: 'knowledge base', kind: 'note' }],
  ['GuidanceManager', { icon: BookOpen, tooltip: 'procedures', kind: 'note' }],
  ['FunctionManager', { icon: Play, tooltip: 'functions', kind: 'default' }],

  // Durable work and the packages that install it
  ['TaskScheduler', { icon: Wrench, tooltip: 'task', kind: 'request' }],
  ['TaskScheduler.execute', { icon: Wrench, tooltip: 'task', kind: 'request' }],
  ['TaskScheduler.create', { icon: ListChecks, tooltip: 'task management', kind: 'request' }],
  ['TaskScheduler.update', { icon: ListChecks, tooltip: 'task management', kind: 'request' }],
  ['WorkflowManager', { icon: Boxes, tooltip: 'workflow install', kind: 'request' }],

  // Everything else that reaches the tree
  ['ContactManager', { icon: Users, tooltip: 'contact lookup', kind: 'default' }],
  ['lookup_contact', { icon: Users, tooltip: 'contact lookup', kind: 'default' }],
  ['FileManager', { icon: FileText, tooltip: 'file read', kind: 'note' }],
  ['FileManager.read', { icon: FileText, tooltip: 'file read', kind: 'note' }],
  ['SecretManager', { icon: KeyRound, tooltip: 'credential access', kind: 'default' }],
  ['TranscriptManager', { icon: MessageSquare, tooltip: 'conversation', kind: 'default' }],
  ['MemoryManager', { icon: Cpu, tooltip: 'memory processing', kind: 'note' }],
]);

/**
 * Prose fallback for events whose identity is not in the map above.
 *
 * Ordered, and matched only after every identity key misses. Kept as data so
 * a test can pin it: when unify rewords a label this list is what silently
 * stops matching, and the pin is what makes that fail loudly instead.
 */
export const LEGACY_LABEL_PRESENTATION: ReadonlyArray<{
  /** Lowercased display label, or a predicate for the fuzzy cases. */
  match: (lowercased: string) => boolean;
  presentation: ActionNodePresentation;
}> = [
  {
    match: (dl) => dl === 'session' || dl.includes('persistent session'),
    presentation: { icon: Repeat, tooltip: 'persistent session', kind: 'request' },
  },
  {
    match: (dl) => dl === 'taking action' || dl === 'action' || dl.includes('handling request'),
    presentation: { icon: Zap, tooltip: 'action', kind: 'request' },
  },
  {
    match: (dl) => dl === 'running code',
    presentation: { icon: SquareTerminal, tooltip: 'code execution', kind: 'request' },
  },
  {
    match: (dl) => dl.startsWith('running:'),
    presentation: { icon: Play, tooltip: 'function execution', kind: 'request' },
  },
  {
    match: (dl) =>
      dl === 'storing reusable skills' || dl.includes('storage') || dl.includes('searching skills'),
    presentation: { icon: Bookmark, tooltip: 'storage', kind: 'note' },
  },
  {
    match: (dl) => dl === 'reading file',
    presentation: { icon: FileText, tooltip: 'file read', kind: 'note' },
  },
  {
    match: (dl) => dl === 'processing memory chunk',
    presentation: { icon: Cpu, tooltip: 'memory processing', kind: 'note' },
  },
  {
    match: (dl) => dl === 'reorganizing notes',
    presentation: { icon: RefreshCw, tooltip: 'note reorganization', kind: 'note' },
  },
  {
    match: (dl) => dl === 'working on task',
    presentation: { icon: Wrench, tooltip: 'task', kind: 'request' },
  },
  {
    match: (dl) => dl === 'searching the web',
    presentation: { icon: Globe, tooltip: 'web search', kind: 'question' },
  },
  {
    match: (dl) => dl === 'answering question' || dl.includes('question answering'),
    presentation: { icon: MessageCircle, tooltip: 'question answering', kind: 'question' },
  },
  {
    match: (dl) => dl.includes('review'),
    presentation: { icon: Bookmark, tooltip: 'storage', kind: 'note' },
  },
  {
    match: (dl) => dl.includes('contact'),
    presentation: { icon: Users, tooltip: 'contact lookup', kind: 'default' },
  },
  {
    match: (dl) => dl.includes('notes') || dl.includes('knowledge'),
    presentation: { icon: BookOpen, tooltip: 'knowledge base', kind: 'note' },
  },
  {
    match: (dl) => dl.includes('credential') || dl.includes('secret'),
    presentation: { icon: KeyRound, tooltip: 'credential access', kind: 'default' },
  },
  {
    match: (dl) => dl.includes('task'),
    presentation: { icon: ListChecks, tooltip: 'task management', kind: 'request' },
  },
  {
    match: (dl) => dl.includes('conversation') || dl.includes('transcript'),
    presentation: { icon: MessageSquare, tooltip: 'conversation', kind: 'default' },
  },
];

/**
 * Candidate identity keys for a node, most specific first. The hierarchy's
 * last segment is the method that produced the event; unify emits it either
 * as its own segment (`['SkillManager', 'store']`) or dotted
 * (`['SkillManager.store']`), so both are normalised here.
 */
export function actionIdentityKeys(hierarchy: readonly string[] | undefined): string[] {
  if (!hierarchy?.length) return [];
  const segments = hierarchy.flatMap((segment) => segment.split('.')).filter(Boolean);
  if (segments.length === 0) return [];
  const manager = segments[0];
  const method = segments[segments.length - 1];
  return [
    segments.join('.'),
    segments.length > 1 ? `${manager}.${method}` : '',
    method,
    manager,
  ].filter(Boolean);
}

/**
 * Resolve a node's icon, tooltip and colour. Stable identity wins; the prose
 * fallback only runs for events the identity map does not cover.
 */
export function resolveActionNodePresentation(
  node: Partial<Pick<ActionNode, 'displayLabel' | 'hierarchy'>>
): ActionNodePresentation {
  for (const key of actionIdentityKeys(node.hierarchy)) {
    const presentation = ACTION_PRESENTATION_BY_IDENTITY.get(key);
    if (presentation) return presentation;
  }

  if (!node.displayLabel) return DEFAULT_PRESENTATION;
  const lowercased = node.displayLabel.toLowerCase();
  const legacy = LEGACY_LABEL_PRESENTATION.find((entry) => entry.match(lowercased));
  return legacy?.presentation ?? DEFAULT_PRESENTATION;
}
