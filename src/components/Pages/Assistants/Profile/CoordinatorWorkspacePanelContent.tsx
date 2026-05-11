import * as React from 'react';
import {
  CheckCircle2,
  Circle,
  CircleDashed,
  Cloud,
  ListChecks,
  MessageSquareText,
  RefreshCw,
  Search,
  UserRoundPlus,
} from 'lucide-react';
import { ScrollArea } from '@/components/UI/scroll-area';
import { Button } from '@/components/UI/button';
import { cn } from '@/lib/utils';
import type { Assistant } from '@/types/assistants/assistant';
import {
  type CoordinatorChecklistRow,
  useCoordinatorPanel,
} from '@/hooks/Assistants/useCoordinatorPanel';
import {
  type CoordinatorActivityState,
  useCoordinatorActivity,
} from '@/hooks/Assistants/useCoordinatorActivity';
import {
  type CoordinatorActivityRow,
  defaultCoordinatorActivityPromptLabel,
  isActiveCoordinatorActivity,
  latestCoordinatorActivityLifecycleRows,
} from '@/types/assistants/coordinatorActivity';
import { useAssistantPermissions } from '@/hooks/Assistants/useAssistantPermissions';
import { CoordinatorLogoAvatar } from '@/components/Pages/Assistants/CoordinatorLogoAvatar';

function promptForChecklistRow(row: CoordinatorChecklistRow): string {
  switch (row.status) {
    case 'pending':
      return `Help me with: ${row.title}`;
    case 'done':
      return `Tell me where we landed on: ${row.title}`;
    case 'skipped':
      return `Reopen this - I want to revisit ${row.title}`;
  }
}

function titleFromKind(kind: string): string {
  return kind
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function checklistGroupLabel(row: CoordinatorChecklistRow): string {
  if (row.kind?.trim()) return titleFromKind(row.kind.trim());
  if (row.status === 'done') return 'Completed';
  if (row.status === 'skipped') return 'Skipped';
  return 'Next up';
}

function groupChecklistRows(rows: CoordinatorChecklistRow[]): {
  label: string;
  rows: CoordinatorChecklistRow[];
}[] {
  const grouped = new Map<string, CoordinatorChecklistRow[]>();
  for (const row of rows) {
    const label = checklistGroupLabel(row);
    const groupRows = grouped.get(label) ?? [];
    groupRows.push(row);
    grouped.set(label, groupRows);
  }
  return Array.from(grouped, ([label, groupRows]) => ({ label, rows: groupRows }));
}

const DOT_FLICKER_TIMINGS = [
  { delay: '0ms', duration: '910ms' },
  { delay: '210ms', duration: '1260ms' },
  { delay: '90ms', duration: '1040ms' },
  { delay: '360ms', duration: '1180ms' },
  { delay: '440ms', duration: '990ms' },
  { delay: '120ms', duration: '1320ms' },
  { delay: '530ms', duration: '1080ms' },
  { delay: '270ms', duration: '950ms' },
  { delay: '160ms', duration: '1210ms' },
];

function DotFlickerLoader({ className }: { className?: string }) {
  return (
    <span
      className={cn('grid h-4 w-4 grid-cols-3 gap-0.5 text-primary', className)}
      aria-hidden="true"
      data-testid="coordinator-current-work-loader"
    >
      {DOT_FLICKER_TIMINGS.map(({ delay, duration }, index) => (
        <span
          key={`${delay}-${duration}-${index}`}
          className="h-1 w-1 animate-pulse rounded-full bg-current"
          style={{ animationDelay: delay, animationDuration: duration }}
        />
      ))}
    </span>
  );
}

function stageLabel(stage: CoordinatorActivityRow['stage']): string {
  if (stage === 'integration_setup') return 'Integration setup';
  return titleFromKind(stage);
}

function stageIcon(stage: CoordinatorActivityRow['stage']) {
  if (stage === 'discovery' || stage === 'requirements') {
    return <Search className="h-3.5 w-3.5" aria-hidden="true" />;
  }
  if (stage === 'proposal' || stage === 'handoff') {
    return <UserRoundPlus className="h-3.5 w-3.5" aria-hidden="true" />;
  }
  if (stage === 'integration_setup') {
    return <Cloud className="h-3.5 w-3.5" aria-hidden="true" />;
  }
  return <ListChecks className="h-3.5 w-3.5" aria-hidden="true" />;
}

function CurrentWorkCard({
  activity,
  fallback,
  onSeedChatDraft,
}: {
  activity: CoordinatorActivityRow | null;
  fallback: CoordinatorChecklistRow | null;
  onSeedChatDraft: (text: string) => void;
}) {
  if (activity) {
    const prompt = activity.chatPrompt?.trim();
    return (
      <section className="space-y-2" aria-label="Current Coordinator setup work">
        <h3 className="text-label text-semibold">Currently working on</h3>
        <div
          className={cn(
            'relative overflow-hidden rounded-xl border p-3 shadow-sm',
            activity.phase === 'needs_input' || activity.phase === 'blocked'
              ? 'border-amber-500/30 bg-amber-500/10'
              : 'border-primary/25 bg-primary/5'
          )}
          data-testid="coordinator-current-work-card"
        >
          {(activity.phase === 'started' || activity.phase === 'progress') && (
            <DotFlickerLoader className="absolute right-3 top-3 opacity-80" />
          )}
          <div className="flex items-start gap-3">
            <span className="bg-background/80 mt-0.5 flex h-7 w-7 items-center justify-center rounded-md text-primary">
              {stageIcon(activity.stage)}
            </span>
            <div className="min-w-0 flex-1 pr-6">
              <div className="flex flex-wrap items-center gap-2">
                <h4 className="text-body-sm text-strong truncate">{activity.title}</h4>
                <span className="text-caption bg-background/70 rounded-full px-2 py-0.5 text-muted-foreground">
                  {stageLabel(activity.stage)}
                </span>
              </div>
              {activity.summary && (
                <p className="text-caption mt-1 line-clamp-3 text-muted-foreground">
                  {activity.summary}
                </p>
              )}
              {prompt && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="mt-3 h-7 gap-1.5"
                  onClick={() => onSeedChatDraft(prompt)}
                  data-testid="coordinator-activity-chat-prompt"
                >
                  <MessageSquareText className="h-3.5 w-3.5" />
                  {activity.chatPromptLabel ||
                    defaultCoordinatorActivityPromptLabel(activity.phase)}
                </Button>
              )}
            </div>
          </div>
        </div>
      </section>
    );
  }

  if (fallback) {
    return (
      <section className="space-y-2" aria-label="Current Coordinator setup work">
        <h3 className="text-label text-semibold">Next step</h3>
        <div className="bg-primary/5 rounded-xl border p-3" data-testid="coordinator-now-checklist">
          <p className="text-caption text-muted-foreground">Next checklist item</p>
          <p className="text-body-sm text-strong mt-1">{fallback.title}</p>
          {fallback.description && (
            <p className="text-caption mt-1 text-muted-foreground">{fallback.description}</p>
          )}
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-3 h-7"
            onClick={() => onSeedChatDraft(promptForChecklistRow(fallback))}
          >
            Work on this
          </Button>
        </div>
      </section>
    );
  }

  return <EmptyNowCard />;
}

function ChecklistStatusIcon({ status }: { status: CoordinatorChecklistRow['status'] }) {
  if (status === 'done') {
    return <CheckCircle2 className="h-4 w-4 text-green-600" aria-hidden="true" />;
  }
  if (status === 'skipped') {
    return <CircleDashed className="h-4 w-4 text-muted-foreground" aria-hidden="true" />;
  }
  return <Circle className="h-4 w-4 text-primary" aria-hidden="true" />;
}

function ChecklistRow({
  row,
  onSeedChatDraft,
}: {
  row: CoordinatorChecklistRow;
  onSeedChatDraft: (text: string) => void;
}) {
  return (
    <li className="relative pl-7" data-testid="coordinator-checklist-row">
      <span className="absolute bottom-0 left-[7px] top-5 w-px bg-border" aria-hidden="true" />
      <div className="bg-background/70 rounded-lg border p-3">
        <span className="absolute left-0 top-3 flex h-4 w-4 items-center justify-center rounded-full bg-background">
          <ChecklistStatusIcon status={row.status} />
        </span>
        <div className="min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="text-body-sm text-strong">{row.title}</div>
              <p className="text-caption mt-0.5 text-muted-foreground">
                {row.status === 'done'
                  ? 'Complete'
                  : row.status === 'skipped'
                    ? 'Deferred'
                    : 'Ready when you are'}
              </p>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-7 w-7 shrink-0"
              onClick={() => onSeedChatDraft(promptForChecklistRow(row))}
              data-testid="coordinator-checklist-chat-prompt"
              aria-label={
                row.status === 'pending'
                  ? `Work on ${row.title}`
                  : row.status === 'done'
                    ? `Review ${row.title}`
                    : `Revisit ${row.title}`
              }
            >
              <MessageSquareText className="h-3.5 w-3.5" />
            </Button>
          </div>
          {row.description && (
            <p className="text-caption mt-1 text-muted-foreground">{row.description}</p>
          )}
        </div>
      </div>
    </li>
  );
}

function EmptyNowCard() {
  return (
    <div
      className="bg-muted/20 rounded-lg border border-dashed p-3"
      data-testid="coordinator-now-empty"
    >
      <p className="text-body-sm text-strong">Chat is the setup workspace.</p>
      <p className="text-caption mt-1 text-muted-foreground">
        Ask the Coordinator what to set up next, or review the checklist as it takes shape.
      </p>
    </div>
  );
}

function RefreshWorkspaceButton({
  isLoading,
  onRefresh,
}: {
  isLoading: boolean;
  onRefresh: () => void;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className="h-7 w-7 shrink-0"
      onClick={onRefresh}
      disabled={isLoading}
      aria-label="Refresh Coordinator workspace"
      data-testid="coordinator-workspace-refresh"
    >
      <RefreshCw className={cn('h-3.5 w-3.5', isLoading && 'animate-spin')} />
    </Button>
  );
}

export function CoordinatorWorkspacePanelContent({
  assistant,
  className,
  onSeedChatDraft,
  onCoordinatorActivity,
  coordinatorActivity,
  withScrollArea = true,
  showHeader = true,
}: {
  assistant: Assistant;
  className?: string;
  onSeedChatDraft: (text: string) => void;
  onCoordinatorActivity?: (activity: CoordinatorActivityRow) => void;
  coordinatorActivity?: CoordinatorActivityState;
  withScrollArea?: boolean;
  showHeader?: boolean;
}): JSX.Element {
  const { canOpenAssistantChat } = useAssistantPermissions();
  const canReadCoordinatorPanel = canOpenAssistantChat(assistant);
  const { state, checklist, isLoading, error, refetch } = useCoordinatorPanel({
    assistant,
    enabled: canReadCoordinatorPanel,
  });
  const refreshTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const schedulePanelRefresh = React.useCallback(() => {
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    refreshTimerRef.current = setTimeout(() => {
      refreshTimerRef.current = null;
      void refetch();
    }, 500);
  }, [refetch]);
  const handleActivity = React.useCallback(
    (activity: CoordinatorActivityRow) => {
      schedulePanelRefresh();
      onCoordinatorActivity?.(activity);
    },
    [onCoordinatorActivity, schedulePanelRefresh]
  );
  const localCoordinatorActivity = useCoordinatorActivity({
    assistant,
    enabled: canReadCoordinatorPanel && coordinatorActivity == null,
    onActivity: handleActivity,
  });
  const activityState = coordinatorActivity ?? localCoordinatorActivity;
  const lastActivitySignalRef = React.useRef(activityState.activitySignal);

  React.useEffect(
    () => () => {
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    },
    [assistant.agentId, refetch]
  );

  React.useEffect(() => {
    if (coordinatorActivity == null) return;
    if (activityState.activitySignal === lastActivitySignalRef.current) return;
    lastActivitySignalRef.current = activityState.activitySignal;
    if (activityState.activitySignal > 0) schedulePanelRefresh();
  }, [activityState.activitySignal, coordinatorActivity, schedulePanelRefresh]);

  React.useEffect(() => {
    lastActivitySignalRef.current = activityState.activitySignal;
  }, [assistant.agentId, activityState.activitySignal]);

  const lifecycleActivities = React.useMemo(
    () => latestCoordinatorActivityLifecycleRows(activityState.activities),
    [activityState.activities]
  );

  const nowActivity = React.useMemo(
    () => lifecycleActivities.find(isActiveCoordinatorActivity) ?? null,
    [lifecycleActivities]
  );
  const firstPendingChecklistRow = React.useMemo(
    () => checklist.find((row) => row.status === 'pending') ?? null,
    [checklist]
  );
  const checklistGroups = React.useMemo(() => groupChecklistRows(checklist), [checklist]);
  const isWorkspaceLoading = isLoading || activityState.isLoading;
  const workspaceError = error || activityState.error;
  const refreshActivity = activityState.refetch;
  const refreshWorkspace = React.useCallback(
    () => void Promise.all([refetch(), refreshActivity()]),
    [refetch, refreshActivity]
  );
  const content = (
    <div
      className={cn(
        'flex flex-col gap-4',
        withScrollArea && 'px-4 py-4',
        !withScrollArea && className
      )}
      data-testid="coordinator-workspace-panel"
    >
      {showHeader && (
        <header className="space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-title truncate">Team Setup</h2>
              <p className="text-caption mt-1 text-muted-foreground">
                Your Coordinator is shaping the team, tools, and first handoffs.
              </p>
            </div>
            <RefreshWorkspaceButton isLoading={isWorkspaceLoading} onRefresh={refreshWorkspace} />
          </div>

          <div className="bg-muted/20 flex items-center gap-2 rounded-full border px-2.5 py-2">
            <CoordinatorLogoAvatar
              className="h-6 w-6 shrink-0 rounded-full border-0 bg-transparent shadow-none"
              logoClassName="h-4 w-4"
            />
            <div className="min-w-0 flex-1">
              <div className="text-label truncate" data-testid="coordinator-workspace-name">
                Coordinator
              </div>
            </div>
          </div>
        </header>
      )}

      {workspaceError && (
        <div className="text-caption text-error border-destructive/30 bg-destructive/10 rounded-md border p-2">
          {workspaceError}
        </div>
      )}

      <CurrentWorkCard
        activity={nowActivity}
        fallback={firstPendingChecklistRow}
        onSeedChatDraft={onSeedChatDraft}
      />

      <section className="space-y-3" aria-label="Coordinator setup checklist">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h3 className="text-label text-semibold">Setup plan</h3>
            {isWorkspaceLoading && (
              <p className="text-caption mt-0.5 text-muted-foreground">Refreshing...</p>
            )}
          </div>
          {!showHeader && (
            <RefreshWorkspaceButton isLoading={isWorkspaceLoading} onRefresh={refreshWorkspace} />
          )}
        </div>
        {checklistGroups.length > 0 ? (
          checklistGroups.map((group) => (
            <div key={group.label} className="space-y-2">
              <h4 className="text-caption text-semibold uppercase tracking-wide text-muted-foreground">
                {group.label}
              </h4>
              <ul className="space-y-2">
                {group.rows.map((row) => (
                  <ChecklistRow key={row.itemId} row={row} onSeedChatDraft={onSeedChatDraft} />
                ))}
              </ul>
            </div>
          ))
        ) : (
          <p className="text-caption rounded-lg border border-dashed p-3 text-muted-foreground">
            The setup checklist will appear here as the Coordinator learns what your team needs.
          </p>
        )}
        {state?.mode === 'ready_to_go' && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 w-full"
            onClick={() => onSeedChatDraft("Let's review where we landed with the team setup.")}
            data-testid="coordinator-review-setup"
          >
            Review setup
          </Button>
        )}
      </section>
    </div>
  );

  if (!withScrollArea) return content;

  return <ScrollArea className={cn('flex-1', className)}>{content}</ScrollArea>;
}
