'use client';

/**
 * OrgPlanSection — admin per-organization billing plan management.
 *
 * Slots into the OrganizationsMain detail panel under the existing
 * "Billing" card. Two read-only readouts + one CTA each:
 *
 *   1. **Plan group** — the self-serve switch catalog the customer
 *      sees on their billing page. Read-only label of the current
 *      group + a "Change group" button that opens a dialog with a
 *      dropdown and a live preview of the selected group's member
 *      templates. Reassigning the group does NOT change the active
 *      plan — operators must use Change plan separately.
 *   2. **Plan** — the active billing template. Read-only label of
 *      the current plan + a "Change plan" button that reuses the
 *      Set-plan dialog (one operation covers every transition:
 *      pristine→template, template→template, return-to-default).
 *
 * The Set-plan flow defaults `effective_at` to the next-month
 * boundary to match the AT_BOUNDARY policy enforced server-side.
 *
 * Plan-history was previously rendered below these two sections;
 * it's been removed in favour of a leaner two-row read-out — the
 * full audit trail still lives on the orchestra side via
 * `GET /admin/billing/plans/history` and is reachable directly via
 * curl when an operator actually needs it.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, ArrowRightLeft, Layers, Loader2, Plus } from 'lucide-react';
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
  DialogFooter,
  DialogDescription,
} from '@/components/UI/dialog';
import type {
  AdminOrgPlanActions,
  AdminBillingPlanTemplate,
  AdminActivePlanResponse,
  AdminPlanGroupSummary,
  AdminPlanGroupDetail,
} from '@/types/admin';

/**
 * Canonical id of the always-present "default" template (seeded by
 * the v2 init migration). Picking this template via Set Plan is
 * how an account "cancels" its current contract.
 */
const DEFAULT_TEMPLATE_ID = 1;

/**
 * Canonical id of the platform-default plan group — every account
 * inherits this group at creation. Mirrors the
 * ``DEFAULT_PLAN_GROUP_ID`` sentinel on the orchestra side.
 */
const DEFAULT_PLAN_GROUP_ID = 1;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isError(result: unknown): result is { detail: string } {
  return typeof result === 'object' && result !== null && 'detail' in result;
}

function formatDate(iso?: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

/**
 * Returns the next-month boundary as an ISO datetime string suitable
 * for `effective_at` defaults — matches the server-side AT_BOUNDARY
 * helper so the UI default is always accepted without explanation.
 */
function defaultEffectiveAt(): string {
  const now = new Date();
  const next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1, 0, 0, 0, 0));
  return next.toISOString();
}

function formatBoundaryForInput(iso: string): string {
  // <input type="datetime-local"> wants `YYYY-MM-DDTHH:mm` (no Z).
  return iso.slice(0, 16);
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface Props {
  orgId: number;
  hasStripeCustomer: boolean;
  actions: AdminOrgPlanActions;
  /** Callback so the parent can refresh the org detail after Stripe-id changes. */
  onAccountUpdated?: () => void;
  /**
   * Callback fired whenever the active plan is loaded or reloaded.
   * Lets the parent panel react to the active plan's billing_mode
   * (e.g. disabling the credits wallet for METERED accounts) without
   * each component duplicating the fetch.
   */
  onActivePlanChange?: (active: AdminActivePlanResponse | null) => void;
  /** Toast handler — reuses the parent's toast state instead of duplicating. */
  notify: (text: string, type?: 'success' | 'error') => void;
  /**
   * Currently-assigned plan_group_id. Always set — every account is
   * on at least the platform-default group (NOT NULL by schema
   * invariant). To revert a custom assignment operators reassign to
   * ``DEFAULT_PLAN_GROUP_ID = 1`` rather than clearing.
   */
  planGroupId: number;
}

const SET_PLAN_BLURB =
  'Set the active plan for this account. One operation covers every transition: ' +
  'first-time assignment, switching templates, or returning to default ' +
  '("cancel"). AT_BOUNDARY is enforced when there is an active plan to close. ' +
  'Idempotent: re-issuing the same template_id is a no-op.';

const CHANGE_GROUP_BLURB =
  'The plan group is the catalog of templates the customer can ' +
  'self-serve switch between on their billing page. Pick a group ' +
  'below to preview its included plans. Reassigning the group does ' +
  'NOT change the active plan — use Change plan to align them.';

// =============================================================================
// Main
// =============================================================================

export default function OrgPlanSection({
  orgId,
  hasStripeCustomer,
  actions,
  onAccountUpdated,
  onActivePlanChange,
  notify,
  planGroupId,
}: Props) {
  // ── Active plan ──────────────────────────────────────────────────────
  const [active, setActive] = useState<AdminActivePlanResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // ── Plan group catalog ───────────────────────────────────────────────
  const [planGroups, setPlanGroups] = useState<AdminPlanGroupSummary[]>([]);
  const [currentGroupId, setCurrentGroupId] = useState<number>(planGroupId);

  useEffect(() => {
    setCurrentGroupId(planGroupId);
  }, [planGroupId]);

  useEffect(() => {
    let cancelled = false;
    actions
      .listPlanGroups({ includeInactive: false })
      .then((result) => {
        if (cancelled) return;
        if (!isError(result)) setPlanGroups(result.groups);
      })
      .catch(() => {
        // The dropdown gracefully degrades to an empty list; the
        // read-only current-group label still shows the id we were
        // handed via props.
      });
    return () => {
      cancelled = true;
    };
  }, [actions]);

  // ── Change-group dialog state ────────────────────────────────────────
  const [changeGroupOpen, setChangeGroupOpen] = useState(false);
  // ``pendingGroupId`` is the dropdown's transient selection (drives
  // the preview pane). Confirm copies it onto ``currentGroupId``.
  const [pendingGroupId, setPendingGroupId] = useState<number | null>(null);
  const [pendingGroupDetail, setPendingGroupDetail] = useState<AdminPlanGroupDetail | null>(null);
  const [loadingPendingDetail, setLoadingPendingDetail] = useState(false);
  const [savingGroup, setSavingGroup] = useState(false);

  const openChangeGroupDialog = () => {
    setPendingGroupId(currentGroupId);
    setPendingGroupDetail(null);
    setChangeGroupOpen(true);
  };

  // Re-fetch the preview whenever the dropdown selection changes
  // (only inside the dialog — the main view doesn't load member
  // detail at all).
  useEffect(() => {
    if (!changeGroupOpen || pendingGroupId === null) {
      setPendingGroupDetail(null);
      return;
    }
    let cancelled = false;
    setLoadingPendingDetail(true);
    actions
      .getPlanGroup(pendingGroupId)
      .then((result) => {
        if (cancelled) return;
        if (isError(result)) {
          setPendingGroupDetail(null);
          notify(result.detail, 'error');
          return;
        }
        setPendingGroupDetail(result as AdminPlanGroupDetail);
      })
      .catch(() => {
        if (!cancelled) setPendingGroupDetail(null);
      })
      .finally(() => {
        if (!cancelled) setLoadingPendingDetail(false);
      });
    return () => {
      cancelled = true;
    };
  }, [actions, changeGroupOpen, pendingGroupId, notify]);

  const handleConfirmGroupChange = useCallback(async () => {
    if (pendingGroupId === null) return;
    setSavingGroup(true);
    const result = await actions.assignPlanGroupToOrg(orgId, pendingGroupId);
    setSavingGroup(false);
    if (isError(result)) {
      notify(result.detail, 'error');
      return;
    }
    setCurrentGroupId(result.planGroupId);
    notify(`Plan group set to ${result.planGroupName ?? pendingGroupId}`);
    setChangeGroupOpen(false);
    onAccountUpdated?.();
  }, [actions, orgId, pendingGroupId, notify, onAccountUpdated]);

  // ── Templates (lazily loaded for the Set-plan dialog) ────────────────
  const [templates, setTemplates] = useState<AdminBillingPlanTemplate[]>([]);
  const [templatesLoaded, setTemplatesLoaded] = useState(false);

  // ── Set-plan dialog state ────────────────────────────────────────────
  const [setPlanOpen, setSetPlanOpen] = useState(false);
  const [opTemplateId, setOpTemplateId] = useState<string>('');
  const [opEffectiveAt, setOpEffectiveAt] = useState<string>(
    formatBoundaryForInput(defaultEffectiveAt())
  );
  const [opReason, setOpReason] = useState<string>('');
  const [isSubmittingOp, setIsSubmittingOp] = useState(false);

  // ── Loaders ──────────────────────────────────────────────────────────
  const refresh = useCallback(async () => {
    setIsLoading(true);
    const activeResult = await actions.getActivePlan(orgId);
    if (isError(activeResult)) {
      notify(activeResult.detail, 'error');
      setActive(null);
      onActivePlanChange?.(null);
    } else {
      const next = activeResult as AdminActivePlanResponse;
      setActive(next);
      onActivePlanChange?.(next);
    }
    setIsLoading(false);
  }, [actions, orgId, notify, onActivePlanChange]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const loadTemplates = useCallback(async () => {
    if (templatesLoaded) return;
    // Both catalog (is_custom=false) and bespoke (is_custom=true) templates
    // are assignable. Deprecated rows (is_active=false) are filtered server-side
    // by default so we don't need to pass `include_inactive`.
    const result = await actions.listTemplatesForAssignment();
    if (isError(result)) {
      notify(result.detail, 'error');
      return;
    }
    setTemplates(result as AdminBillingPlanTemplate[]);
    setTemplatesLoaded(true);
  }, [actions, templatesLoaded, notify]);

  // ── Set-plan handlers ────────────────────────────────────────────────

  /**
   * Open the Set-Plan dialog. Returning to the default template
   * (i.e. "cancelling" the active contract) is achieved by picking
   * the default row from the template dropdown — same code path as
   * any other plan switch.
   */
  const openSetPlan = () => {
    setOpTemplateId('');
    setOpReason('');
    setOpEffectiveAt(formatBoundaryForInput(defaultEffectiveAt()));
    setSetPlanOpen(true);
    loadTemplates();
  };

  const handleSubmitOp = async () => {
    if (!opTemplateId) {
      notify('Pick a template', 'error');
      return;
    }
    const templateId = Number(opTemplateId);
    const effectiveAtIso = new Date(opEffectiveAt + ':00Z').toISOString();
    setIsSubmittingOp(true);
    // No auto-create-stripe escape any more: the parent's Business
    // Profile + Provision flow guarantees a Stripe Customer exists
    // before the operator gets to assign a METERED template here.
    const result = await actions.setPlan(orgId, templateId, {
      effectiveAt: effectiveAtIso,
      changeReason: opReason || undefined,
    });
    if (isError(result)) {
      notify(result.detail, 'error');
    } else {
      const status = (result as { status?: string }).status;
      notify(status === 'noop' ? 'No change — account already on this template' : 'Plan updated');
      setSetPlanOpen(false);
      refresh();
      onAccountUpdated?.();
    }
    setIsSubmittingOp(false);
  };

  // ── Render ──────────────────────────────────────────────────────────

  const activeAssignment = active?.activeAssignment ?? null;
  const isMetered = activeAssignment?.templateBillingMode === 'METERED';
  const isOnDefault = activeAssignment?.templateId === DEFAULT_TEMPLATE_ID;

  const currentGroup = planGroups.find((g) => g.id === currentGroupId) ?? null;
  const currentGroupLabel =
    currentGroup?.displayName ?? currentGroup?.name ?? `id=${currentGroupId}`;

  // Whether the *previewed* group's members include the account's
  // active template — drives the in-dialog warning. We deliberately
  // do NOT show this warning for the platform-default group (id=1):
  // it's the canonical "park here" assignment for accounts on
  // bespoke / enterprise templates, where a mismatch is expected.
  const previewMembers = pendingGroupDetail?.members ?? [];
  const previewMissesCurrentPlan =
    pendingGroupDetail !== null &&
    pendingGroupDetail.id !== DEFAULT_PLAN_GROUP_ID &&
    activeAssignment !== null &&
    !previewMembers.some((m) => m.templateId === activeAssignment.templateId);

  return (
    <>
      <div className="space-y-3">
        {/* ── 1. Plan group ───────────────────────────────────────── */}
        <div className="rounded-md border border-border px-2.5 py-2">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <Label className="text-label-muted flex items-center gap-1.5">
                <Layers className="h-3 w-3" />
                Plan group
              </Label>
              <p className="text-body-sm mt-0.5 flex items-center gap-2 font-medium">
                <span className="truncate">{currentGroupLabel}</span>
                {currentGroupId === DEFAULT_PLAN_GROUP_ID && (
                  <Badge
                    variant="outline"
                    className="text-[10px] uppercase"
                    title="System default — auto-applied to every new account"
                  >
                    Default
                  </Badge>
                )}
                {currentGroup && (
                  <span className="text-caption">
                    · {currentGroup.memberCount} plan
                    {currentGroup.memberCount === 1 ? '' : 's'}
                  </span>
                )}
              </p>
            </div>
            <Button size="sm" variant="outline" onClick={openChangeGroupDialog}>
              <ArrowRightLeft className="mr-1.5 h-3.5 w-3.5" />
              Change group
            </Button>
          </div>
        </div>

        {/* ── 2. Plan ─────────────────────────────────────────────── */}
        <div className="rounded-md border border-border px-2.5 py-2">
          {isLoading && !active ? (
            <div className="flex items-center justify-center py-3">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <Label className="text-label-muted">Plan</Label>
                <p className="text-body-sm mt-0.5 truncate font-medium">
                  {activeAssignment?.templateName ?? 'default'}
                </p>
                <div className="text-caption mt-0.5 flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className="text-xs">
                    {activeAssignment?.templatePlanType ?? 'PAY_AS_YOU_GO'}
                  </Badge>
                  <Badge
                    className={`text-xs ${
                      isMetered
                        ? 'bg-[color:var(--status-info-bg)] text-[color:var(--status-info)]'
                        : 'bg-[color:var(--status-warning-bg)] text-[color:var(--status-warning)]'
                    }`}
                  >
                    {activeAssignment?.templateBillingMode ?? 'CREDITS'}
                  </Badge>
                  {activeAssignment?.startedAt && (
                    <span>
                      since {formatDate(activeAssignment.startedAt)}
                      {activeAssignment.endedAt
                        ? ` (ends ${formatDate(activeAssignment.endedAt)})`
                        : ''}
                    </span>
                  )}
                </div>
              </div>
              <Button size="sm" variant="outline" onClick={() => openSetPlan()}>
                {isOnDefault ? (
                  <Plus className="mr-1.5 h-3.5 w-3.5" />
                ) : (
                  <ArrowRightLeft className="mr-1.5 h-3.5 w-3.5" />
                )}
                Change plan
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* ── Change Group dialog ────────────────────────────────────── */}
      <Dialog open={changeGroupOpen} onOpenChange={setChangeGroupOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Change plan group</DialogTitle>
            <DialogDescription>{CHANGE_GROUP_BLURB}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label className="text-label-muted">Plan group</Label>
              <Select
                value={pendingGroupId === null ? '' : String(pendingGroupId)}
                onValueChange={(v) => setPendingGroupId(Number(v))}
              >
                <SelectTrigger className="mt-1.5">
                  <SelectValue placeholder="Pick a group…" />
                </SelectTrigger>
                <SelectContent>
                  {planGroups.map((g) => (
                    <SelectItem key={g.id} value={String(g.id)}>
                      {g.displayName ?? g.name} ({g.memberCount})
                      {g.id === DEFAULT_PLAN_GROUP_ID ? ' · Default' : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Preview pane — included plans for the selected group */}
            <div>
              <Label className="text-label-muted">Included plans</Label>
              <div className="bg-muted/30 mt-1.5 rounded-md border border-border px-2.5 py-2">
                {loadingPendingDetail ? (
                  <div className="flex items-center justify-center py-3">
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  </div>
                ) : pendingGroupDetail === null ? (
                  <p className="text-caption">Pick a group to preview its plans.</p>
                ) : pendingGroupDetail.members.length === 0 ? (
                  <p className="text-caption">
                    This group has no member plans. Customers assigned to it won&apos;t see any
                    self-serve switch options.
                  </p>
                ) : (
                  <ul className="space-y-1">
                    {pendingGroupDetail.members.map((m) => {
                      const isCurrent = activeAssignment?.templateId === m.templateId;
                      return (
                        <li
                          key={m.templateId}
                          className="text-body-sm flex items-center justify-between gap-2"
                        >
                          <span className="flex min-w-0 items-center gap-2">
                            <span className="truncate font-medium">{m.templateDisplayName}</span>
                            <span className="text-caption truncate font-mono">
                              {m.templateName}
                            </span>
                          </span>
                          {isCurrent && (
                            <Badge variant="outline" className="text-[10px]">
                              Current
                            </Badge>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </div>

            {previewMissesCurrentPlan && activeAssignment && (
              <div className="text-caption border-[color:var(--status-warning)]/25 flex items-start gap-1.5 rounded-md border bg-[color:var(--status-warning-bg)] px-2 py-1.5 text-[color:var(--status-warning)]">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
                <span>
                  The account&apos;s current plan <strong>{activeAssignment.templateName}</strong>{' '}
                  is not part of this group. The customer&apos;s self-serve switcher will stay
                  hidden until you also use <strong>Change plan</strong> to assign one of the
                  included plans listed above.
                </span>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setChangeGroupOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleConfirmGroupChange}
              disabled={savingGroup || pendingGroupId === null || pendingGroupId === currentGroupId}
            >
              {savingGroup && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
              Confirm change
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Set Plan dialog ──────────────────────────────────────────── */}
      <Dialog open={setPlanOpen} onOpenChange={setSetPlanOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {Number(opTemplateId) === DEFAULT_TEMPLATE_ID
                ? 'Return to default plan'
                : 'Change plan'}
            </DialogTitle>
            <DialogDescription>{SET_PLAN_BLURB}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label className="text-label-muted">Template</Label>
              <Select value={opTemplateId} onValueChange={setOpTemplateId}>
                <SelectTrigger className="mt-1.5">
                  <SelectValue placeholder="Pick a template…" />
                </SelectTrigger>
                <SelectContent>
                  {templates.map((t) => {
                    const derivedType =
                      t.commitAmount != null && t.commitAmount > 0 ? 'COMMITMENT' : 'PAY_AS_YOU_GO';
                    const label = t.displayName ?? t.name;
                    return (
                      <SelectItem key={t.id} value={String(t.id)}>
                        {label} · {t.billingMode} · {derivedType}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-label-muted">Effective At (UTC, midnight on 1st)</Label>
              <Input
                type="datetime-local"
                value={opEffectiveAt}
                onChange={(e) => setOpEffectiveAt(e.target.value)}
                className="mt-1.5"
              />
            </div>
            <div>
              <Label className="text-label-muted">
                Reason (recommended — appears in plan history)
              </Label>
              <Input
                value={opReason}
                onChange={(e) => setOpReason(e.target.value)}
                placeholder={
                  Number(opTemplateId) === DEFAULT_TEMPLATE_ID
                    ? 'e.g. Contract not renewed, customer churned'
                    : 'e.g. Q2 contract renewal'
                }
                className="mt-1.5"
              />
            </div>
            {(() => {
              const selected = templates.find((t) => String(t.id) === opTemplateId);
              const meteredBlocked =
                !!selected && selected.billingMode === 'METERED' && !hasStripeCustomer;
              if (!meteredBlocked) return null;
              return (
                <div className="border-destructive/40 bg-destructive/5 rounded-md border p-2.5 text-sm">
                  <div className="font-medium text-destructive">
                    Stripe Customer required for METERED templates
                  </div>
                  <p className="text-caption mt-0.5">
                    Provision the Stripe Customer from the <strong>Billing</strong> section first
                    (after curating the Business Profile). The invoicer needs a Customer to attach
                    monthly invoices to.
                  </p>
                </div>
              );
            })()}
          </div>
          <DialogFooter>
            <Button
              onClick={handleSubmitOp}
              disabled={(() => {
                if (isSubmittingOp || !opTemplateId) return true;
                const selected = templates.find((t) => String(t.id) === opTemplateId);
                if (selected && selected.billingMode === 'METERED' && !hasStripeCustomer) {
                  return true;
                }
                return false;
              })()}
            >
              {isSubmittingOp ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
              Set
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
