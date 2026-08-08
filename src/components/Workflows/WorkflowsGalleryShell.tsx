'use client';

import * as React from 'react';
import { AlertTriangle } from 'lucide-react';
import { Badge } from '@/components/UI/badge';
import { Button } from '@/components/UI/button';
import { ScrollArea } from '@/components/UI/scroll-area';
import { TabToolbar } from '@/components/Pages/Assistants/Common/TabToolbar';
import { TabSegment, TabSegmentGroup } from '@/components/Pages/Assistants/Common/TabSegmentGroup';
import { tabSearchPlaceholder } from '@/constants/assistants/tabSearchPlaceholders';
import { useTabSearchCommit } from '@/hooks/Assistants/useTabSearchCommit';
import { WorkflowCard } from './WorkflowCard';
import { WorkflowGallerySkeleton, WorkflowInstalledSkeleton } from './WorkflowCardSkeleton';
import { InstalledWorkflowRow } from './InstalledWorkflowRow';
import { WORKFLOW_CATEGORIES } from './workflowCategories';
import type { WorkflowRequestState } from '@/hooks/Workflows/useWorkflowCatalog';
import type {
  WorkflowCategory,
  WorkflowGalleryItem,
  WorkflowInstallStatus,
} from '@/types/workflows';

/**
 * The Workflows destination — peer to Integrations in the rail.
 *
 * Two zones as two segments, not one grid with a filter: Installed and Browse
 * answer different questions and need different row shapes. Installed is the
 * default landing segment because a user returns to it far more often than
 * they browse; it falls back to Browse only when nothing is installed.
 *
 * Attention order in Installed: partial → pending_requirements → provisioning → active.
 */
const ATTENTION_ORDER: WorkflowInstallStatus[] = [
  'partial',
  'pending_requirements',
  'provisioning',
  'active',
  'uninstalling',
];

export function WorkflowsGalleryShell({
  items,
  isLoading,
  isRefreshing,
  canMutate = true,
  onRefresh,
  renderDetailSheet,
  onOpen,
  onInstall,
  onConnect,
  onConnectWorkspace,
  onToggleSetup,
  onRetry,
  requests,
}: {
  items: WorkflowGalleryItem[];
  isLoading?: boolean;
  isRefreshing?: boolean;
  /** False when steering a setup or retrying would only change local state. */
  canMutate?: boolean;
  onRefresh?: () => void;
  /** The parent owns the sheet + uninstall dialog; the shell just renders them. */
  renderDetailSheet?: () => React.ReactNode;
  onOpen: (item: WorkflowGalleryItem) => void;
  onInstall: (item: WorkflowGalleryItem) => void;
  onConnect: (canonicalSlug: string) => void;
  onConnectWorkspace?: () => void;
  onToggleSetup: (slug: string) => void;
  onRetry: (slug: string) => void;
  /** Recorded changes in flight, keyed by slug. */
  requests?: Record<string, WorkflowRequestState>;
}) {
  const installed = React.useMemo(
    () =>
      items
        .filter((item) => item.installation)
        .sort(
          (a, b) =>
            ATTENTION_ORDER.indexOf(a.installation!.status) -
            ATTENTION_ORDER.indexOf(b.installation!.status)
        ),
    [items]
  );

  const [tab, setTab] = React.useState<'installed' | 'browse'>('browse');
  const tabTouched = React.useRef(false);
  const [category, setCategory] = React.useState<WorkflowCategory | 'all'>('all');
  const { draft, setDraft, committed, submit, clear } = useTabSearchCommit();

  // The catalog loads after mount; land on Installed once installs arrive,
  // unless the user has already picked a segment.
  React.useEffect(() => {
    if (!tabTouched.current && installed.length > 0) setTab('installed');
  }, [installed.length]);

  const selectTab = (next: 'installed' | 'browse') => {
    tabTouched.current = true;
    setTab(next);
  };

  const matches = React.useCallback(
    (item: WorkflowGalleryItem) =>
      `${item.workflow.name} ${item.workflow.description} ${item.workflow.requirements
        .map((requirement) => requirement.displayName)
        .join(' ')}`
        .toLowerCase()
        .includes(committed.toLowerCase()),
    [committed]
  );

  const browse = items.filter(
    (item) => (category === 'all' || item.workflow.category === category) && matches(item)
  );
  const filteredInstalled = installed.filter(matches);
  const attentionCount = installed.filter(
    (item) =>
      item.installation?.status === 'pending_requirements' ||
      item.installation?.status === 'partial'
  ).length;
  const isInitialLoading = Boolean(isLoading && items.length === 0);

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col" data-testid="workflow-gallery">
      <TabToolbar
        testId="workflow-gallery-toolbar"
        leading={
          <div className="flex flex-wrap items-center gap-2">
            <TabSegmentGroup testId="workflow-tab-filter">
              <TabSegment
                label="Installed"
                count={installed.length}
                active={tab === 'installed'}
                onClick={() => selectTab('installed')}
                testId="workflow-tab-installed"
              />
              <TabSegment
                label="Browse"
                count={items.length}
                active={tab === 'browse'}
                onClick={() => selectTab('browse')}
                testId="workflow-tab-browse"
              />
            </TabSegmentGroup>
            {tab === 'browse' && (
              <TabSegmentGroup testId="workflow-category-filter">
                <TabSegment
                  label="All"
                  active={category === 'all'}
                  onClick={() => setCategory('all')}
                  testId="workflow-category-all"
                />
                {WORKFLOW_CATEGORIES.map((entry) => (
                  <TabSegment
                    key={entry.id}
                    label={entry.label}
                    count={items.filter((item) => item.workflow.category === entry.id).length}
                    active={category === entry.id}
                    onClick={() => setCategory(entry.id)}
                    testId={`workflow-category-${entry.id}`}
                  />
                ))}
              </TabSegmentGroup>
            )}
          </div>
        }
        searchValue={draft}
        onSearchChange={setDraft}
        onSearchSubmit={submit}
        onSearchClear={clear}
        searchPlaceholder={tabSearchPlaceholder('workflows')}
        searchTestId="workflow-gallery-search"
        searchClearTestId="workflow-gallery-search-clear"
        trailing={
          attentionCount > 0 ? (
            <Badge
              variant="outline"
              className="gap-1 rounded-full border-transparent bg-[color:var(--status-warning-bg)] text-[10px] uppercase tracking-wide text-[color:var(--status-warning)]"
              data-testid="workflow-attention-count"
            >
              <AlertTriangle className="h-3 w-3" />
              {attentionCount} need attention
            </Badge>
          ) : undefined
        }
        onRefresh={onRefresh}
        isRefreshing={isRefreshing}
        refreshTitle="Refresh workflows"
        refreshTestId="workflow-gallery-refresh"
      />

      {/* Radix wraps viewport children in a display:table div, which makes a
          grid shrink-to-fit instead of filling the pane — [&>div]:!block is the
          house fix (see DocLibraryPane, TranscriptsPane, AppRail). */}
      <ScrollArea
        className="min-h-0 flex-1"
        viewportClassName="min-w-0 overflow-x-hidden [&>div]:!block"
      >
        <div className="px-3 py-3">
          {isInitialLoading ? (
            tab === 'installed' ? (
              <WorkflowInstalledSkeleton />
            ) : (
              <WorkflowGallerySkeleton />
            )
          ) : tab === 'installed' ? (
            installed.length === 0 ? (
              <EmptyCard
                title="Nothing installed yet"
                detail="Workflows give your teammate a whole job — the procedures, functions and recurring work that go with it."
                action={
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-3"
                    onClick={() => selectTab('browse')}
                    data-testid="workflow-empty-browse"
                  >
                    Browse workflows
                  </Button>
                }
              />
            ) : (
              <div className="flex flex-col gap-2.5">
                {filteredInstalled.map((item) => (
                  <InstalledWorkflowRow
                    key={item.workflow.slug}
                    item={item}
                    canMutate={canMutate}
                    onOpen={onOpen}
                    onConnect={onConnect}
                    onConnectWorkspace={onConnectWorkspace}
                    onToggleSetup={onToggleSetup}
                    onRetry={onRetry}
                    request={requests?.[item.workflow.slug]}
                  />
                ))}
              </div>
            )
          ) : browse.length === 0 ? (
            <EmptyCard
              title={committed ? `No workflows match “${committed}”` : 'No workflows here yet'}
              detail="Unify curates the catalog — tell us what you're missing and we'll look at adding it."
              action={
                committed ? (
                  <Button variant="outline" size="sm" className="mt-3" onClick={clear}>
                    Clear search
                  </Button>
                ) : undefined
              }
            />
          ) : category === 'all' ? (
            <div className="flex flex-col gap-6">
              {WORKFLOW_CATEGORIES.map((entry) => {
                const group = browse.filter((item) => item.workflow.category === entry.id);
                if (group.length === 0) return null;
                return (
                  <section key={entry.id}>
                    <div className="mb-3 flex items-center gap-2.5">
                      <span
                        className="h-2 w-2 rounded-[2px]"
                        style={{ background: entry.colorVar }}
                        aria-hidden="true"
                      />
                      <h3 className="font-display text-[13.5px] font-semibold">{entry.label}</h3>
                      <span className="text-caption font-mono">{group.length}</span>
                      <span className="h-px flex-1 bg-border" />
                    </div>
                    <WorkflowGrid
                      items={group}
                      onOpen={onOpen}
                      onInstall={onInstall}
                      onConnect={onConnect}
                      onConnectWorkspace={onConnectWorkspace}
                      requests={requests}
                    />
                  </section>
                );
              })}
            </div>
          ) : (
            <WorkflowGrid
              items={browse}
              onOpen={onOpen}
              onInstall={onInstall}
              onConnect={onConnect}
              onConnectWorkspace={onConnectWorkspace}
              requests={requests}
            />
          )}
        </div>
      </ScrollArea>

      {renderDetailSheet?.()}
    </div>
  );
}

/** Same thresholds as IntegrationGalleryVirtualGrid's columnsForWidth. */
function columnsForWidth(width: number): number {
  if (width >= 1536) return 4;
  if (width >= 1280) return 3;
  if (width >= 768) return 2;
  return 1;
}

function WorkflowGrid({
  items,
  onOpen,
  onInstall,
  onConnect,
  onConnectWorkspace,
  requests,
}: {
  items: WorkflowGalleryItem[];
  onOpen: (item: WorkflowGalleryItem) => void;
  onInstall: (item: WorkflowGalleryItem) => void;
  onConnect: (canonicalSlug: string) => void;
  onConnectWorkspace?: () => void;
  requests?: Record<string, WorkflowRequestState>;
}) {
  // Columns track the pane's own width, not the viewport's — the side panel
  // and rail change how much room the grid actually has, so Tailwind's
  // viewport breakpoints would size it against the wrong box.
  const parentRef = React.useRef<HTMLDivElement>(null);
  const [columns, setColumns] = React.useState(1);

  React.useEffect(() => {
    const element = parentRef.current;
    if (!element) return;
    const updateColumns = () => setColumns(columnsForWidth(element.clientWidth || 0));
    updateColumns();
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', updateColumns);
      return () => window.removeEventListener('resize', updateColumns);
    }
    const observer = new ResizeObserver(updateColumns);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={parentRef}
      className="grid w-full gap-3"
      style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
    >
      {items.map((item) => (
        <WorkflowCard
          key={item.workflow.slug}
          item={item}
          onOpen={onOpen}
          onInstall={onInstall}
          onConnect={onConnect}
          onConnectWorkspace={onConnectWorkspace}
          request={requests?.[item.workflow.slug]}
        />
      ))}
    </div>
  );
}

function EmptyCard({
  title,
  detail,
  action,
}: {
  title: string;
  detail: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="bg-muted/20 rounded-xl border border-dashed p-6 text-center">
      <p className="text-title text-sm">{title}</p>
      <p className="text-caption mt-1">{detail}</p>
      {action}
    </div>
  );
}
