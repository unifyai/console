import * as React from 'react';
import { TableVirtuoso, TableVirtuosoHandle, TableComponents } from 'react-virtuoso';
import { Table, TableCell, TableHead, TableRow } from '@/components/UI/table';
import { Button } from '@/components/UI/button';
import { Badge } from '@/components/UI/badge';
import { OneTimeLinkEntry } from '@/types/admin';
import {
  Trash2,
  Loader2,
  CheckCircle,
  HelpCircle,
  Copy,
  Check,
  CircleOff,
  ChevronDown,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDistanceToNowStrict } from 'date-fns';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/UI/alert-dialog';
import { showErrorToast, showSuccessToast } from '@/components/Common/Toasts/notifications';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/UI/tooltip';

interface OneTimeLinkTableProps {
  links: OneTimeLinkEntry[];
  onDeleteLink: (linkId: string) => Promise<boolean>;
  isLoading: boolean;
  isLoadingMore: boolean;
  hasMore: boolean;
  loadMoreLinks: () => void;
  onRefreshLinks: () => void;
}

const SkeletonRow = () => (
  <TableRow>
    <TableCell>
      <div className="h-4 w-full rounded bg-muted"></div>
    </TableCell>
    <TableCell>
      <div className="h-4 w-20 rounded bg-muted"></div>
    </TableCell>
    <TableCell className="text-center">
      <div className="mx-auto h-4 w-16 rounded bg-muted"></div>
    </TableCell>
    <TableCell className="text-center">
      <div className="mx-auto h-4 w-12 rounded bg-muted"></div>
    </TableCell>
    <TableCell className="text-center">
      <div className="mx-auto h-4 w-24 rounded bg-muted"></div>
    </TableCell>
    <TableCell className="text-center">
      <div className="mx-auto h-6 w-20 rounded bg-muted"></div>
    </TableCell>
    <TableCell>
      <div className="h-4 w-3/4 rounded bg-muted"></div>
    </TableCell>
    <TableCell className="text-right">
      <div className="ml-auto h-8 w-8 rounded bg-muted"></div>
    </TableCell>
  </TableRow>
);

const LOADING_MORE_LINKS_ID = '___LOADING_MORE_LINKS___';

// This component will receive props from TableVirtuoso for its `Table` slot
const VirtuosoShadcnTable: TableComponents<OneTimeLinkEntry>['Table'] = React.forwardRef(
  ({ style, children, ...props }, ref) => {
    return (
      <Table
        ref={ref as React.Ref<HTMLTableElement>}
        style={style} // Important for Virtuoso's scrolling container
        {...props} // Pass through any other props Virtuoso might send
        className="w-full" // Your custom class
      >
        {children} {/* This will contain <thead> and <tbody> from Virtuoso */}
      </Table>
    );
  }
);
VirtuosoShadcnTable.displayName = 'VirtuosoShadcnTable';

export function OneTimeLinkTable({
  links,
  onDeleteLink,
  isLoading,
  isLoadingMore,
  hasMore,
  loadMoreLinks,
}: OneTimeLinkTableProps) {
  const [deletingLinkId, setDeletingLinkId] = React.useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = React.useState<OneTimeLinkEntry | null>(null);
  const [copiedToken, setCopiedToken] = React.useState<string | null>(null);
  const [expandedLinkId, setExpandedLinkId] = React.useState<string | null>(null);
  const virtuosoRef = React.useRef<TableVirtuosoHandle>(null);

  const handleDelete = async (linkId: string) => {
    setConfirmDelete(null);
    setDeletingLinkId(linkId);
    await onDeleteLink(linkId);
    setDeletingLinkId(null);
  };

  const handleCopyToClipboard = (token: string) => {
    if (typeof window !== 'undefined') {
      const fullUrl = `${window.location.origin}/assistants?token=${token}`;
      navigator.clipboard
        .writeText(fullUrl)
        .then(() => {
          setCopiedToken(token);
          showSuccessToast('Full link copied to clipboard!');
          setTimeout(() => setCopiedToken(null), 2000);
        })
        .catch((err) => {
          showErrorToast('Failed to copy link.');
          console.error('Failed to copy: ', err);
        });
    } else {
      showErrorToast('Cannot copy link in this environment.');
    }
  };

  const formatCreditAmount = (amount?: number | null) => {
    if (amount == null) return '—';
    return `${amount.toFixed(2)} credits`;
  };

  const tableData = React.useMemo(() => {
    if (isLoadingMore) {
      return [...links, { id: LOADING_MORE_LINKS_ID } as OneTimeLinkEntry];
    }
    return links;
  }, [links, isLoadingMore]);

  const headerRow = (
    <TableRow>
      <TableHead className="w-[18%] min-w-[160px]">Token</TableHead>
      <TableHead className="w-[12%] min-w-[100px]">Name</TableHead>
      <TableHead className="w-[8%] min-w-[70px] text-center">Credits</TableHead>
      <TableHead className="w-[8%] min-w-[70px] text-center">Claims</TableHead>
      <TableHead className="w-[13%] min-w-[110px] text-center">Expires At</TableHead>
      <TableHead className="w-[10%] min-w-[80px] text-center">Status</TableHead>
      <TableHead className="w-[21%] min-w-[150px]">Claimed By</TableHead>
      <TableHead className="w-[10%] min-w-[80px] text-right">Actions</TableHead>
    </TableRow>
  );

  if (isLoading && links.length === 0 && !isLoadingMore) {
    return (
      <Table className="w-full">
        <thead>{headerRow}</thead>
        <tbody>
          {[...Array(5)].map((_, i) => (
            <SkeletonRow key={`link-skeleton-${i}`} />
          ))}
        </tbody>
      </Table>
    );
  }

  if (!isLoading && links.length === 0 && !isLoadingMore) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground">
        No credit grant links found.
      </div>
    );
  }

  return (
    <>
      <TableVirtuoso
        ref={virtuosoRef}
        style={{ height: '100%' }}
        data={tableData}
        endReached={() => {
          if (hasMore && !isLoadingMore && !isLoading) {
            loadMoreLinks();
          }
        }}
        overscan={20}
        components={{
          Table: VirtuosoShadcnTable,
        }}
        fixedHeaderContent={() => headerRow}
        itemContent={(_index, link) => {
          if (link.id === LOADING_MORE_LINKS_ID) {
            return (
              <TableCell colSpan={8} className="h-[57px] p-4 text-center">
                <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
              </TableCell>
            );
          }

          const isDeletingThis = deletingLinkId === link.id;
          const isExpired = new Date(link.expiresAt) < new Date();
          const isFullyRedeemed = link.maxClaims !== null && link.claimCount >= link.maxClaims;
          const hasClaims = link.claimCount > 0;
          const dimmed = isExpired && !hasClaims;

          let statusText = 'Active';
          let StatusIcon = HelpCircle;
          let statusColor =
            'border-[color:var(--status-info)]/25 bg-[color:var(--status-info-bg)] text-[color:var(--status-info)]';

          if (isFullyRedeemed) {
            statusText = link.maxClaims === 1 ? 'Claimed' : 'Exhausted';

            StatusIcon = CheckCircle;
            statusColor =
              'border-[color:var(--status-success)]/25 bg-[color:var(--status-success-bg)] text-[color:var(--status-success)]';
          } else if (isExpired) {
            statusText = 'Expired';
            StatusIcon = CircleOff;
            statusColor =
              'border-border bg-[color:var(--status-neutral-bg)] text-muted-foreground opacity-70';
          } else if (hasClaims) {
            statusText = 'Partial';
            StatusIcon = CheckCircle;
            statusColor =
              'border-[color:var(--status-warning)]/25 bg-[color:var(--status-warning-bg)] text-[color:var(--status-warning)]';
          }

          const claims = link.claims ?? [];
          const firstClaim = claims[0];

          return (
            <>
              <TableCell
                className={cn('text-caption truncate font-mono', dimmed && 'opacity-60')}
                title={link.token}
              >
                <div className="flex items-center gap-2">
                  <span className="truncate">{link.token}</span>
                  <TooltipProvider delayDuration={100}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 flex-shrink-0"
                          onClick={() => handleCopyToClipboard(link.token)}
                          disabled={isDeletingThis}
                        >
                          {copiedToken === link.token ? (
                            <Check className="h-3 w-3 text-[color:var(--status-success)]" />
                          ) : (
                            <Copy className="h-3 w-3" />
                          )}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent side="top">Copy Full Link</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
              </TableCell>
              <TableCell
                className={cn('text-label truncate', dimmed && 'opacity-60')}
                title={link.name || ''}
              >
                {link.name ? (
                  <span className="truncate">{link.name}</span>
                ) : (
                  <span className="italic text-muted-foreground">—</span>
                )}
              </TableCell>
              <TableCell className={cn('text-label text-center font-mono', dimmed && 'opacity-60')}>
                {formatCreditAmount(link.creditAmount)}
              </TableCell>
              <TableCell className={cn('text-label text-center font-mono', dimmed && 'opacity-60')}>
                {link.claimCount}/{link.maxClaims ?? '∞'}
              </TableCell>
              <TableCell className={cn('text-label text-center', dimmed && 'opacity-60')}>
                {formatDistanceToNowStrict(new Date(link.expiresAt), { addSuffix: true })}
              </TableCell>
              <TableCell className={cn('text-center', dimmed && 'opacity-60')}>
                <Badge
                  variant="outline"
                  className={cn('text-label whitespace-nowrap px-2 py-0.5 capitalize', statusColor)}
                >
                  <StatusIcon className="mr-1.5 h-3 w-3" />
                  {statusText}
                </Badge>
              </TableCell>
              <TableCell className={cn('text-label', dimmed && 'opacity-60')}>
                {claims.length === 0 ? (
                  <span className="italic text-muted-foreground">N/A</span>
                ) : claims.length === 1 ? (
                  <div className="flex flex-col gap-0.5">
                    <span className="truncate">
                      {firstClaim!.claimedByEmail || (
                        <span className="text-muted-foreground/70 italic">
                          {firstClaim!.userId} (ID)
                        </span>
                      )}
                    </span>
                    {firstClaim!.claimedForOrg && (
                      <span className="text-[11px] text-muted-foreground">
                        &rarr; {firstClaim!.claimedForOrg}
                      </span>
                    )}
                  </div>
                ) : (
                  <div className="flex flex-col gap-0.5">
                    <button
                      className="flex items-center gap-1 text-left text-xs hover:underline"
                      onClick={() => setExpandedLinkId(expandedLinkId === link.id ? null : link.id)}
                    >
                      <ChevronDown
                        className={cn(
                          'h-3 w-3 transition-transform',
                          expandedLinkId === link.id && 'rotate-180'
                        )}
                      />
                      {claims.length} claimers
                    </button>
                    {expandedLinkId === link.id && (
                      <div className="mt-1 flex flex-col gap-1 border-l-2 border-muted pl-2">
                        {claims.map((c, i) => (
                          <div key={i} className="text-[11px]">
                            <span className="truncate">
                              {c.claimedByEmail || (
                                <span className="text-muted-foreground/70 italic">{c.userId}</span>
                              )}
                            </span>
                            {c.claimedForOrg && (
                              <span className="ml-1 text-muted-foreground">
                                &rarr; {c.claimedForOrg}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </TableCell>
              <TableCell className={cn('text-right', dimmed && 'opacity-60')}>
                {isDeletingThis ? (
                  <Loader2 className="mx-auto h-5 w-5 animate-spin text-muted-foreground" />
                ) : (
                  <TooltipProvider delayDuration={150}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="hover:bg-destructive/10 h-8 w-8 p-0 text-destructive"
                          onClick={() => setConfirmDelete(link)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent side="left">Delete Link</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
              </TableCell>
            </>
          );
        }}
      />
      {confirmDelete && (
        <AlertDialog
          open={!!confirmDelete}
          onOpenChange={(isOpen) => !isOpen && setConfirmDelete(null)}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirm Delete Link</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete this credit grant link?
                <br />
                <span className="text-code-sm mt-1 inline-block rounded bg-muted p-1">
                  {confirmDelete.token}
                </span>
                <br />
                This action cannot be undone. If the link was active and unclaimed, it will no
                longer work.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setConfirmDelete(null)}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => handleDelete(confirmDelete.id)}
                className="hover:bg-destructive/90 bg-destructive"
              >
                Confirm Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </>
  );
}
