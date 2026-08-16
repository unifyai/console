import {
  MessageSquare,
  Activity,
  Boxes,
  LayoutDashboard,
  ListTodo,
  Plug2,
  Contact,
  MessagesSquare,
  BookOpen,
  Braces,
  Compass,
  Database,
  MonitorPlay,
  UsersRound,
  type LucideIcon,
} from 'lucide-react';
import type { RightPaneTab } from '@/components/Pages/Assistants/RightPaneContainer';
import type { RailGroupId } from '@/types/shell/rail';

/**
 * What kind of entity the selector currently points at. Sections declare
 * which kinds they make sense for: AI-brain sections (Guidance, Functions,
 * Desktop, …) are assistant-only, humans get just Chat, and teams get their
 * group chat + members overview.
 */
export type SelectorEntityKind = 'assistant' | 'human' | 'team' | 'group';

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
  /** Description shown in the header info popover. */
  desc: string;
  /** Guided "things to try" steps surfaced in the header info popover. */
  steps: ReadonlyArray<readonly [string, string]>;
  kind: SectionKind;
  /** Present iff `kind === 'view'` — the right-pane view this section renders. */
  tab?: RightPaneTab;
  /**
   * Selector entity kinds this section applies to. Omitted means
   * assistant-only (the historical default).
   */
  appliesTo?: ReadonlyArray<SelectorEntityKind>;
}

export function sectionAppliesTo(section: SectionDef, kind: SelectorEntityKind): boolean {
  return (section.appliesTo ?? ['assistant']).includes(kind);
}

/**
 * The teammate's home surface — profile, thread, voice, and screen share in one
 * pane. Reached by the rail switcher's face rather than a nav button, so it is
 * kept out of `WORKSPACE_SECTIONS`; routing still resolves it via `ALL_SECTIONS`.
 */
export const CHAT_SECTION: SectionDef = {
  id: 'chat',
  label: 'Chat',
  Icon: MessageSquare,
  kind: 'view',
  tab: 'chat',
  appliesTo: ['assistant', 'human', 'team', 'group'],
  desc: 'Talk to your teammate — messages, voice notes, files, and screen share in one thread.',
  steps: [
    ['Send a message', 'Type below and press Enter, or hold the mic to record a voice note.'],
    ['Attach files', 'Drop documents, images, or screenshots into the composer for extra context.'],
    ['Share your screen', 'Start screen share so your teammate can follow along live.'],
  ],
};

export const WORKSPACE_SECTIONS: ReadonlyArray<SectionDef> = [
  {
    id: 'members',
    label: 'Members',
    Icon: UsersRound,
    kind: 'view',
    appliesTo: ['team'],
    desc: 'Everyone on this team — humans and AI teammates, with online status.',
    steps: [
      ['Scan the roster', 'Humans and AI teammates are listed with their online status.'],
      ['Open a member', 'Select any member from the top selector to jump to them.'],
      ['Manage the team', 'Add or remove members from Settings → Organization → Teams.'],
    ],
  },
  {
    id: 'actions',
    label: 'Actions',
    Icon: Activity,
    kind: 'view',
    tab: 'actions',
    desc: 'Every request your teammate worked on in a time window — expand any one to see how it thought.',
    steps: [
      [
        'Pick a time window',
        'Use the clock control to scope history to the last few hours or days.',
      ],
      ['Search the timeline', 'Filter by text to jump to a specific request or step.'],
      [
        'Expand a request',
        'Open a row to read the final response and the full step-by-step timeline.',
      ],
    ],
  },
  {
    id: 'canvas',
    label: 'Canvas',
    Icon: LayoutDashboard,
    kind: 'view',
    tab: 'canvas',
    appliesTo: ['assistant', 'team'],
    desc: 'Interactive views your teammate builds for you — live data, and controls that do real work.',
    steps: [
      ['Ask for a view', 'Describe what you want to see and your teammate will build it.'],
      [
        'Use the controls',
        'Buttons and forms on a canvas run real work; you confirm before anything happens.',
      ],
      ['Ask for a change', 'Say what to adjust and the canvas updates in place.'],
    ],
  },
  {
    id: 'tasks',
    label: 'Tasks',
    Icon: ListTodo,
    kind: 'view',
    tab: 'tasks',
    appliesTo: ['assistant', 'team'],
    desc: 'Scheduled, recurring, triggered, and continuous tasks — definition and run history together.',
    steps: [
      ['Filter the list', 'Switch between All, Active, and Paused to narrow what you see.'],
      ['Search tasks', 'Find a task by name or description.'],
      ['Expand a task', 'Open a card to read its definition and past run history in one place.'],
    ],
  },
  {
    id: 'desktop',
    label: 'Desktop',
    Icon: MonitorPlay,
    kind: 'view',
    tab: 'desktop',
    desc: "Watch your teammate's managed Computer live — or take control — once Computer Use is enabled.",
    steps: [
      [
        'Enable Computer',
        'Desktop needs a managed Ubuntu or Windows Computer. Enable it from this view if it is not on yet.',
      ],
      ['Open the desktop', 'The live view connects automatically once the teammate has a session.'],
      ['Take control', 'Switch from view-only to interactive to drive the desktop yourself.'],
    ],
  },
  {
    id: 'workflows',
    label: 'Workflows',
    Icon: Boxes,
    kind: 'view',
    tab: 'workflows',
    desc: 'Off-the-shelf jobs your teammate already knows how to do — install one and it sets itself up.',
    steps: [
      [
        "Check what's installed",
        'The Installed tab shows whether each workflow is working and what runs next.',
      ],
      ['Browse the shelf', 'Filter by category to see what else your teammate could take on.'],
      [
        'Install and inspect',
        'Open a card to see what a workflow needs and exactly what it sets up.',
      ],
    ],
  },
  {
    id: 'integrations',
    label: 'Integrations',
    Icon: Plug2,
    kind: 'view',
    tab: 'integrations',
    desc: 'Connect the apps and tools your teammate can act through — mail, calendar, CRM, and more.',
    steps: [
      ['Browse the catalog', 'Search or filter by category to find an app.'],
      ['Review permissions', 'Open a card to see exactly what the teammate can access.'],
      ['Connect an app', 'Authorize with OAuth or paste an API key where supported.'],
    ],
  },
];

export const BRAIN_SECTIONS: ReadonlyArray<SectionDef> = [
  {
    id: 'contacts',
    appliesTo: ['assistant', 'team'],
    label: 'Contacts',
    Icon: Contact,
    kind: 'brain-view',
    desc: 'People your teammate remembers, with the context it keeps on each.',
    steps: [
      ['Browse the directory', 'Scroll the card grid or search by name, email, or tag.'],
      ['Open a contact', 'Click any card to read full details in the drawer.'],
      ['Add or edit', 'Use Add contact or Edit in the drawer to open the contact manager.'],
    ],
  },
  {
    id: 'transcripts',
    appliesTo: ['assistant', 'team'],
    label: 'Transcripts',
    Icon: MessagesSquare,
    kind: 'brain-view',
    desc: 'Every conversation across chat, email, call, SMS, and WhatsApp in one consolidated thread.',
    steps: [
      ['Pick a channel', 'Use the channel rail to focus on chat, email, calls, or messaging.'],
      [
        'Switch layout',
        'Toggle between Threads and Feed depending on how you want to scan history.',
      ],
      ['Search content', 'Find a phrase across every channel at once.'],
    ],
  },
  {
    id: 'knowledge',
    appliesTo: ['assistant', 'team'],
    label: 'Knowledge',
    Icon: BookOpen,
    kind: 'brain-view',
    desc: 'Typed claim ledger — facts, policies, decisions, and preferences with provenance.',
    steps: [
      ['Open a claim', 'Select an entry from the list to read the full claim body.'],
      ['Filter by kind or status', 'Narrow to facts, policies, active claims, and more.'],
      ['Inspect sources', 'Source chips show where each claim came from.'],
    ],
  },
  {
    id: 'functions',
    appliesTo: ['assistant', 'team'],
    label: 'Functions',
    Icon: Braces,
    kind: 'brain-view',
    desc: 'Learned Python skills and platform primitives — signatures, docstrings, and source in one place.',
    steps: [
      ['Filter by kind', 'Switch between All, Learned, and Primitives.'],
      [
        'Open a function',
        'Click a card to inspect signature, parameters, returns, and implementation.',
      ],
      ['Copy source', 'Use Copy in the drawer when you need the implementation elsewhere.'],
    ],
  },
  {
    id: 'guidance',
    appliesTo: ['assistant', 'team'],
    label: 'Guidance',
    Icon: Compass,
    kind: 'brain-view',
    desc: 'Playbooks that shape how your teammate behaves — rich documents rendered on the right.',
    steps: [
      ['Open a playbook', 'Select an entry from the list to read the rendered document.'],
      ['Filter by scope or tag', 'Use the filter menu to group related playbooks.'],
      ['Resize the panes', 'Drag the divider to give the list or document more room.'],
    ],
  },
  {
    id: 'data',
    appliesTo: ['assistant', 'team'],
    label: 'Data',
    Icon: Database,
    kind: 'brain-view',
    desc: 'Browse the external data connected to this assistant — tables you create here and files you upload or ingest.',
    steps: [
      ['Pick a table', 'Select a table from the directory to browse its rows.'],
      ['Add data', 'Use + to create a table or upload a file into the current folder.'],
      ['Edit in place', 'Double-click a cell to edit it, or open a row for the full record.'],
    ],
  },
];

/**
 * A rail section group — a library, in the vocabulary's terms. The label is the
 * section heading the rail prints; the sections it holds keep their own content
 * kinds (Guidance holds procedures, Knowledge holds claims), so the two words
 * stay distinct.
 */
export interface SectionGroupDef {
  id: RailGroupId;
  label: string;
  sections: ReadonlyArray<SectionDef>;
}

/**
 * The rail's groups in render order. Pinning reorders sections within a group
 * and never across one, so this is the unit both the layout and the stored
 * config key off.
 */
export const SECTION_GROUPS: ReadonlyArray<SectionGroupDef> = [
  { id: 'workspace', label: 'Workspace', sections: WORKSPACE_SECTIONS },
  { id: 'storage', label: 'Storage', sections: BRAIN_SECTIONS },
];

export const ALL_SECTIONS: ReadonlyArray<SectionDef> = [
  CHAT_SECTION,
  ...WORKSPACE_SECTIONS,
  ...BRAIN_SECTIONS,
];

export const SECTION_BY_ID: Record<string, SectionDef> = Object.fromEntries(
  ALL_SECTIONS.map((s) => [s.id, s])
);

/** The section shown on first load and after picking a fresh teammate. */
export const DEFAULT_SECTION_ID = 'chat';

/** Keep the current section when it applies to the new entity; otherwise Chat. */
export function resolveSectionForEntity(sectionId: string, kind: SelectorEntityKind): string {
  const section = SECTION_BY_ID[sectionId];
  if (section && sectionAppliesTo(section, kind)) return sectionId;
  return DEFAULT_SECTION_ID;
}
