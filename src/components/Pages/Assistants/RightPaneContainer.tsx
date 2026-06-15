'use client';

import React, { useState, useCallback } from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/UI/tabs';
import { Button } from '@/components/UI/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/UI/tooltip';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/UI/dropdown-menu';
import {
  Activity,
  BookOpen,
  Brain,
  ChevronDown,
  Code,
  Columns2,
  Compass,
  ListChecks,
  ListTodo,
  MessageSquare,
  Plug2,
  LayoutDashboard,
  Users,
  X,
} from 'lucide-react';
import type { MemoryContext, TaskMemoryView } from '@/types/assistants/memory';
import { cn } from '@/lib/utils';
import { LiveActionsViewer } from './LiveActions';
import { DashboardsPane } from './Dashboards';
import { MemoryPane } from './Memory';
import { TasksPane } from './Tasks';
import { IntegrationsPane } from './Integrations';
import { ChatWithInfoPanel } from './Chat/ChatWithInfoPanel';
import type { AssistantActionActions } from '@/types/assistants/action';
import type { Assistant, AssistantActions } from '@/types/assistants/assistant';
import type { ContactType } from '@/types/assistants/contact';
import type { DashboardPaneData } from '@/types/assistants/dashboard';
import { assistantDisplayName } from '@/lib/assistants/displayName';
import type { ChatMessage, CallPill } from '@/types/assistants/chat';
import {
  type SpendingGateStatus,
  DEFAULT_SPENDING_GATE_STATUS,
} from '@/types/assistants/spendingGate';
import type { ChatStreamConnectionStatus } from '@/hooks/Assistants/useAssistantChatStream';
import { useAssistantPermissions } from '@/hooks/Assistants/useAssistantPermissions';
const ACTIVE_TAB_TRIGGER_CLASS =
  'border-transparent bg-primary text-primary-foreground !shadow-none hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground focus-visible:ring-0 focus-visible:ring-offset-0 data-[state=active]:shadow-none';

const TAB_TRIGGER_CLASS = [
  'flex h-8 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md border border-transparent px-2 text-xs font-medium',
  'bg-transparent text-muted-foreground shadow-none transition-colors',
  'hover:bg-[var(--surface-hover)] hover:text-foreground',
  'focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0',
  'disabled:pointer-events-none disabled:opacity-50',
].join(' ');

const TAB_CONTENT_CLASS =
  'brand-chat-stencil-bg min-h-0 flex-1 overflow-hidden data-[state=inactive]:hidden';

/**
 * Right-pane tab identifiers. Kept as a string-literal union so the split
 * state and persistence layer can stay typed end-to-end.
 */
export type RightPaneTab = 'chat' | 'tasks' | 'dashboards' | 'memory' | 'integrations' | 'actions';

type MemoryTabContext = Exclude<MemoryContext, 'Tasks'>;

/**
 * Discriminated union of sub-tab IDs valid for each parent tab that has
 * sub-tabs. The dropdown in the tab strip uses the parent tab's
 * `subTabs` config to enumerate options and feeds the selected value
 * down to the relevant pane via its `subTab` prop. Stays as string IDs
 * here (rather than a fully typed map) so the config table can be a
 * single uniform shape.
 */
interface RightPaneSubTab {
  id: string;
  label: string;
  Icon: React.ComponentType<{ className?: string }>;
}

interface RightPaneTabConfig {
  id: RightPaneTab;
  label: string;
  Icon: React.ComponentType<{ className?: string }>;
  /** Tooltip text. `name` is the assistant's first name (or a fallback)
   *  so each tooltip reads as "of *this* assistant" — same personal-
   *  isation pattern the info side panel uses elsewhere. */
  describe: (name: string) => string;
  /**
   * Optional sub-tabs surfaced via a dropdown that *replaces* the
   * default tab-click behaviour: clicking the tab opens this menu,
   * picking an item switches the slot to this parent tab AND sets the
   * sub-tab on the pane. Tabs without a `subTabs` config keep the
   * direct-switch click behaviour they always had.
   */
  subTabs?: ReadonlyArray<RightPaneSubTab>;
  /**
   * When true, render a subtle vertical divider immediately *before*
   * this tab in the strip. Used to visually group the right-pane tabs
   * into clusters of related functionality without changing the
   * underlying tab semantics. (Drawing a `border-l` on the tab itself
   * would inherit the active-tab text-colour and shift on hover, so a
   * dedicated separator element is cleaner.)
   */
  dividerBefore?: boolean;
}

function JoystickIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={cn(className, '!h-4 !w-4')}
      fill="none"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M12 13.25V6.75" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
      <circle cx="12" cy="5.25" r="2.25" fill="currentColor" />
      <path
        d="M6.5 13.25h11l1.35 5.35A2.25 2.25 0 0 1 16.67 21H7.33a2.25 2.25 0 0 1-2.18-2.4l1.35-5.35Z"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="2"
      />
      <path d="M9 17h3.25M10.62 15.38v3.25" stroke="currentColor" strokeLinecap="round" />
      <circle cx="15.75" cy="16.75" r="0.9" fill="currentColor" />
    </svg>
  );
}

const MEMORY_SUB_TABS: ReadonlyArray<RightPaneSubTab> = [
  { id: 'Contacts', label: 'Contacts', Icon: Users },
  { id: 'Transcripts', label: 'Transcripts', Icon: MessageSquare },
  { id: 'Knowledge', label: 'Knowledge', Icon: BookOpen },
  { id: 'Guidance', label: 'Guidance', Icon: Compass },
  { id: 'Functions', label: 'Functions', Icon: Code },
];

const TASKS_SUB_TABS: ReadonlyArray<RightPaneSubTab> = [
  { id: 'Tasks', label: 'Tasks', Icon: ListChecks },
  { id: 'Activity', label: 'Activity', Icon: Activity },
];

const DEFAULT_MEMORY_SUB_TAB: MemoryTabContext = 'Contacts';
const DEFAULT_TASKS_SUB_TAB: TaskMemoryView = 'Tasks';

/**
 * Visual order — left to right. Grouped into three clusters of
 * related functionality (separated by subtle vertical dividers via
 * `dividerBefore`):
 *
 *   Group 1 — live interaction surfaces:
 *     1. Chat           — primary interaction surface.
 *     2. Actions        — Chat's live partner; what the assistant is
 *                          doing right now.
 *
 *   Group 2 — assistant-built outputs and capabilities:
 *     3. Dashboards     — data views built by the assistant.
 *     4. Integrations   — connected apps + raw credentials.
 *
 *   Group 3 — persistent context that drives the assistant:
 *     5. Tasks          — work in progress and completed tasks.
 *     6. Memory         — persistent context and notes.
 *
 * Reorder here is the single source of truth — slot rendering, the
 * tab strip, and (eventually) keyboard shortcuts all iterate this
 * array in order.
 */
export const RIGHT_PANE_TABS: ReadonlyArray<RightPaneTabConfig> = [
  {
    id: 'chat',
    label: 'Chat',
    Icon: MessageSquare,
    describe: (name) => `Conversation with ${name}`,
  },
  {
    id: 'actions',
    label: 'Actions',
    Icon: JoystickIcon,
    describe: (name) => `What ${name} is doing right now`,
  },
  {
    id: 'dashboards',
    label: 'Dashboards',
    Icon: LayoutDashboard,
    describe: (name) => `Data views built by ${name}`,
    dividerBefore: true,
  },
  {
    id: 'integrations',
    label: 'Integrations',
    Icon: Plug2,
    describe: (name) => `Connected apps and raw credentials available to ${name}`,
  },
  {
    id: 'tasks',
    label: 'Tasks',
    Icon: ListTodo,
    describe: (name) => `Work in progress and completed tasks for ${name}`,
    subTabs: TASKS_SUB_TABS,
    dividerBefore: true,
  },
  {
    id: 'memory',
    label: 'Memory',
    Icon: Brain,
    describe: (name) => `Persistent context and notes for ${name}`,
    subTabs: MEMORY_SUB_TABS,
  },
];

/**
 * Two-slot layout describing what the right pane is showing. `secondary`
 * is `null` when the pane is in single-view mode; `splitRatio` (0–1) is
 * the fraction of the pane width occupied by the primary slot when split.
 */
export interface RightPaneState {
  primary: { tab: RightPaneTab };
  secondary: { tab: RightPaneTab } | null;
  splitRatio: number;
}

export const DEFAULT_RIGHT_PANE_STATE: RightPaneState = {
  primary: { tab: 'chat' },
  secondary: null,
  splitRatio: 0.5,
};

const SPLIT_MIN_RATIO = 0.2;
const SPLIT_MAX_RATIO = 0.8;

/**
 * Picks a sensible default for the secondary slot when the user clicks
 * "split" — Actions is the most common partner to Chat (their original
 * pre-tabs side-by-side layout); for any other primary we default to
 * Chat so the user keeps the conversation visible while inspecting.
 */
function getDefaultSecondaryTab(primary: RightPaneTab): RightPaneTab {
  return primary === 'chat' ? 'actions' : 'chat';
}

interface RightPaneContainerProps {
  assistant: Assistant | null;
  actions: AssistantActionActions | null;
  dashboardActions: {
    getMetadata: (assistant: Assistant) => Promise<DashboardPaneData>;
    getTileContent: (assistant: Assistant, tileToken: string) => Promise<string | null>;
  } | null;
  assistantActions: AssistantActions;
  chatHistories: Record<string, ChatMessage[]>;
  setChatHistories: React.Dispatch<React.SetStateAction<Record<string, ChatMessage[]>>>;
  callPillHistories: Record<string, CallPill[]>;
  setCallPillHistories: React.Dispatch<React.SetStateAction<Record<string, CallPill[]>>>;
  userEmail: string | null | undefined;
  currentUserId?: string | null;
  isFirstView?: boolean;
  preHireChat?: ChatMessage[];
  onFirstViewCompleted?: () => void;
  onStartCall: (assistant: Assistant, callType: 'video' | 'audio') => void;
  activeCallAssistantId: string | null;
  isCallConnected: boolean;
  isConnectingCall: boolean;
  userTimezone?: string | null;
  canWrite?: boolean;
  spendingGate?: SpendingGateStatus;
  /** Page-level chat SSE health — rendered in the panel header. */
  chatStreamConnectionStatus: ChatStreamConnectionStatus;
  /** Force a reconnect of the page-level chat SSE. */
  reconnectChatStream: () => void;
  /**
   * Monotonic counter of inbound frames for the currently-open assistant;
   * drives the panel's typing-indicator clear.
   */
  chatStreamActivitySignal: number;
  /**
   * Two-slot pane state, lifted so `Main` can observe which tab(s) the
   * user is actually looking at (drives unread-badge suppression for the
   * Chat slot whether it lives in primary or secondary).
   */
  paneState: RightPaneState;
  onPaneStateChange: (next: RightPaneState) => void;
  /** Open the Edit Profile dialog for the given assistant (wired from Main). */
  onEditAssistant?: (assistant: Assistant) => void;
  /** Open the Contact Manager dialog for the given assistant (wired from Main). */
  onOpenContactManager: (assistant: Assistant, tab?: ContactType) => void;
  /** True iff the user has sent ≥1 message in this assistant's chat. */
  hasUserMessage?: boolean;
  /** True iff this assistant has ≥1 historical call recorded. */
  hasHistoricalCall?: boolean;
  /** True iff the logged-in user has a phone number on their profile. */
  hasUserPhoneNumber?: boolean;
  /** Latest user-message timestamp in this chat (drives prefill done-detection). */
  latestUserMessageAt?: Date | null;
  /** User's own phone number for chat prefill personalisation. */
  userPhoneNumber?: string | null;
  /** Open the logged-in user's account settings page. Optional `tab`
   *  mirrors the /account `?tab=` query param so callers can deep-link
   *  to a specific section (e.g. `'contact-info'`). */
  onOpenUserSettings?: (tab?: string) => void;
  /** True iff this assistant has outstanding setup work — drives the
   *  dot on the chat header's "Assistant info" button. */
  hasIncompleteOnboarding?: boolean;
  /**
   * Coordinator-only handler bag forwarded down to the info panel.
   * When the active assistant is the canonical Coordinator and it's
   * still in onboarding mode, the info panel surfaces a third
   * "Onboarding" sub-tab whose action rows are wired from here.
   * Ignored for non-coordinator assistants. */
  coordinatorOnboarding?: {
    onConnectWorkspace?: () => void;
    onConnectApps?: () => void;
    onActNow?: () => void;
    onScheduleTask?: () => void;
  };
  /**
   * Unread chat-message count for the currently-open assistant. Drives
   * the numeric badge on the Chat tab. Cleared by `Main` whenever the
   * user actually views the chat (in either slot), so we render the
   * badge unconditionally when `> 0` — no per-slot suppression needed.
   */
  unreadChatCount?: number;
  /**
   * Renderer for the docked call surface (the
   * ``AssistantCommunicationDialog`` in ``docked`` mode). Threaded
   * straight through to ``ChatWithInfoPanel`` which stacks it above
   * the chat panel; passed by ``Main`` only when a call is active for
   * *this* assistant and hasn't been popped out.
   */
  renderDockedCall?: () => React.ReactNode;
}

export function RightPaneContainer({
  assistant,
  actions,
  dashboardActions,
  assistantActions,
  chatHistories,
  setChatHistories,
  callPillHistories,
  setCallPillHistories,
  userEmail,
  currentUserId,
  isFirstView = false,
  preHireChat,
  onFirstViewCompleted,
  onStartCall,
  activeCallAssistantId,
  isCallConnected,
  isConnectingCall,
  userTimezone,
  canWrite = true,
  spendingGate = DEFAULT_SPENDING_GATE_STATUS,
  chatStreamConnectionStatus,
  reconnectChatStream,
  chatStreamActivitySignal,
  paneState,
  onPaneStateChange,
  onEditAssistant,
  onOpenContactManager,
  hasUserMessage,
  hasHistoricalCall,
  hasUserPhoneNumber,
  latestUserMessageAt,
  userPhoneNumber,
  onOpenUserSettings,
  hasIncompleteOnboarding,
  coordinatorOnboarding,
  unreadChatCount = 0,
  renderDockedCall,
}: RightPaneContainerProps) {
  // Tracks whether the live-actions stream is currently working, so the
  // dashboards pane can poll its tiles. Hoisted here because either pane
  // (or both, if split shows actions twice) feeds it; the actions tab
  // body owns the actual subscription.
  const [hasActiveAction, setHasActiveAction] = useState(false);
  const handleActiveActionChange = useCallback((active: boolean) => {
    setHasActiveAction(active);
  }, []);
  const { canOpenAssistantChat } = useAssistantPermissions();

  // Per-slot sub-tab state for the tabs that have sub-tabs (Memory,
  // Tasks). Kept here so the dropdown in the tab strip can both *drive*
  // the pane's sub-tab (dropdown click → pane switches) and *reflect*
  // the pane's current sub-tab (footer-tab click inside the pane →
  // dropdown's radio indicator stays accurate). Each slot keeps its own
  // pair of sub-tab choices so a split view with the same tab in both
  // slots can show different sub-tabs.
  const [subTabBySlot, setSubTabBySlot] = useState<{
    primary: { memory: MemoryTabContext; tasks: TaskMemoryView };
    secondary: { memory: MemoryTabContext; tasks: TaskMemoryView };
  }>({
    primary: { memory: DEFAULT_MEMORY_SUB_TAB, tasks: DEFAULT_TASKS_SUB_TAB },
    secondary: { memory: DEFAULT_MEMORY_SUB_TAB, tasks: DEFAULT_TASKS_SUB_TAB },
  });

  const setSlotSubTab = useCallback(
    <K extends 'memory' | 'tasks'>(
      slot: 'primary' | 'secondary',
      key: K,
      value: K extends 'memory' ? MemoryTabContext : TaskMemoryView
    ) => {
      setSubTabBySlot((prev) =>
        prev[slot][key] === value ? prev : { ...prev, [slot]: { ...prev[slot], [key]: value } }
      );
    },
    []
  );

  // Stable per-slot callback factories so MemoryPane / TasksPane don't
  // re-fire their `onSubTabChange` effect on every render of this
  // container.
  const primaryMemoryChange = useCallback(
    (next: MemoryTabContext) => setSlotSubTab('primary', 'memory', next),
    [setSlotSubTab]
  );
  const primaryTasksChange = useCallback(
    (next: TaskMemoryView) => setSlotSubTab('primary', 'tasks', next),
    [setSlotSubTab]
  );
  const secondaryMemoryChange = useCallback(
    (next: MemoryTabContext) => setSlotSubTab('secondary', 'memory', next),
    [setSlotSubTab]
  );
  const secondaryTasksChange = useCallback(
    (next: TaskMemoryView) => setSlotSubTab('secondary', 'tasks', next),
    [setSlotSubTab]
  );

  // --- Splitter resize ---
  const splitContainerRef = React.useRef<HTMLDivElement | null>(null);
  const [isResizingSplit, setIsResizingSplit] = React.useState(false);

  const handleSplitResizeStart = React.useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      const container = splitContainerRef.current;
      if (!container) return;
      const rect = container.getBoundingClientRect();
      setIsResizingSplit(true);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';

      const onMove = (ev: MouseEvent) => {
        const ratio = (ev.clientX - rect.left) / rect.width;
        const clamped = Math.min(SPLIT_MAX_RATIO, Math.max(SPLIT_MIN_RATIO, ratio));
        onPaneStateChange({ ...paneState, splitRatio: clamped });
      };
      const onUp = () => {
        setIsResizingSplit(false);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
        window.removeEventListener('mousemove', onMove);
        window.removeEventListener('mouseup', onUp);
      };

      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onUp);
    },
    [onPaneStateChange, paneState]
  );

  if (!assistant) {
    return (
      <div className="brand-chat-stencil-bg h-full w-full bg-background">
        <LiveActionsViewer
          assistant={null}
          actions={null}
          className="h-full"
          onHasActiveActionChange={handleActiveActionChange}
        />
      </div>
    );
  }

  if (!canOpenAssistantChat(assistant)) {
    return (
      <div
        data-testid="coordinator-private"
        className="flex h-full flex-col items-center justify-center gap-2 p-8 text-center"
      >
        <p className="text-body-muted">Marty chat is private.</p>
        <p className="text-caption text-muted-foreground">
          Open Marty from this workspace to continue.
        </p>
      </div>
    );
  }

  const isInThisCall = activeCallAssistantId === assistant.agentId;
  const isSpendingBlocked = spendingGate.isBlocked && !isInThisCall;

  // Each slot renders its own tab strip + force-mounted bodies via
  // `renderPane`; this keeps the per-slot scroll / mount state stable
  // when the user switches tabs within a slot, without leaking state
  // across slots.
  const renderPane = (
    slot: 'primary' | 'secondary',
    tab: RightPaneTab,
    options: { canSplit: boolean; canClose: boolean }
  ) => {
    const { canSplit, canClose } = options;

    const onTabChange = (next: string) => {
      const nextTab = next as RightPaneTab;
      if (slot === 'primary') {
        onPaneStateChange({ ...paneState, primary: { tab: nextTab } });
      } else {
        onPaneStateChange({ ...paneState, secondary: { tab: nextTab } });
      }
    };

    const handleSplit = () =>
      onPaneStateChange({
        ...paneState,
        secondary: { tab: getDefaultSecondaryTab(paneState.primary.tab) },
      });

    // Closing the *primary* slot in split mode promotes the secondary
    // into the primary position, so the user keeps whichever pane they
    // wanted to focus on. Closing the *secondary* simply drops it.
    const handleClose = () => {
      if (slot === 'primary' && paneState.secondary) {
        onPaneStateChange({
          ...paneState,
          primary: paneState.secondary,
          secondary: null,
        });
      } else {
        onPaneStateChange({ ...paneState, secondary: null });
      }
    };

    return (
      <Tabs
        value={tab}
        onValueChange={onTabChange}
        className="flex h-full min-w-0 flex-1 flex-col"
        data-slot={slot}
      >
        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border bg-card px-3 py-1.5">
          <div className="right-pane-tabs-container flex min-w-0 flex-1 items-center overflow-hidden">
            <TabsList
              // Labels are visually hidden; tooltips carry the short titles.
              className="right-pane-tabs-list h-8 flex-nowrap gap-2 rounded-none bg-transparent p-0"
            >
              {RIGHT_PANE_TABS.map(({ id, label, Icon, subTabs, dividerBefore }) => {
                // "Active in this slot" — i.e. the tab the user is
                // currently looking at. Used to suppress the unread
                // chip while chat is visible (defensive: `Main` also
                // clears the count for us, but covers the brief render
                // frame between view and clear).
                const isActiveInThisSlot = id === tab;
                const showUnreadInsteadOfIcon =
                  id === 'chat' && !isActiveInThisSlot && unreadChatCount > 0;
                // The Activity icon gains a pulse when there's live
                // work — the Activity glyph is already a graph waveform,
                // so pulsing it reads as "telemetry active" without
                // needing a separate dot. The pulse persists even when
                // Actions is the visible tab: it's a *state* indicator
                // (work in flight), not an attention bid, and with the
                // selected button state has enough contrast to carry both
                // "selected" and "live" without a separate background.
                const isActionsLive = id === 'actions' && hasActiveAction;
                const unreadLabel = unreadChatCount > 99 ? '99+' : String(unreadChatCount);
                const ariaLabel = showUnreadInsteadOfIcon
                  ? `${label} — ${unreadChatCount} unread`
                  : isActionsLive
                    ? `${label} — live`
                    : label;

                // Subtle vertical separator drawn immediately before
                // the tab when its config opts in via `dividerBefore`.
                // The negative horizontal margin pulls the surrounding
                // `gap-3` gap on the TabsList in a bit so the dividers
                // read as a *grouping cue* rather than a full extra
                // tab-sized slot, which is enough to
                // suggest the grouping without breaking the flow.
                // `self-center` keeps the 16px-tall line vertically
                // centred in the tab row.
                const dividerNode = dividerBefore ? (
                  <span
                    aria-hidden="true"
                    className="right-pane-tab-divider -mx-2 h-4 w-px self-center bg-border"
                    data-testid={
                      slot === 'primary'
                        ? `right-pane-tab-divider-${id}`
                        : `right-pane-secondary-tab-divider-${id}`
                    }
                  />
                ) : null;

                // Tabs with `subTabs` configured replace the direct
                // tab-switch click with a dropdown of sub-tab options.
                // Picking an option switches the slot to this parent
                // tab AND sets the matching sub-tab on the pane below.
                // We render a plain button (not a TabsTrigger) so the
                // click doesn't fight Radix's tab-switch handler — the
                // `data-state` is still set manually for tests and
                // assistive tooling that inspect active state on the
                // trigger.
                if (subTabs && subTabs.length > 0) {
                  const slotSubTabs = subTabBySlot[slot];
                  const currentSubTabValue: string =
                    id === 'memory' ? slotSubTabs.memory : id === 'tasks' ? slotSubTabs.tasks : '';
                  // The tab chip *displays* the currently-selected
                  // sub-tab (label + icon) rather than the parent tab's
                  // own name, so the user can read which sub-tab they
                  // are on without having to open the dropdown. The
                  // ChevronDown glyph + parent tooltip still convey the
                  // grouping and dropdown affordance. Falls back to the
                  // parent's own label/Icon if the current sub-tab id
                  // can't be resolved (defensive — shouldn't happen
                  // with a non-empty `subTabs` list).
                  const currentSubTab = subTabs.find((st) => st.id === currentSubTabValue);
                  const DisplayIcon = currentSubTab?.Icon ?? Icon;
                  const displayLabel = currentSubTab?.label ?? label;
                  const dropdownTitle = displayLabel;
                  const handleSubTabSelect = (next: string) => {
                    if (id === 'memory') {
                      setSlotSubTab(slot, 'memory', next as MemoryTabContext);
                    } else if (id === 'tasks') {
                      setSlotSubTab(slot, 'tasks', next as TaskMemoryView);
                    }
                    // Switch the slot to this parent tab on selection;
                    // a no-op when we're already on it.
                    if (!isActiveInThisSlot) onTabChange(id);
                  };
                  return (
                    <React.Fragment key={id}>
                      {dividerNode}
                      <DropdownMenu>
                        <TooltipProvider delayDuration={300}>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              {/* Wrapping span mirrors the non-dropdown
                                  branch's two-asChild-slot workaround:
                                  it keeps the tooltip's event handlers
                                  off the trigger button so the
                                  dropdown opens cleanly on click. */}
                              <span className="inline-flex">
                                <DropdownMenuTrigger asChild>
                                  <button
                                    type="button"
                                    data-state={isActiveInThisSlot ? 'active' : 'inactive'}
                                    className={cn(
                                      TAB_TRIGGER_CLASS,
                                      isActiveInThisSlot && ACTIVE_TAB_TRIGGER_CLASS
                                    )}
                                    data-testid={
                                      slot === 'primary'
                                        ? `right-pane-tab-${id}`
                                        : `right-pane-secondary-tab-${id}`
                                    }
                                    aria-label={dropdownTitle}
                                    aria-haspopup="menu"
                                  >
                                    <DisplayIcon className="h-3.5 w-3.5" aria-hidden="true" />
                                    <span className="right-pane-tab-label">{displayLabel}</span>
                                    <ChevronDown
                                      className="h-3 w-3 opacity-60"
                                      aria-hidden="true"
                                    />
                                  </button>
                                </DropdownMenuTrigger>
                              </span>
                            </TooltipTrigger>
                            <TooltipContent side="bottom">
                              <p>{dropdownTitle}</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                        <DropdownMenuContent
                          align="start"
                          className="min-w-[10rem]"
                          data-testid={
                            slot === 'primary'
                              ? `right-pane-tab-${id}-menu`
                              : `right-pane-secondary-tab-${id}-menu`
                          }
                        >
                          {subTabs.map(({ id: subId, label: subLabel, Icon: SubIcon }) => {
                            const isSelectedSubTab = subId === currentSubTabValue;
                            return (
                              <DropdownMenuItem
                                key={subId}
                                onSelect={() => handleSubTabSelect(subId)}
                                data-testid={
                                  slot === 'primary'
                                    ? `right-pane-tab-${id}-menu-${subId.toLowerCase()}`
                                    : `right-pane-secondary-tab-${id}-menu-${subId.toLowerCase()}`
                                }
                                // Selected item gets the same primary-on-
                                // primary-foreground language used for the
                                // active footer sub-tab chips. The
                                // hover/focus overrides keep the colour
                                // stable while the user moves the mouse or
                                // keyboard focus around the menu.
                                className={cn(
                                  isSelectedSubTab &&
                                    'bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground'
                                )}
                              >
                                <SubIcon className="h-3.5 w-3.5" aria-hidden="true" />
                                <span>{subLabel}</span>
                              </DropdownMenuItem>
                            );
                          })}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </React.Fragment>
                  );
                }

                return (
                  <React.Fragment key={id}>
                    {dividerNode}
                    <TooltipProvider delayDuration={300}>
                      <Tooltip>
                        {/* `asChild` Slot wraps the *span*, NOT the
                            TabsTrigger directly. Chaining two Radix
                            asChild slots (TooltipTrigger → TabsTrigger
                            → TabsPrimitive.Trigger) suppressed the
                            `data-state` attribute on the rendered button
                            and broke the active-tab styling entirely.
                            The intermediate span eats the tooltip event
                            handlers / aria attributes; the inner
                            TabsTrigger renders untouched and its
                            data-state propagates as designed. The span
                            uses `inline-flex` so it doesn't disturb the
                            flex layout of the TabsList. */}
                        <TooltipTrigger asChild>
                          <span className="inline-flex">
                            <TabsTrigger
                              value={id}
                              className={cn(
                                TAB_TRIGGER_CLASS,
                                isActiveInThisSlot && ACTIVE_TAB_TRIGGER_CLASS
                              )}
                              // Primary slot keeps the legacy
                              // `right-pane-tab-{id}` id so existing e2e
                              // selectors (and the demo) keep working;
                              // the secondary slot uses an explicit
                              // prefix so tests can target a specific
                              // pane when split.
                              data-testid={
                                slot === 'primary'
                                  ? `right-pane-tab-${id}`
                                  : `right-pane-secondary-tab-${id}`
                              }
                              aria-label={ariaLabel}
                            >
                              {showUnreadInsteadOfIcon ? (
                                // Numeric chip *replaces* the icon (same
                                // visual slot, same width footprint as
                                // the 14×14 icon plus a few pixels for
                                // 2-3 digit counts). Same primary-on-
                                // primary-foreground language as the
                                // assistant-list unread badge so the
                                // meaning carries across surfaces.
                                <span
                                  data-testid={
                                    slot === 'primary'
                                      ? `right-pane-tab-chat-unread-badge`
                                      : `right-pane-secondary-tab-chat-unread-badge`
                                  }
                                  className="flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold tabular-nums leading-none text-primary-foreground"
                                >
                                  {unreadLabel}
                                </span>
                              ) : (
                                <Icon
                                  className={cn(
                                    'h-3.5 w-3.5',
                                    // Pulsing primary-coloured Activity
                                    // icon = "live action in flight".
                                    // The colour change carries the
                                    // signal even when reduced-motion
                                    // disables the pulse, so it stays
                                    // accessible.
                                    isActionsLive && 'animate-pulse text-primary'
                                  )}
                                  aria-hidden="true"
                                  data-testid={
                                    isActionsLive
                                      ? slot === 'primary'
                                        ? 'right-pane-tab-actions-live-icon'
                                        : 'right-pane-secondary-tab-actions-live-icon'
                                      : undefined
                                  }
                                />
                              )}
                              {/* Labels remain in the DOM for layout consistency,
                                  but CSS keeps the strip icon-only. */}
                              <span className="right-pane-tab-label">{label}</span>
                            </TabsTrigger>
                          </span>
                        </TooltipTrigger>
                        <TooltipContent side="bottom">
                          <p>{label}</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </React.Fragment>
                );
              })}
            </TabsList>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            {canSplit && (
              <TooltipProvider delayDuration={100}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="hidden h-6 w-6 sm:inline-flex"
                      onClick={handleSplit}
                      data-testid="right-pane-split-button"
                      aria-label="Split pane"
                    >
                      <Columns2 className="h-3.5 w-3.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">
                    <p>Open another tab side by side</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
            {canClose && (
              <TooltipProvider delayDuration={100}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={handleClose}
                      data-testid={`right-pane-close-${slot}`}
                      aria-label={slot === 'primary' ? 'Close left pane' : 'Close right pane'}
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">
                    <p>
                      {slot === 'primary'
                        ? 'Close this pane (right pane stays)'
                        : 'Close this pane (left pane stays)'}
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
        </div>

        <TabsContent value="chat" className={TAB_CONTENT_CLASS} forceMount>
          <ChatWithInfoPanel
            assistant={assistant}
            assistantActions={assistantActions}
            chatHistories={chatHistories}
            setChatHistories={setChatHistories}
            callPillHistories={callPillHistories}
            setCallPillHistories={setCallPillHistories}
            userEmail={userEmail}
            currentUserId={currentUserId}
            userTimezone={userTimezone}
            isFirstView={isFirstView}
            preHireChat={preHireChat}
            onFirstViewCompleted={onFirstViewCompleted}
            spendingGate={spendingGate}
            chatStreamConnectionStatus={chatStreamConnectionStatus}
            reconnectChatStream={reconnectChatStream}
            chatStreamActivitySignal={chatStreamActivitySignal}
            onStartCall={onStartCall}
            activeCallAssistantId={activeCallAssistantId}
            isCallConnected={isCallConnected}
            isConnectingCall={isConnectingCall}
            isSpendingBlocked={isSpendingBlocked}
            spendingBlockedMessage={spendingGate.blockedMessage}
            onEditProfile={onEditAssistant}
            onOpenContactManager={onOpenContactManager}
            canWrite={canWrite}
            hasUserMessage={hasUserMessage}
            hasHistoricalCall={hasHistoricalCall}
            hasUserPhoneNumber={hasUserPhoneNumber}
            latestUserMessageAt={latestUserMessageAt}
            userPhoneNumber={userPhoneNumber}
            onOpenUserSettings={onOpenUserSettings}
            hasIncompleteOnboarding={hasIncompleteOnboarding}
            coordinatorOnboarding={coordinatorOnboarding}
            // The docked call lives in a single slot — the primary
            // one — so split layouts do not mirror the same call UI
            // into both panes. The secondary slot always renders the
            // regular chat panel.
            renderDockedCall={slot === 'primary' ? renderDockedCall : undefined}
          />
        </TabsContent>

        <TabsContent value="tasks" className={TAB_CONTENT_CLASS} forceMount>
          <TasksPane
            assistant={assistant}
            ownerId={assistant.userId}
            assistantId={assistant.agentId}
            subTab={subTabBySlot[slot].tasks}
            onSubTabChange={slot === 'primary' ? primaryTasksChange : secondaryTasksChange}
          />
        </TabsContent>

        <TabsContent value="dashboards" className={TAB_CONTENT_CLASS} forceMount>
          {dashboardActions ? (
            <DashboardsPane
              assistant={assistant}
              ownerId={assistant.userId}
              assistantId={assistant.agentId}
              getMetadata={dashboardActions.getMetadata}
              getTileContent={dashboardActions.getTileContent}
              shouldPoll={hasActiveAction}
            />
          ) : (
            <div className="flex h-full items-center justify-center">
              <p className="text-body-muted">Select an assistant to view dashboards.</p>
            </div>
          )}
        </TabsContent>

        <TabsContent value="memory" className={TAB_CONTENT_CLASS} forceMount>
          <MemoryPane
            assistant={assistant}
            ownerId={assistant.userId}
            assistantId={assistant.agentId}
            isVisible={tab === 'memory'}
            subTab={subTabBySlot[slot].memory}
            onSubTabChange={slot === 'primary' ? primaryMemoryChange : secondaryMemoryChange}
          />
        </TabsContent>

        <TabsContent value="integrations" className={TAB_CONTENT_CLASS} forceMount>
          <IntegrationsPane
            ownerId={assistant.userId}
            assistantId={assistant.agentId}
            secretActions={assistantActions.secret}
            canWrite={canWrite}
            isVisible={tab === 'integrations'}
          />
        </TabsContent>

        <TabsContent value="actions" className={TAB_CONTENT_CLASS} forceMount>
          {/* Only the *primary* actions tab feeds the dashboards-poll
              signal. Wiring both would double-count benign no-ops, and
              the two slots' streams are equivalent (same controller
              shape, same data) so picking one is enough. */}
          <LiveActionsViewer
            assistant={assistant}
            actions={actions}
            className="h-full"
            onHasActiveActionChange={slot === 'primary' ? handleActiveActionChange : undefined}
          />
        </TabsContent>
      </Tabs>
    );
  };

  const hasSplit = paneState.secondary !== null;
  const splitRatio = Math.min(SPLIT_MAX_RATIO, Math.max(SPLIT_MIN_RATIO, paneState.splitRatio));

  return (
    <div ref={splitContainerRef} className="brand-chat-stencil-bg flex h-full w-full bg-background">
      <div
        className="flex h-full min-w-0 flex-col"
        style={{ width: hasSplit ? `${splitRatio * 100}%` : '100%' }}
      >
        {renderPane('primary', paneState.primary.tab, {
          // Split button only appears when not already split.
          canSplit: !hasSplit,
          // Either pane is closable when split — closing the primary
          // promotes the secondary into the primary slot (handled in
          // `handleClose`).
          canClose: hasSplit,
        })}
      </div>

      {hasSplit && paneState.secondary && (
        <>
          {/* Splitter handle — 6px wide hit area with a 1px visible
              line drawn dead-center via a `before:` pseudo-element.
              This keeps the divider visually balanced between the two
              panes (instead of hugging the left edge as a `border-l`
              would) and decouples the line's color from the wider
              hover/active accent that paints the whole strip. */}
          <div
            role="separator"
            aria-orientation="vertical"
            aria-label="Resize split"
            onMouseDown={handleSplitResizeStart}
            className={cn(
              'relative h-full w-1.5 flex-shrink-0 cursor-col-resize bg-transparent transition-colors duration-200',
              'before:absolute before:inset-y-0 before:left-1/2 before:w-px before:-translate-x-1/2 before:bg-border before:content-[""]',
              'hover:bg-primary/20 active:bg-primary/40',
              isResizingSplit && 'bg-primary/40'
            )}
            data-testid="right-pane-splitter"
            style={{ zIndex: 20 }}
          />
          <div
            className="flex h-full min-w-0 flex-col"
            style={{ width: `${(1 - splitRatio) * 100}%` }}
          >
            {renderPane('secondary', paneState.secondary.tab, {
              canSplit: false,
              canClose: true,
            })}
          </div>
        </>
      )}
    </div>
  );
}
