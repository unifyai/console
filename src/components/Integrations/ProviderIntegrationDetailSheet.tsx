'use client';

import * as React from 'react';
import {
  Ban,
  ChevronDown,
  ExternalLink,
  Plus,
  RotateCcw,
  Search,
  ShieldCheck,
  ShieldQuestion,
  X,
  Zap,
} from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/UI/sheet';
import { ScrollArea } from '@/components/UI/scroll-area';
import { Button } from '@/components/UI/button';
import { Badge } from '@/components/UI/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/UI/alert';
import { Input } from '@/components/UI/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/UI/dropdown-menu';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/UI/tooltip';
import { ConnectedAccountsSection } from './ConnectedAccountsSection';
import { ProviderApiKeyForm } from './ProviderApiKeyForm';
import { IntegrationStatusBadge } from './IntegrationStatusBadge';
import {
  getProviderIntegrationToolPolicy,
  patchProviderIntegrationToolPolicy,
} from '@/lib/client/integrations';
import { cn } from '@/lib/utils';
import type {
  IntegrationConnection,
  IntegrationGalleryItem,
  IntegrationToolApprovalLevel,
  IntegrationToolPreview,
} from '@/types/integrations';

function actionLabel(item: IntegrationGalleryItem): string {
  if (item.sourceMetadata?.sourceType === 'native') return 'View';
  if (item.status === 'pending') return 'Resume setup';
  if (
    item.status === 'expired' ||
    item.status === 'revoked' ||
    item.status === 'needs_reconnect' ||
    item.status === 'error' ||
    item.status === 'missing_scope' ||
    item.status === 'missing_secrets'
  ) {
    return 'Reconnect';
  }
  return 'Connect';
}

function actionBadgeLabel(actionClass?: IntegrationToolPreview['actionClass']): string | null {
  if (!actionClass || actionClass === 'read') return null;
  if (actionClass === 'sensitive_read') return 'Sensitive';
  if (actionClass === 'destructive') return 'Destructive';
  return 'Can change data';
}

function defaultApprovalLevel(tool: IntegrationToolPreview): IntegrationToolApprovalLevel {
  if (tool.approvalLevel) return tool.approvalLevel;
  if (
    tool.confirmationRequired ||
    ['write', 'destructive', 'bulk_export', 'sensitive_read'].includes(String(tool.actionClass))
  ) {
    return 'specific_approval';
  }
  return 'auto';
}

function shortApprovalLabel(level: IntegrationToolApprovalLevel): string {
  if (level === 'auto') return 'Allow';
  if (level === 'specific_approval') return 'Confirm';
  return 'Block';
}

function LoadingSkeleton() {
  return (
    <div className="space-y-4" data-testid="provider-integration-detail-loading">
      <div className="h-16 animate-pulse rounded-xl bg-muted" />
      <div className="h-28 animate-pulse rounded-xl bg-muted" />
      <div className="h-56 animate-pulse rounded-xl bg-muted" />
    </div>
  );
}

function PermissionList({
  scopes,
  selectedScopeIds,
  onToggleScope,
}: {
  scopes: IntegrationGalleryItem['scopes'];
  selectedScopeIds: Set<string>;
  onToggleScope: (scopeId: string) => void;
}) {
  if (scopes.length === 0) {
    return (
      <p className="text-body-muted bg-muted/20 rounded-lg border border-dashed p-3">
        Permissions are requested by the provider during sign-in.
      </p>
    );
  }

  return (
    <div className="space-y-2" data-testid="integration-permission-list">
      <div className="flex min-w-0 flex-wrap gap-2">
        {scopes.map((scope) => {
          const selected = selectedScopeIds.has(scope.id);
          return (
            <button
              key={scope.id}
              type="button"
              className={cn(
                'max-w-full break-all rounded-full border px-2.5 py-1 font-mono text-xs leading-4 transition',
                selected
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'bg-muted/40 hover:border-primary/50 text-muted-foreground hover:text-foreground'
              )}
              onClick={() => onToggleScope(scope.id)}
              aria-pressed={selected}
              data-testid={`integration-scope-tag-${scope.id}`}
            >
              {scope.id}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ToolMetadataTags({
  scopes,
  actionClass,
}: {
  scopes?: IntegrationToolPreview['requiredScopes'];
  actionClass?: IntegrationToolPreview['actionClass'];
}) {
  const actionLabel = actionBadgeLabel(actionClass);
  if ((!scopes || scopes.length === 0) && !actionLabel) return null;
  return (
    <div className="mt-1 flex min-w-0 gap-1.5 overflow-hidden">
      {(scopes ?? []).map((scope) => (
        <span
          key={scope.id}
          className="bg-muted/40 max-w-[180px] shrink-0 truncate rounded-full border px-2 py-0.5 font-mono text-[10px] leading-4 text-muted-foreground"
        >
          {scope.id}
        </span>
      ))}
      {actionLabel && (
        <span
          className={cn(
            'shrink-0 rounded-full border px-2 py-0.5 text-[10px] leading-4',
            actionClass === 'destructive'
              ? 'border-destructive/30 bg-destructive/10 text-destructive'
              : 'border-warning/30 bg-warning/10 text-warning'
          )}
        >
          {actionLabel}
        </span>
      )}
    </div>
  );
}

function AvailableToolsList({
  tools,
  selectedScopeIds,
  onClearScopes,
  policyByToolId,
  policyEnabled,
  savingToolIds,
  policyError,
  onPolicyChange,
  onBulkPolicyChange,
}: {
  tools: IntegrationToolPreview[];
  selectedScopeIds: string[];
  onClearScopes: () => void;
  policyByToolId: Record<string, IntegrationToolApprovalLevel>;
  policyEnabled: boolean;
  savingToolIds: Set<string>;
  policyError?: string | null;
  onPolicyChange: (tool: IntegrationToolPreview, level: IntegrationToolApprovalLevel) => void;
  onBulkPolicyChange: (
    action:
      | { type: 'reset' }
      | { type: 'bulk'; level: IntegrationToolApprovalLevel; actionClasses?: string[] }
  ) => void;
}) {
  const [query, setQuery] = React.useState('');
  const [expandedToolId, setExpandedToolId] = React.useState<string | null>(null);
  const filteredTools = React.useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return tools.filter((tool) => {
      if (
        selectedScopeIds.length > 0 &&
        !tool.requiredScopes?.some((scope) => selectedScopeIds.includes(scope.id))
      ) {
        return false;
      }
      if (!normalized) return true;
      return `${tool.displayName} ${tool.description ?? ''} ${tool.name} ${tool.providerToolId ?? ''}`
        .toLowerCase()
        .includes(normalized);
    });
  }, [query, selectedScopeIds, tools]);

  return (
    <div className="min-w-0 space-y-3" data-testid="integration-tool-preview">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-title text-base">Available tools</h3>
          <p className="text-caption">These are the tools this app can support.</p>
        </div>
        <Badge variant="outline" className="rounded-full text-muted-foreground">
          {filteredTools.length} tools
        </Badge>
      </div>
      {selectedScopeIds.length > 0 && (
        <div className="text-caption bg-muted/20 flex min-w-0 flex-wrap items-center gap-2 rounded-lg border px-3 py-2">
          <span>Showing tools requiring</span>
          {selectedScopeIds.map((scopeId) => (
            <span
              key={scopeId}
              className="max-w-full break-all rounded-full border bg-background px-2 py-0.5 font-mono"
            >
              {scopeId}
            </span>
          ))}
          <button
            type="button"
            className="text-caption inline-flex items-center gap-1 rounded-full px-2 py-0.5 hover:bg-muted hover:text-foreground"
            onClick={onClearScopes}
            data-testid="integration-tool-scope-filter-clear"
          >
            <X className="h-3 w-3" />
            Clear all
          </button>
        </div>
      )}
      <div className="flex gap-2">
        <div className="relative min-w-0 flex-1">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search tools"
            className="h-9 pl-8 text-xs placeholder:text-xs"
            data-testid="integration-tool-search"
          />
        </div>
        {policyEnabled && (
          <DropdownMenu>
            <TooltipProvider delayDuration={150}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <DropdownMenuTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      className="h-9 shrink-0 gap-1.5 rounded-md px-3 text-xs"
                      data-testid="integration-policy-actions"
                    >
                      Actions
                      <ChevronDown className="h-3.5 w-3.5" />
                    </Button>
                  </DropdownMenuTrigger>
                </TooltipTrigger>
                <TooltipContent size="sm">
                  Apply a policy preset across this app’s tools.
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <DropdownMenuContent align="end" className="w-72">
              <DropdownMenuItem
                onClick={() => onBulkPolicyChange({ type: 'reset' })}
                data-testid="integration-policy-reset"
              >
                <RotateCcw className="h-4 w-4" />
                <div>
                  <p className="text-title">Reset all to defaults</p>
                  <p className="text-caption">Use the recommended policy for every tool.</p>
                </div>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() =>
                  onBulkPolicyChange({ type: 'bulk', level: 'auto', actionClasses: ['read'] })
                }
                data-testid="integration-policy-read-auto"
              >
                <Zap className="h-4 w-4" />
                <div>
                  <p className="text-title">Allow read tools</p>
                  <p className="text-caption">Low-risk lookups can run without asking first.</p>
                </div>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() =>
                  onBulkPolicyChange({
                    type: 'bulk',
                    level: 'specific_approval',
                    actionClasses: ['write', 'destructive', 'bulk_export'],
                  })
                }
                data-testid="integration-policy-write-confirm"
              >
                <ShieldQuestion className="h-4 w-4" />
                <div>
                  <p className="text-title">Confirm write actions</p>
                  <p className="text-caption">
                    Require confirmation for tools that can change data.
                  </p>
                </div>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => onBulkPolicyChange({ type: 'bulk', level: 'forbidden' })}
                className="text-destructive focus:text-destructive"
                data-testid="integration-policy-all-off"
              >
                <Ban className="h-4 w-4" />
                <div>
                  <p className="text-title">Block all tools</p>
                  <p className="text-caption text-error">
                    Disable every tool until you turn specific ones back on.
                  </p>
                </div>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
      {policyError && (
        <p className="text-caption text-error" data-testid="integration-policy-error">
          {policyError}
        </p>
      )}
      <div className="min-w-0 rounded-xl border bg-card">
        <ol className="min-w-0 divide-y">
          {filteredTools.map((tool, index) => {
            const expanded = expandedToolId === tool.id;
            const policyLevel = policyByToolId[tool.id] ?? defaultApprovalLevel(tool);
            return (
              <li key={tool.id} data-testid={`integration-tool-row-${tool.id}`}>
                <div
                  className={cn(
                    'hover:bg-muted/40 flex w-full min-w-0 gap-3 px-4 py-3 transition',
                    expanded ? 'min-h-[72px]' : 'h-[72px]'
                  )}
                >
                  <span className="text-label-muted mt-0.5 shrink-0 tabular-nums">
                    {index + 1}.
                  </span>
                  <div className="min-w-0 flex-1 overflow-hidden">
                    <div className="flex min-w-0 items-start justify-between gap-3">
                      <button
                        type="button"
                        className="min-w-0 flex-1 text-left"
                        onClick={() => setExpandedToolId(expanded ? null : tool.id)}
                      >
                        <p className="text-title truncate">{tool.displayName}</p>
                        <ToolMetadataTags
                          scopes={tool.requiredScopes}
                          actionClass={tool.actionClass}
                        />
                      </button>
                      <div className="flex shrink-0 items-center gap-2">
                        {policyEnabled && (
                          <div
                            className="inline-flex rounded-full border bg-background p-0.5"
                            data-testid={`integration-tool-policy-${tool.id}`}
                          >
                            {(
                              [
                                'auto',
                                'specific_approval',
                                'forbidden',
                              ] as IntegrationToolApprovalLevel[]
                            ).map((level) => (
                              <TooltipProvider key={level} delayDuration={150}>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <button
                                      type="button"
                                      disabled={savingToolIds.has(tool.id)}
                                      className={cn(
                                        'h-7 rounded-full px-2.5 text-xs transition',
                                        policyLevel === level
                                          ? level === 'forbidden'
                                            ? 'bg-destructive text-destructive-foreground'
                                            : 'bg-primary text-primary-foreground'
                                          : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                                      )}
                                      onClick={() => onPolicyChange(tool, level)}
                                    >
                                      {shortApprovalLabel(level)}
                                    </button>
                                  </TooltipTrigger>
                                  <TooltipContent size="sm">
                                    {level === 'auto'
                                      ? 'Run this tool without asking first.'
                                      : level === 'specific_approval'
                                        ? 'Require confirmation before this tool runs.'
                                        : 'Block this tool for this connection.'}
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            ))}
                          </div>
                        )}
                        <button
                          type="button"
                          className="rounded-full p-1 hover:bg-muted"
                          onClick={() => setExpandedToolId(expanded ? null : tool.id)}
                          aria-label={
                            expanded ? 'Collapse tool description' : 'Expand tool description'
                          }
                        >
                          <ChevronDown
                            className={cn(
                              'h-4 w-4 text-muted-foreground transition',
                              expanded && 'rotate-180'
                            )}
                          />
                        </button>
                      </div>
                    </div>
                    {expanded && (
                      <div className="text-caption mt-3">
                        {tool.description && (
                          <p className="whitespace-normal break-words">{tool.description}</p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
        {filteredTools.length === 0 && (
          <p className="text-body-muted p-4">No tools match the current filters.</p>
        )}
      </div>
    </div>
  );
}

export function ProviderIntegrationDetailSheet({
  item,
  open,
  busy,
  busyConnectionId,
  onOpenChange,
  onPrimaryAction,
  onApiKeySubmit,
  onReconnectConnection,
  onDisconnectConnection,
  onCancelConnection,
  onTestConnection,
  onUpdateConnectionLabel,
  isDetailLoading,
}: {
  item: IntegrationGalleryItem | null;
  open: boolean;
  busy?: boolean;
  busyConnectionId?: string | null;
  onOpenChange: (open: boolean) => void;
  onPrimaryAction: (item: IntegrationGalleryItem, options?: { accountLabel?: string }) => void;
  onApiKeySubmit?: (
    item: IntegrationGalleryItem,
    values: Record<string, string>,
    options?: { accountLabel?: string }
  ) => void;
  onReconnectConnection?: (connection: IntegrationConnection) => void;
  onDisconnectConnection?: (connection: IntegrationConnection) => void;
  onCancelConnection?: (connection: IntegrationConnection) => void;
  onTestConnection?: (connection: IntegrationConnection) => void;
  onUpdateConnectionLabel?: (
    connection: IntegrationConnection,
    accountLabel: string
  ) => Promise<void> | void;
  isDetailLoading?: boolean;
}) {
  const snapshot = React.useRef<IntegrationGalleryItem | null>(null);
  const [selectedScopeIds, setSelectedScopeIds] = React.useState<string[]>([]);
  React.useEffect(() => {
    if (item) snapshot.current = item;
  }, [item]);
  const displayItem = item ?? snapshot.current;
  React.useEffect(() => {
    setSelectedScopeIds([]);
  }, [displayItem?.canonicalSlug, open]);
  const selectedScopeSet = React.useMemo(() => new Set(selectedScopeIds), [selectedScopeIds]);
  const handleToggleScope = React.useCallback((scopeId: string) => {
    setSelectedScopeIds((current) =>
      current.includes(scopeId)
        ? current.filter((selectedScopeId) => selectedScopeId !== scopeId)
        : [...current, scopeId]
    );
  }, []);
  const isConnectedApp =
    displayItem?.status === 'connected' || displayItem?.status === 'configured';
  const isNativeApp = displayItem?.sourceMetadata?.sourceType === 'native';
  const visibleConnectionCount = React.useMemo(
    () =>
      (displayItem?.connections ?? []).filter((connection) => connection.status !== 'disconnected')
        .length,
    [displayItem?.connections]
  );
  const failedConnections = React.useMemo(
    () =>
      (displayItem?.connections ?? []).filter((connection) =>
        ['error', 'expired', 'revoked', 'needs_reconnect'].includes(connection.status)
      ),
    [displayItem?.connections]
  );
  const policyConnection = React.useMemo(
    () =>
      (displayItem?.connections ?? []).find((connection) =>
        ['connected', 'configured'].includes(connection.status)
      ) ?? null,
    [displayItem?.connections]
  );
  const [policyByToolId, setPolicyByToolId] = React.useState<
    Record<string, IntegrationToolApprovalLevel>
  >({});
  const [savingToolIds, setSavingToolIds] = React.useState<Set<string>>(new Set());
  const [policyError, setPolicyError] = React.useState<string | null>(null);
  const policySummary = React.useMemo(() => {
    const values = Object.values(policyByToolId);
    return {
      automatic: values.filter((value) => value === 'auto').length,
      confirmation: values.filter((value) => value === 'specific_approval').length,
      off: values.filter((value) => value === 'forbidden').length,
    };
  }, [policyByToolId]);
  React.useEffect(() => {
    const connectionId = policyConnection?.id;
    if (!connectionId) {
      setPolicyByToolId({});
      return;
    }
    let cancelled = false;
    setPolicyError(null);
    void getProviderIntegrationToolPolicy(connectionId)
      .then((response) => {
        if (cancelled) return;
        setPolicyByToolId(
          Object.fromEntries(
            response.policies.map((policy) => [policy.toolId, policy.approvalLevel])
          )
        );
      })
      .catch(() => {
        if (!cancelled) {
          setPolicyError('Could not load tool policy. Please refresh or try again.');
        }
      });
    return () => {
      cancelled = true;
    };
  }, [policyConnection?.id]);
  const handlePolicyChange = React.useCallback(
    (tool: IntegrationToolPreview, level: IntegrationToolApprovalLevel) => {
      const connectionId = policyConnection?.id;
      if (!connectionId) return;
      const previous = policyByToolId;
      setPolicyError(null);
      setPolicyByToolId((current) => ({ ...current, [tool.id]: level }));
      setSavingToolIds((current) => new Set(current).add(tool.id));
      void patchProviderIntegrationToolPolicy(connectionId, {
        toolPolicies: { [tool.id]: level },
      })
        .then((response) => {
          setPolicyByToolId(
            Object.fromEntries(
              response.policies.map((policy) => [policy.toolId, policy.approvalLevel])
            )
          );
        })
        .catch(() => {
          setPolicyByToolId(previous);
          setPolicyError('Could not save tool policy. Please try again.');
        })
        .finally(() => {
          setSavingToolIds((current) => {
            const next = new Set(current);
            next.delete(tool.id);
            return next;
          });
        });
    },
    [policyByToolId, policyConnection?.id]
  );
  const handleBulkPolicyChange = React.useCallback(
    (
      action:
        | { type: 'reset' }
        | { type: 'bulk'; level: IntegrationToolApprovalLevel; actionClasses?: string[] }
    ) => {
      const connectionId = policyConnection?.id;
      if (!connectionId) return;
      const previous = policyByToolId;
      setPolicyError(null);
      if (action.type === 'reset') {
        setPolicyByToolId({});
      } else {
        setPolicyByToolId((current) => {
          const next = { ...current };
          for (const tool of displayItem?.tools ?? []) {
            if (
              action.actionClasses?.length &&
              !action.actionClasses.includes(String(tool.actionClass || 'read'))
            ) {
              continue;
            }
            next[tool.id] = action.level;
          }
          return next;
        });
      }
      void patchProviderIntegrationToolPolicy(
        connectionId,
        action.type === 'reset'
          ? { resetToDefaults: true }
          : {
              bulkApprovalLevel: action.level,
              actionClasses: action.actionClasses,
            }
      )
        .then((response) => {
          setPolicyByToolId(
            Object.fromEntries(
              response.policies.map((policy) => [policy.toolId, policy.approvalLevel])
            )
          );
        })
        .catch(() => {
          setPolicyByToolId(previous);
          setPolicyError('Could not save bulk policy changes. Please try again.');
        });
    },
    [displayItem?.tools, policyByToolId, policyConnection?.id]
  );
  const renderAccountSection = (mode: 'management' | 'account') =>
    displayItem ? (
      <section className="space-y-3" data-testid="integration-account-management">
        {mode === 'management' ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-title text-base">Connections</h3>
                <p className="text-caption">Manage accounts and labels.</p>
              </div>
              <Button
                type="button"
                variant="outline"
                className="shrink-0 gap-1.5"
                disabled={busy || isDetailLoading}
                onClick={() => onPrimaryAction(displayItem)}
                data-testid="integration-connect-another-account"
              >
                <Plus className="h-4 w-4" />
                Add account
              </Button>
            </div>
          </div>
        ) : null}
        <ConnectedAccountsSection
          connections={displayItem.connections}
          busyConnectionId={busyConnectionId}
          onReconnect={onReconnectConnection}
          onDisconnect={onDisconnectConnection}
          onCancel={onCancelConnection}
          onTest={onTestConnection}
          onUpdateLabel={onUpdateConnectionLabel}
        />
      </section>
    ) : null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex !w-[min(960px,calc(100vw-2rem))] !max-w-[calc(100vw-2rem)] flex-col overflow-hidden p-0 sm:!max-w-[calc(100vw-2rem)]"
        data-testid="provider-integration-detail-sheet"
      >
        {displayItem && (
          <>
            <div className="border-b p-6 pb-4">
              <SheetHeader className="pr-8">
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="bg-muted/40 flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl border">
                      {displayItem.iconUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={displayItem.iconUrl} alt="" className="h-9 w-9 object-contain" />
                      ) : (
                        <ShieldCheck className="h-6 w-6 text-primary" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <SheetTitle className="truncate">{displayItem.displayName}</SheetTitle>
                      {displayItem.category && (
                        <SheetDescription>{displayItem.category}</SheetDescription>
                      )}
                    </div>
                  </div>
                  <IntegrationStatusBadge status={displayItem.status} />
                </div>
                <p className="text-body text-muted-foreground">
                  {displayItem.description ||
                    'Review what this integration exposes before connecting it.'}
                </p>
                <div
                  className="bg-muted/20 mt-3 flex gap-2 rounded-lg border p-3 text-left"
                  data-testid="integration-secure-connection-summary"
                >
                  <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                  <div className="text-xs leading-5 text-muted-foreground">
                    <p className="font-medium text-foreground">Secure connection</p>
                    <p>
                      Unify stores provider credentials outside prompts and only uses this
                      connection when your assistant invokes an allowed integration tool.
                    </p>
                    {policyConnection && (
                      <p className="mt-1">
                        Usable by this assistant · {displayItem.scopes.length} access scopes ·{' '}
                        {policySummary.automatic} automatic, {policySummary.confirmation} ask first,{' '}
                        {policySummary.off} off.
                      </p>
                    )}
                  </div>
                </div>
              </SheetHeader>
            </div>

            <ScrollArea className="min-h-0 flex-1 overflow-x-hidden">
              <div className="min-w-0 space-y-6 overflow-x-hidden p-6">
                {isDetailLoading && <LoadingSkeleton />}
                {!isDetailLoading && (
                  <>
                    {isConnectedApp && !isNativeApp && renderAccountSection('management')}
                    {failedConnections.length > 0 && (
                      <Alert
                        variant="destructive"
                        data-testid="integration-connection-failure-alert"
                      >
                        <AlertTitle>Connection failed</AlertTitle>
                        <AlertDescription>
                          Please retry or contact support at support@unify.ai.
                        </AlertDescription>
                      </Alert>
                    )}
                    <section className="space-y-3" data-testid="provider-permission-review">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <h3 className="text-title text-base">Access scopes</h3>
                          <p className="text-caption">
                            Review what this app may read or change before connecting.
                          </p>
                        </div>
                        <Badge variant="outline" className="rounded-full text-muted-foreground">
                          {displayItem.scopes.length} scopes
                        </Badge>
                      </div>
                      <PermissionList
                        scopes={displayItem.scopes}
                        selectedScopeIds={selectedScopeSet}
                        onToggleScope={handleToggleScope}
                      />
                      {displayItem.status === 'missing_scope' && (
                        <Alert className="bg-muted/20">
                          <AlertTitle>More access is needed</AlertTitle>
                          <AlertDescription>
                            Reconnect to approve the permissions needed for this app.
                          </AlertDescription>
                        </Alert>
                      )}
                    </section>

                    {!isConnectedApp &&
                      !isNativeApp &&
                      visibleConnectionCount > 0 &&
                      renderAccountSection('account')}

                    {displayItem.apiKeySchema && onApiKeySubmit && (
                      <section className="space-y-3">
                        <h3 className="text-title text-base">Credential</h3>
                        <ProviderApiKeyForm
                          schema={displayItem.apiKeySchema}
                          isSubmitting={busy}
                          onSubmit={(values) => onApiKeySubmit(displayItem, values)}
                        />
                      </section>
                    )}

                    {displayItem.tools.length > 0 && (
                      <section className="space-y-3">
                        <AvailableToolsList
                          tools={displayItem.tools}
                          selectedScopeIds={selectedScopeIds}
                          onClearScopes={() => setSelectedScopeIds([])}
                          policyByToolId={policyByToolId}
                          policyEnabled={Boolean(policyConnection)}
                          savingToolIds={savingToolIds}
                          policyError={policyError}
                          onPolicyChange={handlePolicyChange}
                          onBulkPolicyChange={handleBulkPolicyChange}
                        />
                      </section>
                    )}

                    {displayItem.docsUrl && (
                      <a
                        href={displayItem.docsUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-caption inline-flex items-center gap-1 hover:text-foreground"
                      >
                        Integration docs
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    )}
                  </>
                )}
              </div>
            </ScrollArea>

            <div className="flex shrink-0 items-center justify-end gap-2 border-t p-4">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Close
              </Button>
              {displayItem.status !== 'connected' &&
                displayItem.status !== 'configured' &&
                !isNativeApp && (
                  <Button
                    disabled={busy || isDetailLoading}
                    onClick={() => {
                      onPrimaryAction(displayItem);
                    }}
                    data-testid="provider-integration-primary-action"
                  >
                    {actionLabel(displayItem)}
                  </Button>
                )}
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
