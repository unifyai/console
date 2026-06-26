import {
  MessageSquare,
  Activity,
  LayoutDashboard,
  ListTodo,
  Plug2,
  Contact,
  MessagesSquare,
  BookOpen,
  Braces,
  Compass,
  Database,
  type LucideIcon,
} from 'lucide-react';
import type { RightPaneTab } from '@/components/Pages/Assistants/RightPaneContainer';

/**
 * A rail section is one of four kinds:
 * - `view`: maps to an existing right-pane view (`RightPaneTab`) rendered by
 *   `RightPaneContainer`.
 * - `brain-view`: a Brain area with its own dedicated component (not a
 *   `RightPaneTab`), rendered directly under the section header.
 * - `action`: triggers a side effect (e.g. opening the Contacts dialog) without
 *   changing the active view.
 * - `placeholder`: a net-new Brain area shown as a brand "coming soon" panel
 *   until its real view is built.
 */
export type SectionKind = 'view' | 'brain-view' | 'action' | 'placeholder';

export interface SectionDef {
  id: string;
  label: string;
  Icon: LucideIcon;
  /** One-line description shown under the title in the section header. */
  desc: string;
  /** Guided "things to try" steps surfaced in the header info popover. */
  steps: ReadonlyArray<readonly [string, string]>;
  kind: SectionKind;
  /** Present iff `kind === 'view'` — the right-pane view this section renders. */
  tab?: RightPaneTab;
}

export const WORKSPACE_SECTIONS: ReadonlyArray<SectionDef> = [
  {
    id: 'chat',
    label: 'Chat',
    Icon: MessageSquare,
    kind: 'view',
    tab: 'chat',
    desc: 'Talk to your droid — voice notes, files and screen share, all in one thread.',
    steps: [
      ['Send a message or voice note', 'Type below, or hold the mic to record and send audio.'],
      ['Share your screen', 'Your droid can watch live and guide you step by step.'],
      ['Attach files', 'Drop in docs, images or screenshots to give context.'],
    ],
  },
  {
    id: 'actions',
    label: 'Actions',
    Icon: Activity,
    kind: 'view',
    tab: 'actions',
    desc: 'Every request your droid worked on in a time window — expand any one to see how it thought.',
    steps: [
      ['Pick a time window', 'Use the dropdown to scope to the last 3h, 6h, 24h…'],
      ['Expand a request', 'See the final response plus the full step timeline.'],
      ['Open the nitty-gritty', 'Each step shows thoughts, tool calls and code with output.'],
    ],
  },
  {
    id: 'dashboards',
    label: 'Dashboards',
    Icon: LayoutDashboard,
    kind: 'view',
    tab: 'dashboards',
    desc: 'Live tiles and reports your droid builds for you, on request.',
    steps: [
      ['Switch dashboard', 'Use the picker to jump between dashboards and search tiles.'],
      ['Open a tile', 'View it inline, or pop it out into its own tab.'],
      ['Download', 'Export any tile or the whole dashboard.'],
    ],
  },
  {
    id: 'tasks',
    label: 'Tasks',
    Icon: ListTodo,
    kind: 'view',
    tab: 'tasks',
    desc: 'Scheduled, recurring, triggered and continuous workflows — definition and run history together.',
    steps: [
      ['Create a task', 'Describe the workflow and how often it should run.'],
      ['Expand a task', 'See its definition and full run history in one place.'],
      ['Control a run', 'Run now, pause, or open a past run to inspect it.'],
    ],
  },
  {
    id: 'integrations',
    label: 'Integrations',
    Icon: Plug2,
    kind: 'view',
    tab: 'integrations',
    desc: 'Connect the apps and tools your droid can act through — mail, calendar, CRM and more.',
    steps: [
      ['Find an app', 'Search the catalog or filter by category.'],
      ['Review access', 'Open details to see exactly what the droid can do.'],
      ['Connect securely', 'Authorize via OAuth or paste an API key.'],
    ],
  },
];

export const BRAIN_SECTIONS: ReadonlyArray<SectionDef> = [
  {
    id: 'contacts',
    label: 'Contacts',
    Icon: Contact,
    kind: 'brain-view',
    desc: 'People your droid remembers, with the context it keeps on each.',
    steps: [
      ['Open a contact', 'Click any card to see full details in a drawer.'],
      ['Filter by tag', 'Use the tag chips to narrow the directory.'],
      ['Add a contact', 'Capture someone new for your droid to remember.'],
    ],
  },
  {
    id: 'transcripts',
    label: 'Transcripts',
    Icon: MessagesSquare,
    kind: 'brain-view',
    desc: 'Every conversation across chat, email, call, SMS and WhatsApp, in one consolidated thread.',
    steps: [
      ['Pick a channel', 'The channel rail re-themes the thread per medium.'],
      ['Open a message', 'Click any line to read it in full in a drawer.'],
      ['Search content', 'Find a phrase across every channel at once.'],
    ],
  },
  {
    id: 'knowledge',
    label: 'Knowledge',
    Icon: BookOpen,
    kind: 'brain-view',
    desc: 'Durable facts and rules your droid relies on — rich documents, rendered on the right.',
    steps: [
      ['Open a rule', 'Select from the list to read the rendered document.'],
      ['Filter by scope', 'Group knowledge by the area it governs.'],
      ['Add knowledge', 'Write a new rule in Markdown for your droid.'],
    ],
  },
  {
    id: 'functions',
    label: 'Functions',
    Icon: Braces,
    kind: 'brain-view',
    desc: 'Learned Python skills, with signatures, source and a way to run them.',
    steps: [
      ['Open a function', 'Inspect its signature, docstring and source.'],
      ['Fill inputs', 'Provide argument values in the run panel.'],
      ['Run & read output', 'Execute and see the returned value inline.'],
    ],
  },
  {
    id: 'guidance',
    label: 'Guidance',
    Icon: Compass,
    kind: 'brain-view',
    desc: 'Playbooks that shape how your droid behaves — rich documents, rendered on the right.',
    steps: [
      ['Open a playbook', 'Select from the list to read the rendered document.'],
      ['Filter by scope', 'Group guidance by the area it applies to.'],
      ['Add guidance', 'Write a new playbook in Markdown.'],
    ],
  },
  {
    id: 'data',
    label: 'Data',
    Icon: Database,
    kind: 'brain-view',
    desc: 'Everything your droid has ingested — browse nested tables like a directory, open any to view rows.',
    steps: [
      ['Open a folder', 'Drill into nested tables like a file directory.'],
      ['Open a table', 'View its dynamic schema and rows at the leaf.'],
      ['Trace the source', 'Each table shows where the data came from.'],
    ],
  },
];

export const ALL_SECTIONS: ReadonlyArray<SectionDef> = [...WORKSPACE_SECTIONS, ...BRAIN_SECTIONS];

export const SECTION_BY_ID: Record<string, SectionDef> = Object.fromEntries(
  ALL_SECTIONS.map((s) => [s.id, s])
);

/** The section shown on first load and after picking a fresh droid. */
export const DEFAULT_SECTION_ID = 'chat';
