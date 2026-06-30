'use client';

/**
 * Admin Billing Plans Dashboard
 *
 * Client component for the /admin/billing-plans page. Operators use
 * this to:
 *   - Browse the BillingPlanTemplate catalog (filterable by catalog
 *     placement and active/deprecated status).
 *   - Create new templates (PAYG / COMMITMENT × CREDITS / METERED).
 *   - Soft-deprecate templates (flip ``is_active`` → false; hides from
 *     self-serve, keeps existing assignments alive and billing).
 *
 * Manually re-running the monthly metered invoicer is intentionally
 * NOT exposed here — the Cloud Scheduler cron handles the happy path,
 * and the rare "kick it again after a partial-failure month" case is
 * an admin shell script (one-off, audited, not a UI button).
 *
 * Per-account plan assignment lives on the /admin/organizations
 * detail panel (not here) — templates are catalog, assignments are
 * per-customer, the two surfaces are intentionally split.
 *
 * Schema notes (kept in sync with `BillingPlanTemplate` in orchestra):
 *   - `plan_type` is *derived* from `commit_amount` (positive =
 *     COMMITMENT, NULL = PAY_AS_YOU_GO). The UI doesn't surface it as
 *     a separate column or form field — the Commitment column already
 *     reads as "—" for PAYG plans, and the Create dialog treats "no
 *     commit amount" as the PAYG indicator.
 *   - Catalog placement is two orthogonal booleans: `is_custom`
 *     (catalog vs bespoke) and `is_active` (live vs deprecated).
 *   - `fx_policy` is NULL for USD templates and one of LOCKED_RATE /
 *     SPOT / PERIOD_AVERAGE for non-USD ones.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Loader2,
  Plus,
  Archive,
  Tag,
  AlertTriangle,
  ChevronDown,
  Coins,
  Receipt,
  HelpCircle,
  Search,
  ListFilter,
  Layers,
  MoreHorizontal,
  Copy,
} from 'lucide-react';
import { Loader } from '@/components/Common/Loader';
import { Button } from '@/components/UI/button';
import { Input } from '@/components/UI/input';
import { Label } from '@/components/UI/label';
import { Badge } from '@/components/UI/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/UI/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogDescription,
} from '@/components/UI/dialog';
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/UI/table';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/UI/dropdown-menu';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/UI/tooltip';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/UI/tabs';
import BillingPlanGroupsTab from '@/components/Pages/Admin/BillingPlanGroupsTab';
import type {
  AdminBillingPlansActions,
  AdminBillingPlanTemplate,
  AdminBillingPlanTemplateCreate,
  AdminPlanGroupDetail,
  AdminPlanGroupSummary,
} from '@/types/admin';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isError(result: unknown): result is { detail: string } {
  return typeof result === 'object' && result !== null && 'detail' in result;
}

/**
 * Render a Decimal-like number as money. METERED templates can have
 * non-USD `currency`; templates may also carry no commitment at all
 * (PAYG), in which case we render an em-dash.
 */
function money(amount: number | null | undefined, currency: string) {
  if (amount == null) return '—';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  }).format(amount);
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

const MODE_COLORS: Record<string, string> = {
  CREDITS: 'bg-[color:var(--status-warning-bg)] text-[color:var(--status-warning)]',
  METERED: 'bg-[color:var(--status-info-bg)] text-[color:var(--status-info)]',
};

/**
 * Small info icon with a tooltip — used in column headers and form
 * field labels to surface short explanations without cluttering the UI.
 */
function InfoHint({ text }: { text: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          className="inline-flex h-4 w-4 items-center justify-center rounded-full text-muted-foreground hover:text-foreground"
          aria-label="More info"
        >
          <HelpCircle className="h-3.5 w-3.5" />
        </button>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-xs whitespace-normal p-2 text-xs">
        {text}
      </TooltipContent>
    </Tooltip>
  );
}

const COLUMN_HINTS: Record<string, string> = {
  Name: 'Display name on top, internal id below. Hover for description.',
  Mode: 'CREDITS = prepaid wallet. METERED = invoice at month-end.',
  Commitment: 'Periodic minimum + cadence + schedule. Empty = PAYG.',
  FX: 'Conversion policy for non-USD. USD = none.',
  Base: 'Multiplier on every usage unit (commit + PAYG + overage).',
  Overage:
    'Extra multiplier stacked on base, only above commit. Effective above-commit rate = base × overage.',
  Collection: 'Auto card vs NET-30 invoice (wire / customer balance).',
  Status: 'Catalog/Custom placement + Active/Deprecated state.',
  Groups: 'Plan groups this template belongs to.',
  Created: 'When the template row was inserted.',
};

const COLLECTION_LABELS: Record<string, string> = {
  AUTO_CARD: 'Auto card',
  SEND_INVOICE_NET_30: 'NET-30 invoice',
};

const SCHEDULE_LABELS: Record<string, string> = {
  AMORTISED: 'amortised',
  UPFRONT: 'upfront',
};

/** Catalog-placement filter values mapped to the `include_custom` API param. */
type PlacementFilter = 'ALL' | 'CATALOG' | 'CUSTOM';

const PLACEMENT_LABELS: Record<PlacementFilter, string> = {
  ALL: 'All plans',
  CATALOG: 'Catalog only',
  CUSTOM: 'Custom only',
};

/**
 * Group filter for the Plans tab.
 *
 *   ALL      — no filtering on group membership.
 *   ANY      — only templates that belong to at least one group.
 *   NONE     — only templates that don't belong to any group.
 *   <number> — only templates that are members of that specific group.
 */
type GroupFilter = 'ALL' | 'ANY' | 'NONE' | number;

// ---------------------------------------------------------------------------
// Toast helper (local copy of the OrganizationsMain pattern)
// ---------------------------------------------------------------------------

function useToast() {
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback((text: string, type: 'success' | 'error' = 'success') => {
    if (timer.current) clearTimeout(timer.current);
    setMessage({ text, type });
    timer.current = setTimeout(() => setMessage(null), 4000);
  }, []);

  const Toast = message ? (
    <div
      className={`text-body fixed bottom-4 right-4 z-[100] rounded-lg px-4 py-2 shadow-lg ${
        message.type === 'success'
          ? 'bg-[color:var(--status-success-bg)] text-[color:var(--status-success)]'
          : 'bg-[color:var(--status-danger-bg)] text-[color:var(--status-danger)]'
      }`}
    >
      {message.text}
    </div>
  ) : null;

  return { show, Toast };
}

// =============================================================================
// Main Component
// =============================================================================

interface Props {
  actions: AdminBillingPlansActions;
}

/**
 * Form state mirrors the wire payload — no transient UI-only fields.
 * "Plan type" (PAYG vs COMMITMENT) is implied by `commitAmount`:
 * leaving it empty / 0 produces a PAYG template, any positive value
 * produces a COMMITMENT template. The server re-derives the label on
 * every read.
 */
type FormState = AdminBillingPlanTemplateCreate;

const DEFAULT_FORM: FormState = {
  name: '',
  displayName: '',
  description: '',
  billingMode: 'METERED',
  isCustom: true,
  isActive: true,
  commitAmount: 1000,
  currency: 'USD',
  commitPeriod: 'MONTHLY',
  commitSchedule: 'AMORTISED',
  basePricingFactor: 1.0,
  overagePricingFactor: 1.0,
  collectionMethod: 'SEND_INVOICE_NET_30',
  prorationPolicy: 'PRORATE',
  creditsRolloverPolicy: null,
  fxPolicy: null,
  fxLockedRate: null,
  supersedesTemplateId: null,
};

export default function BillingPlansAdminMain({ actions }: Props) {
  const { show: toast, Toast } = useToast();

  // ── Catalog state ────────────────────────────────────────────────────
  const [templates, setTemplates] = useState<AdminBillingPlanTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [placement, setPlacement] = useState<PlacementFilter>('ALL');
  const [showInactive, setShowInactive] = useState(false);
  const [search, setSearch] = useState('');

  // ── Create dialog state ──────────────────────────────────────────────
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState<FormState>(DEFAULT_FORM);
  const [isCreating, setIsCreating] = useState(false);

  // ── Deprecate dialog state ───────────────────────────────────────────
  const [deprecateTarget, setDeprecateTarget] = useState<AdminBillingPlanTemplate | null>(null);
  const [isDeprecating, setIsDeprecating] = useState(false);

  // ── Tab state ────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<'plans' | 'groups'>('plans');

  // ── Plan groups state (shared between both tabs) ─────────────────────
  // The Plans tab uses this to render the Group filter + the Group
  // column; the Groups tab uses it as the source of truth for the
  // table. Loading every group's *detail* (and not just the summary)
  // is what gives us the template→groups map for the Plans tab. The
  // catalog of groups is intentionally tiny (handful per tenant), so a
  // fan-out of getGroup() calls is cheaper than adding a new
  // bulk-membership backend endpoint.
  const [groups, setGroups] = useState<AdminPlanGroupSummary[]>([]);
  const [groupDetails, setGroupDetails] = useState<AdminPlanGroupDetail[]>([]);
  const [groupsLoading, setGroupsLoading] = useState(false);
  const [showInactiveGroups, setShowInactiveGroups] = useState(false);
  const [groupFilter, setGroupFilter] = useState<GroupFilter>('ALL');

  const fetchGroups = useCallback(async () => {
    setGroupsLoading(true);
    const listResult = await actions.listGroups({
      includeInactive: showInactiveGroups,
    });
    if (isError(listResult)) {
      toast(listResult.detail, 'error');
      setGroups([]);
      setGroupDetails([]);
      setGroupsLoading(false);
      return;
    }
    const summaries = (listResult as { groups: AdminPlanGroupSummary[] }).groups;
    setGroups(summaries);
    // Fan out to load each group's members in parallel; failures are
    // logged but don't block the rest from rendering (the row just
    // shows zero members downstream rather than a stale entry).
    const detailResults = await Promise.all(summaries.map((g) => actions.getGroup(g.id)));
    setGroupDetails(detailResults.filter((r) => !isError(r)) as AdminPlanGroupDetail[]);
    setGroupsLoading(false);
  }, [actions, showInactiveGroups, toast]);

  useEffect(() => {
    fetchGroups();
  }, [fetchGroups]);

  // template_id → AdminPlanGroupSummary[] derived from the loaded
  // group details. Recomputed cheaply on every render — both inputs
  // are small arrays.
  const templateGroupsMap = useMemo(() => {
    const map = new Map<number, AdminPlanGroupSummary[]>();
    for (const g of groupDetails) {
      const summary: AdminPlanGroupSummary = {
        id: g.id,
        name: g.name,
        displayName: g.displayName,
        isActive: g.isActive,
        memberCount: g.members.length,
      };
      for (const m of g.members) {
        const existing = map.get(m.templateId) ?? [];
        existing.push(summary);
        map.set(m.templateId, existing);
      }
    }
    return map;
  }, [groupDetails]);

  // Load catalog whenever the filters change.
  const fetchCatalog = useCallback(async () => {
    setIsLoading(true);
    const result = await actions.listTemplates({
      includeCustom: placement === 'ALL' ? undefined : placement === 'CUSTOM' ? true : false,
      includeInactive: showInactive,
    });
    if (isError(result)) {
      toast(result.detail, 'error');
      setTemplates([]);
    } else {
      setTemplates(result as AdminBillingPlanTemplate[]);
    }
    setIsLoading(false);
  }, [actions, placement, showInactive, toast]);

  useEffect(() => {
    fetchCatalog();
  }, [fetchCatalog]);

  // Client-side search + group filter (cheap; the catalog is never
  // large enough to warrant a backend grep, and the group dimension
  // is in-memory).
  const visibleTemplates = useMemo(() => {
    const q = search.trim().toLowerCase();
    return templates.filter((t) => {
      // Search filter.
      if (q) {
        const matchesSearch =
          t.name.toLowerCase().includes(q) ||
          (t.displayName ?? '').toLowerCase().includes(q) ||
          (t.description ?? '').toLowerCase().includes(q);
        if (!matchesSearch) return false;
      }
      // Group membership filter.
      if (groupFilter === 'ALL') return true;
      const memberOf = templateGroupsMap.get(t.id) ?? [];
      if (groupFilter === 'ANY') return memberOf.length > 0;
      if (groupFilter === 'NONE') return memberOf.length === 0;
      return memberOf.some((g) => g.id === groupFilter);
    });
  }, [templates, search, groupFilter, templateGroupsMap]);

  // ── Handlers ─────────────────────────────────────────────────────────

  const handleCreate = async () => {
    if (!form.name.trim()) {
      toast('Template name is required', 'error');
      return;
    }
    setIsCreating(true);
    // Normalise the payload before POST:
    //   * Empty display name → null (the metered invoicer falls back
    //     to the internal `name` for line items in that case).
    //   * commit_amount = null/0 ⇒ PAYG ⇒ NULL out every commit-side
    //     column so the wire payload matches the CHECK constraints
    //     ("commit_period only with commit_amount > 0", etc.).
    //   * credits_rollover_policy is COMMITMENT+CREDITS only.
    const isCommit = (form.commitAmount ?? 0) > 0;
    const payload: AdminBillingPlanTemplateCreate = {
      ...form,
      displayName: form.displayName?.trim() ? form.displayName.trim() : null,
      commitAmount: isCommit ? form.commitAmount : null,
      commitPeriod: isCommit ? (form.commitPeriod ?? null) : null,
      commitSchedule: isCommit ? (form.commitSchedule ?? null) : null,
      creditsRolloverPolicy:
        isCommit && form.billingMode === 'CREDITS' ? (form.creditsRolloverPolicy ?? null) : null,
    };
    const result = await actions.createTemplate(payload);
    if (isError(result)) {
      toast(result.detail, 'error');
    } else {
      toast(`Template "${form.name}" created`);
      setCreateOpen(false);
      setForm(DEFAULT_FORM);
      fetchCatalog();
    }
    setIsCreating(false);
  };

  const handleDeprecate = async () => {
    if (!deprecateTarget) return;
    setIsDeprecating(true);
    const result = await actions.deprecateTemplate(deprecateTarget.id);
    if (isError(result)) {
      // The 409 path (active assignments) bubbles up here as a
      // structured detail; no special-casing needed because the
      // toast already surfaces it. The operator's next move is
      // visible from the message ("move every account off…").
      toast(result.detail, 'error');
    } else {
      toast(`Template "${deprecateTarget.name}" deprecated`);
      setDeprecateTarget(null);
      fetchCatalog();
    }
    setIsDeprecating(false);
  };

  /**
   * Open the Create Plan dialog seeded with another template's fields,
   * minus the ones an operator must always tweak (``name``, the
   * ``Supersedes`` link, and a "(copy)" suffix on the display name).
   * The intent is "duplicate this row to make a sibling tier" —
   * usually the operator only wants to change the commit amount or
   * the pricing factor.
   *
   * We deliberately don't set ``supersedesTemplateId`` to the source:
   * a sibling tier is not a successor, and pre-filling that field
   * would push operators into accidentally chaining unrelated
   * templates together. They can still pick it explicitly from the
   * dropdown if they meant a true successor.
   */
  const handleDuplicate = (source: AdminBillingPlanTemplate) => {
    setForm({
      name: '',
      displayName: source.displayName ? `${source.displayName} (copy)` : '',
      description: source.description ?? '',
      billingMode: source.billingMode,
      isCustom: source.isCustom,
      isActive: true,
      commitAmount: source.commitAmount ?? null,
      currency: source.currency,
      commitPeriod: source.commitPeriod ?? null,
      commitSchedule: source.commitSchedule ?? null,
      basePricingFactor: source.basePricingFactor,
      overagePricingFactor: source.overagePricingFactor,
      collectionMethod: source.collectionMethod,
      prorationPolicy: source.prorationPolicy,
      creditsRolloverPolicy: source.creditsRolloverPolicy ?? null,
      fxPolicy: source.fxPolicy ?? null,
      fxLockedRate: source.fxLockedRate ?? null,
      supersedesTemplateId: null,
    });
    setCreateOpen(true);
  };

  const updateForm = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((prev) => {
      const next = { ...prev, [key]: value } as FormState;
      // Cross-field invariant: USD templates store fx_policy = NULL;
      // non-USD templates MUST pick LOCKED_RATE / SPOT / PERIOD_AVERAGE.
      // When the user toggles currency we nudge fx_policy onto a sensible
      // default rather than letting them post a payload the backend will
      // reject.
      if (key === 'currency') {
        if (value === 'USD') {
          next.fxPolicy = null;
          next.fxLockedRate = null;
        } else if (prev.fxPolicy == null) {
          next.fxPolicy = 'SPOT';
        }
      }
      // Clear fxLockedRate whenever fxPolicy moves off LOCKED_RATE.
      if (key === 'fxPolicy' && value !== 'LOCKED_RATE') {
        next.fxLockedRate = null;
      }
      // Flipping mode away from CREDITS clears the credits-only rollover
      // policy (server CHECK constraint would reject otherwise).
      if (key === 'billingMode' && value !== 'CREDITS') {
        next.creditsRolloverPolicy = null;
      }
      return next;
    });

  // =====================================================================
  // Render
  // =====================================================================

  const placementBadgeCount = (placement !== 'ALL' ? 1 : 0) + (showInactive ? 1 : 0);

  return (
    <TooltipProvider delayDuration={150}>
      {/*
       * Layout note: the Tabs root uses natural document flow rather
       * than a `flex h-full` cascade. Radix `<Tabs.Content>` renders as
       * a plain block — nesting it inside a flex column with
       * `overflow-auto` on the table container left a phantom
       * intermediate height so the table started scrolling before the
       * page did, and the (initially empty) Groups tab body floated to
       * the bottom instead of pinning to the top. Letting the page
       * scroll as one unit keeps both tabs visually consistent and
       * removes the double-scrollbar UX.
       */}
      <Tabs
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as 'plans' | 'groups')}
        className="w-full"
      >
        {/* ── Header ───────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between gap-4 border-b border-border px-4 py-3">
          <p className="text-caption min-w-0">
            Plan templates and the groups that scope self-serve switching. Per-account assignments
            live on{' '}
            <a href="/admin/organizations" className="underline">
              Organizations
            </a>
            .
          </p>
          {/* Tab switcher lives in the header so the page chrome doesn't
            shift when the operator flips between tabs. The per-tab
            primary action (Create Plan / New Group) renders inside its
            own tab body, keeping each surface self-contained. */}
          <TabsList className="shrink-0">
            <TabsTrigger value="plans">Plans</TabsTrigger>
            <TabsTrigger value="groups">Groups</TabsTrigger>
          </TabsList>
        </div>

        {/* ── Plans tab ────────────────────────────────────────────────── */}
        <TabsContent value="plans" className="focus-visible:ring-0 focus-visible:ring-offset-0">
          {/* Filters (search · placement · group · status · count · create) */}
          <div className="flex items-center gap-2 border-b border-border px-4 py-2">
            <div className="relative w-72">
              <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name or description…"
                className="h-8 pl-7"
              />
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-8">
                  <ListFilter className="mr-1.5 h-3.5 w-3.5" />
                  Filters
                  {placementBadgeCount > 0 && (
                    <Badge variant="secondary" className="ml-2 h-4 px-1.5 text-[10px]">
                      {placementBadgeCount}
                    </Badge>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-56">
                <DropdownMenuLabel>Catalog placement</DropdownMenuLabel>
                <DropdownMenuRadioGroup
                  value={placement}
                  onValueChange={(v) => setPlacement(v as PlacementFilter)}
                >
                  {(Object.keys(PLACEMENT_LABELS) as PlacementFilter[]).map((value) => (
                    <DropdownMenuRadioItem
                      key={value}
                      value={value}
                      onSelect={(e) => e.preventDefault()}
                    >
                      {PLACEMENT_LABELS[value]}
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
                <DropdownMenuSeparator />
                <DropdownMenuLabel>Status</DropdownMenuLabel>
                <DropdownMenuCheckboxItem
                  checked={showInactive}
                  onCheckedChange={(v) => setShowInactive(!!v)}
                  onSelect={(e) => e.preventDefault()}
                >
                  Show deprecated
                </DropdownMenuCheckboxItem>
              </DropdownMenuContent>
            </DropdownMenu>
            {/* Group filter — surfaces the templateGroupsMap as a
              first-class slice. ALL/ANY/NONE are sticky operators;
              numeric values are individual group ids. */}
            <Select
              value={
                groupFilter === 'ALL'
                  ? 'ALL'
                  : groupFilter === 'ANY'
                    ? 'ANY'
                    : groupFilter === 'NONE'
                      ? 'NONE'
                      : `g-${groupFilter}`
              }
              onValueChange={(v) => {
                if (v === 'ALL' || v === 'ANY' || v === 'NONE') {
                  setGroupFilter(v);
                } else if (v.startsWith('g-')) {
                  setGroupFilter(Number(v.slice(2)));
                }
              }}
            >
              <SelectTrigger className="h-8 w-56">
                <Layers className="mr-1.5 h-3.5 w-3.5 text-muted-foreground" />
                <SelectValue placeholder="Group" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Any group (all plans)</SelectItem>
                <SelectItem value="ANY">In any group</SelectItem>
                <SelectItem value="NONE">Not in any group</SelectItem>
                {groups.length > 0 && (
                  <>
                    <DropdownMenuSeparator />
                    {groups.map((g) => (
                      <SelectItem key={g.id} value={`g-${g.id}`}>
                        {g.displayName ?? g.name}
                      </SelectItem>
                    ))}
                  </>
                )}
              </SelectContent>
            </Select>
            <span className="text-caption ml-auto">
              {visibleTemplates.length} plan{visibleTemplates.length === 1 ? '' : 's'}
            </span>
            <Dialog open={createOpen} onOpenChange={setCreateOpen}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="mr-1.5 h-3.5 w-3.5" />
                  Create Plan
                </Button>
              </DialogTrigger>
              <CreateTemplateDialog
                form={form}
                updateForm={updateForm}
                onSubmit={handleCreate}
                isSubmitting={isCreating}
                existingTemplates={templates}
              />
            </Dialog>
          </div>

          {/* ── Catalog table ────────────────────────────────────────── */}
          <div>
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader size={24} />
              </div>
            ) : visibleTemplates.length === 0 ? (
              <div className="text-body-muted py-12 text-center">
                {templates.length === 0
                  ? 'No plans match the filters.'
                  : `No plans match "${search}".`}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    {(
                      [
                        'Name',
                        'Mode',
                        'Commitment',
                        'FX',
                        'Base ×',
                        'Overage ×',
                        'Collection',
                        'Status',
                        'Groups',
                        'Created',
                      ] as const
                    ).map((label) => (
                      <TableHead
                        key={label}
                        className={
                          label === 'Name'
                            ? 'w-[260px]'
                            : label === 'Base ×' || label === 'Overage ×'
                              ? 'w-20'
                              : label === 'FX'
                                ? 'w-24'
                                : undefined
                        }
                      >
                        <span className="inline-flex items-center gap-1.5">
                          {label}
                          <InfoHint text={COLUMN_HINTS[label]} />
                        </span>
                      </TableHead>
                    ))}
                    <TableHead className="w-12"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visibleTemplates.map((t) => {
                    const isCommitment = (t.commitAmount ?? 0) > 0;
                    return (
                      <TableRow key={t.id}>
                        <TableCell className="w-[260px] max-w-[260px]">
                          {/*
                           * Two-line cell with a hard width cap. Description
                           * is intentionally NOT rendered here — it would
                           * blow out the column on long copy. Instead we
                           * surface it on row hover via a tooltip that wraps
                           * the whole name block, so operators can scan
                           * names quickly and dive into the prose only when
                           * they need it.
                           */}
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div className="flex min-w-0 items-center gap-2">
                                <Tag className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                                <div className="min-w-0 flex-1">
                                  <div className="text-body-sm truncate font-medium">
                                    {t.displayName ?? t.name}
                                  </div>
                                  <div className="text-caption truncate font-mono">{t.name}</div>
                                </div>
                              </div>
                            </TooltipTrigger>
                            {t.description && (
                              <TooltipContent
                                side="right"
                                className="max-w-md whitespace-normal p-2 text-xs"
                              >
                                {t.description}
                              </TooltipContent>
                            )}
                          </Tooltip>
                        </TableCell>
                        <TableCell>
                          <span
                            className={`text-caption text-semibold rounded px-1.5 py-0.5 ${
                              MODE_COLORS[t.billingMode] ?? 'bg-muted'
                            }`}
                          >
                            {t.billingMode}
                          </span>
                        </TableCell>
                        <TableCell className="text-sm">
                          {isCommitment ? (
                            <div>
                              <div>
                                {money(t.commitAmount, t.currency)}
                                <span className="text-caption ml-1">
                                  / {t.commitPeriod?.toLowerCase() ?? '—'}
                                </span>
                              </div>
                              {t.commitSchedule && (
                                <div className="text-caption">
                                  {SCHEDULE_LABELS[t.commitSchedule] ??
                                    t.commitSchedule.toLowerCase()}
                                </div>
                              )}
                            </div>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="w-24 max-w-24 text-sm">
                          {t.fxPolicy == null ? (
                            <span className="text-muted-foreground">—</span>
                          ) : (
                            <span
                              className="block truncate"
                              title={
                                t.fxPolicy === 'LOCKED_RATE'
                                  ? `LOCKED @ ${t.fxLockedRate ?? '—'}`
                                  : t.fxPolicy
                              }
                            >
                              {t.fxPolicy === 'LOCKED_RATE'
                                ? `@ ${t.fxLockedRate ?? '—'}`
                                : t.fxPolicy}
                            </span>
                          )}
                        </TableCell>
                        {/*
                         * Pricing is rendered as two separate cells so the
                         * column reads like a price list (Base / Overage)
                         * instead of a packed expression. Overage shows
                         * "—" for PAYG (no notion of "above commit") and
                         * a muted "1.00×" for COMMITMENT plans with no
                         * uplift, so operators can still see at a glance
                         * that the policy was set explicitly rather than
                         * defaulted.
                         */}
                        <TableCell className="text-sm tabular-nums">
                          {t.basePricingFactor.toFixed(2)}×
                        </TableCell>
                        <TableCell className="text-sm tabular-nums">
                          {!isCommitment ? (
                            <span className="text-muted-foreground">—</span>
                          ) : (
                            <span
                              className={
                                t.overagePricingFactor === 1 ? 'text-muted-foreground' : undefined
                              }
                              title="Effective above-commit rate = base × overage"
                            >
                              {t.overagePricingFactor.toFixed(2)}×
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-sm">
                          <span title={t.collectionMethod}>
                            {COLLECTION_LABELS[t.collectionMethod] ?? t.collectionMethod}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap items-center gap-1">
                            <Badge
                              variant={t.isCustom ? 'secondary' : 'default'}
                              className="text-xs"
                            >
                              {t.isCustom ? 'Custom' : 'Catalog'}
                            </Badge>
                            {!t.isActive && (
                              <Badge variant="destructive" className="text-xs">
                                Deprecated
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-sm">
                          {/* Group membership badges. Clickable to jump
                          straight to the Groups tab, scoped to that
                          group via the parent's group filter — keeps
                          the operator in flow when triaging "what does
                          this template participate in?". */}
                          {(() => {
                            const memberOf = templateGroupsMap.get(t.id) ?? [];
                            if (memberOf.length === 0) {
                              return <span className="text-muted-foreground">—</span>;
                            }
                            return (
                              <div className="flex flex-wrap gap-1">
                                {memberOf.map((g) => (
                                  <button
                                    key={g.id}
                                    type="button"
                                    onClick={() => {
                                      setGroupFilter(g.id);
                                      setActiveTab('groups');
                                    }}
                                    className="rounded-full"
                                    aria-label={`View group ${g.displayName ?? g.name}`}
                                  >
                                    <Badge
                                      variant={g.isActive ? 'outline' : 'secondary'}
                                      className="text-xs hover:bg-muted"
                                    >
                                      {g.displayName ?? g.name}
                                    </Badge>
                                  </button>
                                ))}
                              </div>
                            );
                          })()}
                        </TableCell>
                        <TableCell className="text-caption">{formatDate(t.createdAt)}</TableCell>
                        <TableCell>
                          {/*
                           * Row actions live in a single 3-dot dropdown so
                           * the column stays narrow and the operator
                           * vocabulary scales — when we add Reactivate,
                           * View Audit, etc. they slot in without
                           * widening the table. "Duplicate" is the
                           * primary tier-creation flow (prefill Create
                           * Plan with this row's fields, leave Name
                           * blank). "Deprecate" hides on already-inactive
                           * rows because the action is a no-op there.
                           */}
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                aria-label={`Actions for plan ${t.name}`}
                              >
                                <MoreHorizontal className="h-3.5 w-3.5" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-56">
                              <DropdownMenuItem onSelect={() => handleDuplicate(t)}>
                                <Copy className="mr-2 h-3.5 w-3.5" />
                                Duplicate as new plan
                              </DropdownMenuItem>
                              {t.isActive && (
                                <>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    onSelect={() => setDeprecateTarget(t)}
                                    className="text-destructive focus:text-destructive"
                                  >
                                    <Archive className="mr-2 h-3.5 w-3.5" />
                                    Deprecate plan
                                  </DropdownMenuItem>
                                </>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </div>
        </TabsContent>

        {/* ── Groups tab ───────────────────────────────────────────────── */}
        <TabsContent value="groups" className="focus-visible:ring-0 focus-visible:ring-offset-0">
          <BillingPlanGroupsTab
            actions={actions}
            templates={templates}
            groups={groups}
            loading={groupsLoading}
            showInactive={showInactiveGroups}
            setShowInactive={setShowInactiveGroups}
            refresh={fetchGroups}
          />
        </TabsContent>

        {/* ── Deprecate confirm ────────────────────────────────────────── */}
        <AlertDialog
          open={!!deprecateTarget}
          onOpenChange={(open) => !open && setDeprecateTarget(null)}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-[color:var(--status-warning)]" />
                Deprecate "{deprecateTarget?.name}"?
              </AlertDialogTitle>
              <AlertDialogDescription>
                Hides from new assignments. Refused if any account is still on this plan.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isDeprecating}>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleDeprecate} disabled={isDeprecating}>
                {isDeprecating ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
                Deprecate
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {Toast}
      </Tabs>
    </TooltipProvider>
  );
}

// =============================================================================
// Create Template Dialog (extracted for readability)
// =============================================================================

interface DialogProps {
  form: FormState;
  updateForm: <K extends keyof FormState>(key: K, value: FormState[K]) => void;
  onSubmit: () => void;
  isSubmitting: boolean;
  /** Already-loaded catalog rows; used to populate the supersedes dropdown. */
  existingTemplates: AdminBillingPlanTemplate[];
}

/**
 * Single-row form field with a label + helper-text below the title.
 * Children render the actual control (input / select).
 */
function Field({
  label,
  hint,
  required,
  children,
  icon,
}: {
  label: string;
  hint?: string;
  required?: boolean;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div>
      <Label className="text-label-muted flex items-center gap-1.5">
        {icon}
        <span>
          {label}
          {required && <span className="text-error ml-0.5">*</span>}
        </span>
      </Label>
      {hint && <p className="text-caption mt-0.5">{hint}</p>}
      <div className="mt-1.5">{children}</div>
    </div>
  );
}

/**
 * Foldable group of related fields with a small heading. The heading
 * uses an uppercase label so it reads as section nav, not a field
 * label, and clicking it (or the chevron) collapses the body.
 *
 * Sections default to open; the chevron rotates to indicate state.
 */
function Section({
  title,
  subtitle,
  children,
  defaultOpen = true,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const bodyId = useMemo(
    () => `section-${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
    [title]
  );
  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={bodyId}
        className="hover:border-border/80 group flex w-full items-center gap-2 border-b border-border pb-1.5 text-left transition-colors"
      >
        <ChevronDown
          className={`h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform duration-150 ${
            open ? '' : '-rotate-90'
          }`}
        />
        <div className="min-w-0 flex-1">
          <h3 className="text-caption text-semibold uppercase tracking-wider text-muted-foreground">
            {title}
          </h3>
          {subtitle && <p className="text-caption mt-0.5">{subtitle}</p>}
        </div>
      </button>
      {open && (
        <div id={bodyId} className="space-y-4 pl-5">
          {children}
        </div>
      )}
    </div>
  );
}

function CreateTemplateDialog({
  form,
  updateForm,
  onSubmit,
  isSubmitting,
  existingTemplates,
}: DialogProps) {
  // "Plan type" is implicit: a positive Commit Amount means
  // COMMITMENT, leaving it empty means PAY_AS_YOU_GO. The credit
  // rollover dropdown only makes sense in the COMMITMENT+CREDITS
  // quadrant (server CHECK constraint enforces it).
  const isCommitment = (form.commitAmount ?? 0) > 0;
  const isCreditsCommitment = isCommitment && form.billingMode === 'CREDITS';
  // Non-USD contracts MUST pick LOCKED_RATE / SPOT / PERIOD_AVERAGE — the
  // backend rejects a non-NULL fx_policy with USD and a NULL fx_policy
  // with non-USD. Surface the FX picker only when it can actually do
  // something.
  const isMultiCurrency = (form.currency ?? 'USD') !== 'USD';

  // Filter out deprecated rows from the supersedes dropdown — chaining a
  // new template onto an already-deprecated one would be confusing audit
  // trail. Active rows (catalog or custom) are valid supersede targets.
  const supersedesCandidates = existingTemplates.filter((t) => t.isActive);

  return (
    <DialogContent className="sm:max-w-6xl">
      <DialogHeader>
        <DialogTitle>Create Billing Plan</DialogTitle>
        <DialogDescription>
          Templates are immutable once created. To edit, create a new one and pick the old one under{' '}
          <em>Supersedes</em>.
        </DialogDescription>
      </DialogHeader>

      <div className="max-h-[65vh] space-y-8 overflow-auto pr-2 pt-2">
        {/* ── Identity ─────────────────────────────────────────────── */}
        <Section title="Identity" subtitle="What this plan is called internally and on invoices.">
          <Field
            label="Name"
            required
            hint="Internal id — unique, kebab-case, never shown to customers."
          >
            <Input
              value={form.name}
              onChange={(e) => updateForm('name', e.target.value)}
              placeholder='e.g. "clientgamma-q2-2026"'
            />
          </Field>

          <Field label="Display Name" hint="Customer-facing label. Falls back to Name when empty.">
            <Input
              value={form.displayName ?? ''}
              onChange={(e) => updateForm('displayName', e.target.value)}
              placeholder='e.g. "ClientGamma Q2 2026"'
            />
          </Field>

          <Field label="Description" hint="Short operator-only note about this contract.">
            <Input
              value={form.description ?? ''}
              onChange={(e) => updateForm('description', e.target.value)}
              placeholder="e.g. Q2 2026 contract — £1k/mo metered with locked GBP FX"
            />
          </Field>
        </Section>

        {/* ── Plan structure ──────────────────────────────────────── */}
        <Section title="Plan structure" subtitle="How the customer pays and how Stripe collects.">
          <Field
            label="Billing Mode"
            icon={<Receipt className="h-3.5 w-3.5" />}
            hint="CREDITS = prepaid wallet. METERED = invoice at month-end."
          >
            <Select value={form.billingMode} onValueChange={(v) => updateForm('billingMode', v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="CREDITS">CREDITS — prepaid wallet</SelectItem>
                <SelectItem value="METERED">METERED — invoice in arrears</SelectItem>
              </SelectContent>
            </Select>
          </Field>

          <Field label="Collection Method" hint="How Stripe collects the monthly invoice.">
            <Select
              value={form.collectionMethod ?? 'SEND_INVOICE_NET_30'}
              onValueChange={(v) => updateForm('collectionMethod', v)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="AUTO_CARD">AUTO_CARD — charge saved card</SelectItem>
                <SelectItem value="SEND_INVOICE_NET_30">
                  SEND_INVOICE_NET_30 — email NET-30 invoice (wire / customer balance)
                </SelectItem>
              </SelectContent>
            </Select>
          </Field>
        </Section>

        {/* ── Currency & FX ───────────────────────────────────────── */}
        {/*
         * Currency lives here (not under Commitment) because it applies
         * to every plan — a PAYG-METERED plan in GBP still needs an FX
         * policy. FX Policy + Locked Rate only render when the currency
         * is non-USD; for USD plans this section is just the picker.
         */}
        <Section
          title="Currency & FX"
          subtitle={
            isMultiCurrency
              ? `Invoiced in ${form.currency}; pick how USD usage is converted.`
              : 'Invoice currency. Pick GBP/EUR to enable FX.'
          }
        >
          <Field label="Currency" hint="USD = no FX. Other = pick a policy below.">
            <Select value={form.currency ?? 'USD'} onValueChange={(v) => updateForm('currency', v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="USD">USD — no FX</SelectItem>
                <SelectItem value="GBP">GBP — needs FX policy</SelectItem>
                <SelectItem value="EUR">EUR — needs FX policy</SelectItem>
              </SelectContent>
            </Select>
          </Field>

          {isMultiCurrency && (
            <>
              <Field label="FX Policy" hint="When/how USD is converted to invoice currency.">
                <Select
                  value={form.fxPolicy ?? 'SPOT'}
                  onValueChange={(v) => updateForm('fxPolicy', v)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="LOCKED_RATE">LOCKED_RATE — pinned at signing</SelectItem>
                    <SelectItem value="SPOT">SPOT — live rate on invoice date</SelectItem>
                    <SelectItem value="PERIOD_AVERAGE">
                      PERIOD_AVERAGE — daily average over period
                    </SelectItem>
                  </SelectContent>
                </Select>
              </Field>

              {form.fxPolicy === 'LOCKED_RATE' && (
                <Field
                  label={`Locked USD → ${form.currency} rate`}
                  required
                  hint={`${form.currency} per 1 USD. Pinned for the template's lifetime.`}
                >
                  <Input
                    type="number"
                    step="0.00000001"
                    min={0}
                    placeholder="e.g. 0.79"
                    value={form.fxLockedRate ?? ''}
                    onChange={(e) =>
                      updateForm(
                        'fxLockedRate',
                        e.target.value === '' ? null : Number(e.target.value)
                      )
                    }
                  />
                </Field>
              )}
            </>
          )}
        </Section>

        {/* ── Commitment ──────────────────────────────────────────── */}
        {/*
         * Always rendered. Leave Commit Amount empty for a Pay-As-You-Go
         * plan — the period / schedule / rollover fields are then NULLed
         * out before POST so the backend stores a clean PAYG row.
         */}
        <Section title="Commitment" subtitle="Leave amount empty for Pay-As-You-Go.">
          <Field
            label={`Commit Amount (${form.currency ?? 'USD'})`}
            icon={<Coins className="h-3.5 w-3.5" />}
            hint="Periodic minimum charged even on zero usage."
          >
            <Input
              type="number"
              step="0.01"
              min={0}
              value={form.commitAmount ?? ''}
              onChange={(e) =>
                updateForm('commitAmount', e.target.value === '' ? null : Number(e.target.value))
              }
              placeholder="Leave empty for Pay-As-You-Go"
            />
          </Field>

          {isCommitment && (
            <>
              <Field
                label="Commit Period"
                hint="Contract length / renewal cadence. Overage always resets monthly."
              >
                <Select
                  value={form.commitPeriod ?? 'MONTHLY'}
                  onValueChange={(v) => updateForm('commitPeriod', v)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="MONTHLY">MONTHLY</SelectItem>
                    <SelectItem value="QUARTERLY">QUARTERLY</SelectItem>
                    <SelectItem value="ANNUAL">ANNUAL</SelectItem>
                  </SelectContent>
                </Select>
              </Field>

              <Field
                label="Billing Schedule"
                hint="AMORTISED = commit spread monthly. UPFRONT = full commit on day 1."
              >
                <Select
                  value={form.commitSchedule ?? 'AMORTISED'}
                  onValueChange={(v) => updateForm('commitSchedule', v)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="AMORTISED">AMORTISED — billed monthly</SelectItem>
                    <SelectItem value="UPFRONT">UPFRONT — full commit on day 1</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
            </>
          )}

          {isCreditsCommitment && (
            <Field
              label="Credits Rollover Policy"
              hint="What happens to unused credits at period end."
            >
              <Select
                value={form.creditsRolloverPolicy ?? 'FORFEIT_AT_PERIOD_END'}
                onValueChange={(v) => updateForm('creditsRolloverPolicy', v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ROLL_OVER">ROLL_OVER — carry over</SelectItem>
                  <SelectItem value="FORFEIT_AT_PERIOD_END">
                    FORFEIT_AT_PERIOD_END — zero at period end
                  </SelectItem>
                </SelectContent>
              </Select>
            </Field>
          )}
        </Section>

        {/* ── Pricing ─────────────────────────────────────────────── */}
        <Section
          title="Pricing"
          subtitle="Above-commit rate = base × overage. Both default to 1.00× (list price)."
        >
          <Field
            label="Base pricing factor (×)"
            hint="Applies to ALL usage. 0.80× = 20% off, 1.10× = 10% markup."
          >
            <Input
              type="number"
              step="0.01"
              min={0.01}
              value={form.basePricingFactor ?? 1.0}
              onChange={(e) => updateForm('basePricingFactor', Number(e.target.value))}
            />
          </Field>
          <Field
            label="Overage uplift (× over base)"
            hint="Extra multiplier above commit only. 1.00× = no overage penalty."
          >
            <Input
              type="number"
              step="0.01"
              min={0.01}
              disabled={!isCommitment}
              value={form.overagePricingFactor ?? 1.0}
              onChange={(e) => updateForm('overagePricingFactor', Number(e.target.value))}
            />
          </Field>
        </Section>

        {/* ── Catalog ─────────────────────────────────────────────── */}
        <Section title="Catalog" subtitle="Visibility and lineage.">
          <Field label="Catalog placement" hint="Catalog = public; Custom = per-customer bespoke.">
            <Select
              value={form.isCustom ? 'CUSTOM' : 'CATALOG'}
              onValueChange={(v) => updateForm('isCustom', v === 'CUSTOM')}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="CATALOG">Catalog — public</SelectItem>
                <SelectItem value="CUSTOM">Custom — admin-only</SelectItem>
              </SelectContent>
            </Select>
          </Field>

          <Field
            label="Supersedes (optional)"
            hint="The plan this one replaces; sets an audit link."
          >
            <Select
              value={form.supersedesTemplateId == null ? 'NONE' : String(form.supersedesTemplateId)}
              onValueChange={(v) =>
                updateForm('supersedesTemplateId', v === 'NONE' ? null : Number(v))
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="No predecessor" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="NONE">No predecessor</SelectItem>
                {supersedesCandidates.map((t) => (
                  <SelectItem key={t.id} value={String(t.id)}>
                    {t.displayName ?? t.name}
                    <span className="text-muted-foreground">
                      {' '}
                      · {t.billingMode}
                      {(t.commitAmount ?? 0) > 0
                        ? ` · ${money(t.commitAmount, t.currency)}/mo commit`
                        : ' · PAYG'}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </Section>
      </div>

      <DialogFooter>
        <Button onClick={onSubmit} disabled={isSubmitting || !form.name.trim()}>
          {isSubmitting ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
          Create Plan
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
