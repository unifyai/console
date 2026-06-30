import * as React from 'react';
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronRight,
  Folder,
  MoreVertical,
  Pencil,
  Trash2,
} from 'lucide-react';
import { Button } from '@/components/UI/button';
import { Skeleton } from '@/components/UI/skeleton';
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
  TableCell,
} from '@/components/UI/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/UI/dropdown-menu';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/UI/tooltip';
import { cn } from '@/lib/utils';
import { buildNestedDropdownTree } from '@/utils/interfaces/common';
import type { TreeNode } from '@/types/common';
import type { Secret } from '@/types/assistants/secret';

type SortField = 'name' | 'description';
type SortDirection = 'asc' | 'desc';
type SortState = { field: SortField; direction: SortDirection } | null;

interface SecretsTableProps {
  secrets: Secret[];
  isLoading: boolean;
  canWrite: boolean;
  searchQuery: string;
  expandedFolders: Set<string>;
  sorting: SortState;
  onSort: (field: SortField) => void;
  onToggleFolder: (path: string) => void;
  onUpdateSecret: (secret: Secret) => void;
  onDeleteSecret: (secret: Secret) => void;
  onDeleteFolder: (path: string) => void;
}

const ROW_INDENT_PX = 16;

/* Each flattened row corresponds to one visible table row. The tree is
   flattened with a DFS so folder rows appear directly above their contents. */
type FolderRow = {
  kind: 'folder';
  path: string;
  label: string;
  depth: number;
  isExpanded: boolean;
  isChevronDisabled: boolean;
};

type SecretRow = {
  kind: 'secret';
  path: string;
  label: string;
  depth: number;
  secret: Secret;
};

type FlatRow = FolderRow | SecretRow;

function labelOf(node: TreeNode): string {
  const p = stripTrailingSlash(node.path);
  return p.split('/').filter(Boolean).pop() || p;
}

function stripTrailingSlash(path: string): string {
  return path.endsWith('/') ? path.slice(0, -1) : path;
}

/**
 * Walk the tree and emit visible rows. Server-side filtering has already
 * pruned the secret set, so when a search query is active we simply render
 * everything the server returned and force every folder to be expanded (with
 * their chevrons disabled) so matches are visible.
 *
 * Sibling order is driven by the insertion order of the tree, which itself
 * reflects the server-side sort (see `useAssistantSecrets`). We don't re-sort
 * here so the UI stays consistent with whatever order the server returns.
 */
function flattenTree(
  node: TreeNode,
  depth: number,
  secretsByName: Map<string, Secret>,
  expandedFolders: Set<string>,
  isSearching: boolean
): FlatRow[] {
  const out: FlatRow[] = [];

  for (const [, child] of Object.entries(node.children)) {
    const childPath = stripTrailingSlash(child.path);
    const childLabel = labelOf(child);
    const childSecret = secretsByName.get(childPath);
    const isFolder = Object.keys(child.children).length > 0;

    if (!isFolder && childSecret) {
      out.push({
        kind: 'secret',
        path: childPath,
        label: childLabel,
        depth,
        secret: childSecret,
      });
      continue;
    }

    if (!isFolder) {
      // Orphan node (folder path with no terminal) — should not happen with
      // the current data model, but be defensive.
      continue;
    }

    // Folder: during search every folder is auto-expanded with its chevron
    // disabled, so the user always sees all the matches the server returned.
    const isExpanded = isSearching || expandedFolders.has(childPath);

    out.push({
      kind: 'folder',
      path: childPath,
      label: childLabel,
      depth,
      isExpanded,
      isChevronDisabled: isSearching,
    });

    // Conflict case: a secret exists at this folder's own path. Render it as
    // a child row when the folder is expanded.
    if (isExpanded && childSecret) {
      out.push({
        kind: 'secret',
        path: childPath,
        label: childLabel,
        depth: depth + 1,
        secret: childSecret,
      });
    }

    if (isExpanded) {
      out.push(...flattenTree(child, depth + 1, secretsByName, expandedFolders, isSearching));
    }
  }
  return out;
}

/* -------------------------------------------------------------------------- */

/**
 * Wraps a truncated cell label with a Radix tooltip showing the full value on
 * hover. The tooltip is skipped when `content` is empty so we don't get empty
 * bubbles on rows without a description. We use a short delay so it feels
 * responsive when scanning a table but doesn't fire on incidental hovers.
 */
function CellTooltip({
  content,
  children,
  testId,
}: {
  content: string | null | undefined;
  children: React.ReactElement;
  testId?: string;
}) {
  if (!content) return children;
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent
        side="top"
        align="start"
        className="max-w-sm whitespace-pre-wrap break-all text-xs"
        data-testid={testId}
      >
        {content}
      </TooltipContent>
    </Tooltip>
  );
}

export function SecretsTable({
  secrets,
  isLoading,
  canWrite,
  searchQuery,
  expandedFolders,
  sorting,
  onSort,
  onToggleFolder,
  onUpdateSecret,
  onDeleteSecret,
  onDeleteFolder,
}: SecretsTableProps) {
  const isSearching = searchQuery.trim().length > 0;

  const secretsByName = React.useMemo(() => new Map(secrets.map((s) => [s.name, s])), [secrets]);

  const tree = React.useMemo(() => buildNestedDropdownTree(secrets.map((s) => s.name)), [secrets]);

  const rows = React.useMemo(
    () => flattenTree(tree, 0, secretsByName, expandedFolders, isSearching),
    [tree, secretsByName, expandedFolders, isSearching]
  );

  // When there are no rows to render (and we aren't loading the initial set),
  // show a single centered placeholder that fills the available area. Matches
  // the unified "No {entrytype} found" empty-state style used elsewhere in
  // the right-pane tabs (Actions, Tasks, Brain, Dashboards).
  if (!isLoading && rows.length === 0) {
    return (
      <div
        className="flex h-full items-center justify-center text-muted-foreground"
        data-testid="secrets-table-empty"
      >
        <p className="text-sm">
          {isSearching ? `No secrets match "${searchQuery}"` : 'No secrets found'}
        </p>
      </div>
    );
  }

  return (
    <TooltipProvider delayDuration={300}>
      <div className="h-full overflow-auto" data-testid="secrets-table-scroll">
        <Table>
          <TableHeader className="sticky top-0 z-10 bg-background">
            <TableRow className="hover:bg-transparent">
              <SortableHead
                label="Name"
                active={sorting?.field === 'name' ? sorting.direction : null}
                onClick={() => onSort('name')}
                testId="secrets-sort-name"
              />
              <SortableHead
                label="Description"
                active={sorting?.field === 'description' ? sorting.direction : null}
                onClick={() => onSort('description')}
                testId="secrets-sort-description"
              />
              <TableHead className="w-16 border-b px-3 py-2 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && secrets.length === 0 ? (
              <SkeletonRows />
            ) : (
              rows.map((row) => {
                if (row.kind === 'folder') {
                  return (
                    <FolderRowView
                      key={`folder:${row.path}`}
                      row={row}
                      canWrite={canWrite}
                      onToggle={() => !row.isChevronDisabled && onToggleFolder(row.path)}
                      onDelete={() => onDeleteFolder(row.path)}
                    />
                  );
                }
                return (
                  <SecretRowView
                    key={`secret:${row.path}`}
                    row={row}
                    canWrite={canWrite}
                    onUpdate={() => onUpdateSecret(row.secret)}
                    onDelete={() => onDeleteSecret(row.secret)}
                  />
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </TooltipProvider>
  );
}

/* -------------------------------------------------------------------------- */
/*  Header                                                                    */
/* -------------------------------------------------------------------------- */

function SortableHead({
  label,
  active,
  onClick,
  testId,
}: {
  label: string;
  active: SortDirection | null;
  onClick: () => void;
  testId: string;
}) {
  const Icon = active === 'asc' ? ArrowUp : active === 'desc' ? ArrowDown : ArrowUpDown;
  return (
    <TableHead
      className="hover:bg-muted/40 cursor-pointer select-none border-b px-3 py-2"
      onClick={onClick}
      data-testid={testId}
      data-sort-direction={active ?? 'none'}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        <Icon className={cn('h-3 w-3', active ? 'text-foreground' : 'text-muted-foreground')} />
      </span>
    </TableHead>
  );
}

/* -------------------------------------------------------------------------- */
/*  Row renderers                                                             */
/* -------------------------------------------------------------------------- */

// Rows nested under a folder animate in when they appear (folder expanding,
// search results changing). Top-level rows also get the animation on first
// mount, which gives the initial render a subtle fade-in. Tailwindcss-animate
// only fires on mount, so sort/filter-driven reorders don't re-trigger it.
const ROW_ANIMATION = 'animate-in fade-in-0 slide-in-from-top-1 duration-150';

function FolderRowView({
  row,
  canWrite,
  onToggle,
  onDelete,
}: {
  row: FolderRow;
  canWrite: boolean;
  onToggle: () => void;
  onDelete: () => void;
}) {
  return (
    <TableRow
      data-testid={`secrets-folder-${row.path}`}
      data-expanded={row.isExpanded}
      className={cn('hover:bg-muted', !row.isChevronDisabled && 'cursor-pointer', ROW_ANIMATION)}
      onClick={onToggle}
    >
      <TableCell
        colSpan={2}
        className="px-3 py-2 text-xs"
        style={{ paddingLeft: 12 + row.depth * ROW_INDENT_PX }}
      >
        <div className="flex items-center gap-1.5">
          <ChevronRight
            className={cn(
              'h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform duration-150',
              row.isExpanded && 'rotate-90',
              row.isChevronDisabled && 'opacity-0'
            )}
          />
          <Folder className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <span className="truncate font-medium">{row.label}</span>
        </div>
      </TableCell>
      <TableCell className="px-3 py-2 text-right">
        {canWrite && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={(e) => e.stopPropagation()}
                data-testid={`secrets-folder-menu-${row.path}`}
                aria-label={`Actions for folder ${row.label}`}
              >
                <MoreVertical className="h-3.5 w-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
              <DropdownMenuItem
                onClick={onDelete}
                className="text-destructive"
                data-testid="secrets-folder-delete"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete folder
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </TableCell>
    </TableRow>
  );
}

function SecretRowView({
  row,
  canWrite,
  onUpdate,
  onDelete,
}: {
  row: SecretRow;
  canWrite: boolean;
  onUpdate: () => void;
  onDelete: () => void;
}) {
  return (
    <TableRow
      data-testid={`secrets-row-${row.secret.name}`}
      className={cn('hover:bg-muted', ROW_ANIMATION)}
    >
      <TableCell
        className="max-w-[280px] px-3 py-2 text-xs"
        style={{ paddingLeft: 12 + (row.depth + 1) * ROW_INDENT_PX }}
      >
        <span className="block truncate">{row.label}</span>
      </TableCell>
      <TableCell className="text-caption max-w-[320px] px-3 py-2">
        {row.secret.description ? (
          <CellTooltip
            content={row.secret.description}
            testId={`secrets-row-description-tooltip-${row.secret.name}`}
          >
            <span className="block truncate">{row.secret.description}</span>
          </CellTooltip>
        ) : (
          <span className="opacity-50">—</span>
        )}
      </TableCell>
      <TableCell className="px-3 py-2 text-right">
        {canWrite && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                data-testid={`secrets-row-menu-${row.secret.name}`}
                aria-label={`Actions for secret ${row.secret.name}`}
              >
                <MoreVertical className="h-3.5 w-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onUpdate} data-testid="secrets-row-update">
                <Pencil className="mr-2 h-4 w-4" />
                Update
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={onDelete}
                className="text-destructive"
                data-testid="secrets-row-delete"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </TableCell>
    </TableRow>
  );
}

/* -------------------------------------------------------------------------- */
/*  Skeleton                                                                  */
/* -------------------------------------------------------------------------- */

// Mimic the tree's shape with indented rows of varying width so the loading
// state hints at the table structure that's about to appear.
const SKELETON_ROWS: Array<{ nameWidth: string; descWidth: string; depth: number }> = [
  { nameWidth: '35%', descWidth: '60%', depth: 0 },
  { nameWidth: '45%', descWidth: '0%', depth: 1 },
  { nameWidth: '55%', descWidth: '70%', depth: 1 },
  { nameWidth: '40%', descWidth: '0%', depth: 0 },
  { nameWidth: '60%', descWidth: '55%', depth: 1 },
  { nameWidth: '50%', descWidth: '65%', depth: 1 },
  { nameWidth: '30%', descWidth: '45%', depth: 0 },
];

function SkeletonRows() {
  return (
    <>
      {SKELETON_ROWS.map((row, i) => (
        <TableRow key={i} className="hover:bg-transparent" data-testid="secrets-skeleton-row">
          <TableCell className="px-3 py-2" style={{ paddingLeft: 12 + row.depth * ROW_INDENT_PX }}>
            <Skeleton className="h-3.5" style={{ width: row.nameWidth }} />
          </TableCell>
          <TableCell className="px-3 py-2">
            {row.descWidth !== '0%' && (
              <Skeleton className="h-3.5" style={{ width: row.descWidth }} />
            )}
          </TableCell>
          <TableCell className="px-3 py-2" />
        </TableRow>
      ))}
    </>
  );
}
