'use client';

/**
 * Admin Organizations Dashboard
 *
 * Client component for the /admin/organizations page.
 * Provides a centralized UI for Unify admins to:
 *  - Browse / search organizations
 *  - Create organizations on behalf of users (dialog)
 *  - Toggle free trial & verification
 *  - Manage billing (credits, freeze)
 *  - Invite users to an organization & view pending invites
 */

import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { showToast as toast } from '@/components/Common/Toasts/notifications';
import {
  Search,
  Plus,
  ChevronDown,
  ChevronRight,
  X,
  Loader2,
  Building2,
  ShieldCheck,
  FlaskConical,
  Snowflake,
  User,
  RefreshCw,
  Mail,
  Clock,
  AlertTriangle,
  CreditCard,
  CheckCircle2,
  Coins,
} from 'lucide-react';
import { Loader } from '@/components/Common/Loader';
import { Button } from '@/components/UI/button';
import { Input } from '@/components/UI/input';
import { Badge } from '@/components/UI/badge';
import { Switch } from '@/components/UI/switch';
import { Label } from '@/components/UI/label';
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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/UI/tooltip';
import type {
  AdminOnboardingActions,
  AdminOrgListItem,
  AdminOrgDetail,
  AdminUserLookup,
  AdminOrgInvite,
  AdminOrgPlanActions,
  AdminActivePlanResponse,
  AdminBillingProfile,
} from '@/types/admin';
import OrgPlanSection from '@/components/Pages/Admin/OrgPlanSection';
import { isImeComposing } from '@/utils/keyboard';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface OrganizationsAdminMainProps {
  actions: AdminOnboardingActions;
  /**
   * Managed-billing plan actions, threaded through to OrgPlanSection.
   * Optional so the Organizations page keeps working without the plan
   * UI wired up (e.g. during partial deploys).
   */
  planActions?: AdminOrgPlanActions;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isError(result: unknown): result is { detail: string } {
  return typeof result === 'object' && result !== null && 'detail' in result;
}

function formatDate(iso?: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

/** Skeleton profile used to seed the edit dialog when the org has none yet. */
const EMPTY_PROFILE: AdminBillingProfile = {
  billingEmail: null,
  name: null,
  taxId: null,
  taxIdType: null,
  billingAddress: { line1: '', line2: '', city: '', state: '', postalCode: '', country: '' },
};

/**
 * Render a one-line summary of a postal address for the read-only
 * display of the Business Profile section. Empty parts are skipped
 * and pieces are joined with ", " so partial addresses still read
 * naturally.
 */
function formatAddressLine(addr: AdminBillingProfile['billingAddress']): string {
  const parts = [
    [addr.line1, addr.line2].filter(Boolean).join(' '),
    addr.city,
    [addr.state, addr.postalCode].filter(Boolean).join(' '),
    addr.country,
  ].filter((p): p is string => !!p && p.trim().length > 0);
  return parts.join(', ');
}

/**
 * Returns true when the profile has the absolute minimum data we
 * need to provision a Stripe Customer (just an email — see
 * ``ensure_stripe_customer`` in lib/billing.py). Anything beyond
 * that produces a more complete Stripe Customer / invoice but is
 * not technically required.
 */
function profileMeetsProvisioningMinimum(profile: AdminBillingProfile): boolean {
  return !!profile.billingEmail && profile.billingEmail.trim().length > 0;
}

// ---------------------------------------------------------------------------
// Foldable section
//
// Same shape as the helper used in BillingPlansMain so the admin pages
// feel like one product. Heading reads as section nav (uppercase
// label), the chevron rotates to indicate state, and the body indents
// slightly so collapsed groups don't visually merge.
// ---------------------------------------------------------------------------

function Section({
  title,
  subtitle,
  right,
  children,
  defaultOpen = true,
}: {
  title: string;
  subtitle?: string;
  /** Optional trailing slot rendered on the right of the header (e.g. a Badge). */
  right?: React.ReactNode;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const bodyId = useMemo(
    () => `org-section-${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
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
        {right && <div className="shrink-0">{right}</div>}
      </button>
      {open && (
        <div id={bodyId} className="space-y-4 pl-5">
          {children}
        </div>
      )}
    </div>
  );
}

// =============================================================================
// Main Component
// =============================================================================

export default function OrganizationsAdminMain({
  actions,
  planActions,
}: OrganizationsAdminMainProps) {
  // ── Organization list state ──────────────────────────────────────────
  const [orgs, setOrgs] = useState<AdminOrgListItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoadingOrgs, setIsLoadingOrgs] = useState(false);

  // ── Detail panel state ───────────────────────────────────────────────
  const [selectedOrgId, setSelectedOrgId] = useState<number | null>(null);
  const [orgDetail, setOrgDetail] = useState<AdminOrgDetail | null>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);

  // ── Create org dialog state ──────────────────────────────────────────
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [lookupEmail, setLookupEmail] = useState('');
  const [lookupResult, setLookupResult] = useState<AdminUserLookup | null>(null);
  const [isLookingUp, setIsLookingUp] = useState(false);
  const [newOrgName, setNewOrgName] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  // ── Invite form + invite list state ──────────────────────────────────
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRoleName, setInviteRoleName] = useState('Member');
  const [isInviting, setIsInviting] = useState(false);
  const [invites, setInvites] = useState<AdminOrgInvite[]>([]);
  const [isLoadingInvites, setIsLoadingInvites] = useState(false);

  // ── Credit dialog state ──────────────────────────────────────────────
  const [creditDialogOpen, setCreditDialogOpen] = useState(false);
  const [creditAmount, setCreditAmount] = useState('');
  const [creditType, setCreditType] = useState<'promo' | 'payment'>('promo');
  const [isAddingCredits, setIsAddingCredits] = useState(false);

  // ── Freeze confirmation dialog state ─────────────────────────────────
  const [freezeDialogOpen, setFreezeDialogOpen] = useState(false);
  const [isTogglingFreeze, setIsTogglingFreeze] = useState(false);

  // ── Loading states for toggles ───────────────────────────────────────
  const [isTogglingFreeTrial, setIsTogglingFreeTrial] = useState(false);
  const [isTogglingVerified, setIsTogglingVerified] = useState(false);

  // ── Active plan (lifted from OrgPlanSection) ─────────────────────────
  // We need to know the active plan's billing_mode here so the Credits
  // row can disable "Add Credits" for METERED accounts (the credits
  // wallet isn't consumed by metered usage; pouring promo credits in
  // would just sit there and confuse operators). OrgPlanSection still
  // owns the fetch — it just calls back so we don't double-load.
  const [activePlan, setActivePlan] = useState<AdminActivePlanResponse | null>(null);

  // ── Stripe customer provisioning ─────────────────────────────────────
  // Lives in the Billing section (alongside the credits wallet) rather
  // than the Plan section: a Stripe Customer is a payment-side concern
  // that exists independently of which template is active.
  const [stripeBusy, setStripeBusy] = useState(false);
  const [provisionConfirmOpen, setProvisionConfirmOpen] = useState(false);

  // ── Business profile editing ─────────────────────────────────────────
  // Edit dialog is intentionally separate from the Provision flow:
  // operators may want to update the profile mid-contract (e.g. when
  // a customer changes address) without re-creating the Stripe
  // Customer. Provision then becomes a thin "create the Stripe side
  // from the current profile" step with a confirmation gate.
  const [profileDialogOpen, setProfileDialogOpen] = useState(false);
  const [profileForm, setProfileForm] = useState<AdminBillingProfile>(EMPTY_PROFILE);
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  // ── Fetch organizations ──────────────────────────────────────────────
  const fetchOrgs = useCallback(
    async (filter?: string) => {
      setIsLoadingOrgs(true);
      const result = await actions.listOrganizations(filter || undefined);
      if (isError(result)) {
        toast(result.detail, 'error');
      } else {
        setOrgs(result.organizations ?? []);
      }
      setIsLoadingOrgs(false);
    },
    [actions]
  );

  // Initial load
  useEffect(() => {
    fetchOrgs();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Debounced search
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => fetchOrgs(value), 300);
  };

  // ── Fetch org detail ─────────────────────────────────────────────────
  const fetchDetail = useCallback(
    async (orgId: number) => {
      setIsLoadingDetail(true);
      const result = await actions.getOrganizationDetail(orgId);
      if (isError(result)) {
        toast(result.detail, 'error');
        setOrgDetail(null);
      } else {
        setOrgDetail(result as AdminOrgDetail);
      }
      setIsLoadingDetail(false);
    },
    [actions]
  );

  // ── Fetch invites ────────────────────────────────────────────────────
  const fetchInvites = useCallback(
    async (orgId: number) => {
      setIsLoadingInvites(true);
      const result = await actions.listOrgInvites(orgId);
      if (isError(result)) {
        setInvites([]);
      } else {
        setInvites(result as AdminOrgInvite[]);
      }
      setIsLoadingInvites(false);
    },
    [actions]
  );

  const selectOrg = (orgId: number) => {
    setSelectedOrgId(orgId);
    setInviteEmail('');
    setInvites([]);
    setActivePlan(null);
    fetchDetail(orgId);
    fetchInvites(orgId);
  };

  const closeDetail = () => {
    setSelectedOrgId(null);
    setOrgDetail(null);
    setInviteEmail('');
    setInvites([]);
    setActivePlan(null);
  };

  // ── User lookup ──────────────────────────────────────────────────────
  const handleLookup = async () => {
    if (!lookupEmail.trim()) return;
    setIsLookingUp(true);
    setLookupResult(null);
    const result = await actions.lookupUserByEmail(lookupEmail.trim());
    if (isError(result)) {
      toast(`User not found: ${lookupEmail}`, 'error');
    } else {
      setLookupResult(result as AdminUserLookup);
    }
    setIsLookingUp(false);
  };

  // ── Create org ───────────────────────────────────────────────────────
  const handleCreateOrg = async () => {
    if (!lookupResult || !newOrgName.trim()) return;
    setIsCreating(true);
    const result = await actions.createOrganizationForUser(newOrgName.trim(), lookupResult.id);
    if (isError(result)) {
      toast(result.detail, 'error');
    } else {
      toast(`Organization "${newOrgName}" created successfully`);
      setNewOrgName('');
      setLookupResult(null);
      setLookupEmail('');
      setCreateDialogOpen(false);
      fetchOrgs(searchQuery);
    }
    setIsCreating(false);
  };

  const handleCreateDialogOpenChange = (open: boolean) => {
    setCreateDialogOpen(open);
    if (!open) {
      setLookupEmail('');
      setLookupResult(null);
      setNewOrgName('');
    }
  };

  // ── Invite user ─────────────────────────────────────────────────────
  const handleInviteUser = async () => {
    if (!orgDetail || !inviteEmail.trim()) return;
    const trimmed = inviteEmail.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      toast('Please enter a valid email address', 'error');
      return;
    }
    setIsInviting(true);
    const result = await actions.inviteUserToOrg(
      orgDetail.id,
      trimmed,
      undefined,
      inviteRoleName !== 'Member' ? inviteRoleName : undefined
    );
    if (isError(result)) {
      toast(result.detail, 'error');
    } else {
      toast(`Invite sent to ${trimmed} as ${inviteRoleName}`);
      setInviteEmail('');
      setInviteRoleName('Member');
      fetchInvites(orgDetail.id);
      fetchDetail(orgDetail.id);
    }
    setIsInviting(false);
  };

  // ── Free trial toggle ───────────────────────────────────────────────
  const handleFreeTrialToggle = async (enabled: boolean) => {
    if (!orgDetail) return;
    setIsTogglingFreeTrial(true);
    const result = enabled
      ? await actions.enableFreeTrial(orgDetail.id)
      : await actions.disableFreeTrial(orgDetail.id);
    if (isError(result)) {
      toast(result.detail, 'error');
    } else {
      toast(`Free trial ${enabled ? 'enabled' : 'disabled'}`);
      fetchDetail(orgDetail.id);
      fetchOrgs(searchQuery);
    }
    setIsTogglingFreeTrial(false);
  };

  // ── Verification toggle ──────────────────────────────────────────────
  const handleVerifiedToggle = async (verified: boolean) => {
    if (!orgDetail) return;
    setIsTogglingVerified(true);
    const result = verified
      ? await actions.verifyOrganization(orgDetail.id)
      : await actions.unverifyOrganization(orgDetail.id);
    if (isError(result)) {
      toast(result.detail, 'error');
    } else {
      toast(`Organization ${verified ? 'verified' : 'unverified'}`);
      fetchDetail(orgDetail.id);
    }
    setIsTogglingVerified(false);
  };

  // ── Add credits ──────────────────────────────────────────────────────
  const handleAddCredits = async () => {
    if (!orgDetail || !creditAmount) return;
    const amount = parseFloat(creditAmount);
    if (isNaN(amount) || amount <= 0) {
      toast('Enter a valid positive amount', 'error');
      return;
    }
    setIsAddingCredits(true);
    const result = await actions.addCredits(orgDetail.id, amount, creditType);
    if (isError(result)) {
      toast(result.detail, 'error');
    } else {
      toast(`${amount} ${creditType} credits added`);
      setCreditAmount('');
      setCreditType('promo');
      setCreditDialogOpen(false);
      fetchDetail(orgDetail.id);
    }
    setIsAddingCredits(false);
  };

  const handleCreditDialogOpenChange = (open: boolean) => {
    setCreditDialogOpen(open);
    if (!open) {
      setCreditAmount('');
      setCreditType('promo');
    }
  };

  // ── Business profile editing ────────────────────────────────────────
  const openProfileDialog = () => {
    if (!orgDetail) return;
    // Seed the form from the current profile (deep copy of the
    // address so edits don't mutate the prop).
    setProfileForm({
      ...orgDetail.billingProfile,
      billingAddress: { ...orgDetail.billingProfile.billingAddress },
    });
    setProfileDialogOpen(true);
  };

  const handleSaveProfile = async () => {
    if (!orgDetail) return;
    setIsSavingProfile(true);
    const result = await actions.updateBillingProfile(orgDetail.id, {
      billingEmail: profileForm.billingEmail ?? null,
      name: profileForm.name ?? null,
      taxId: profileForm.taxId ?? null,
      taxIdType: profileForm.taxIdType ?? null,
      billingAddress: profileForm.billingAddress,
    });
    if (isError(result)) {
      toast(result.detail, 'error');
    } else {
      toast(
        orgDetail.stripeCustomerId ? 'Profile updated and synced to Stripe' : 'Profile updated'
      );
      setProfileDialogOpen(false);
      fetchDetail(orgDetail.id);
    }
    setIsSavingProfile(false);
  };

  // ── Ensure Stripe customer ──────────────────────────────────────────
  // The Provision button opens a confirmation dialog (handled in JSX);
  // this handler runs once the operator confirms. No body — the
  // backend reads ``billing_email`` etc. directly off the BillingAccount,
  // which the operator has already curated via the Business Profile
  // section.
  const handleEnsureStripeCustomer = async () => {
    if (!orgDetail || !planActions) return;
    setStripeBusy(true);
    const result = await planActions.ensureStripeCustomer(orgDetail.id, { isBusiness: true });
    if (isError(result)) {
      toast(result.detail, 'error');
    } else {
      const r = result as { stripeCustomerId: string; created: boolean };
      toast(
        r.created
          ? `Created Stripe Customer ${r.stripeCustomerId}`
          : `Stripe Customer already set: ${r.stripeCustomerId}`
      );
      setProvisionConfirmOpen(false);
      fetchDetail(orgDetail.id);
    }
    setStripeBusy(false);
  };

  // ── Freeze / unfreeze ────────────────────────────────────────────────
  const handleToggleFreeze = async () => {
    if (!orgDetail) return;
    const shouldFreeze = orgDetail.accountStatus !== 'SUSPENDED';
    setIsTogglingFreeze(true);
    const result = await actions.freezeAccount(orgDetail.id, shouldFreeze);
    if (isError(result)) {
      toast(result.detail, 'error');
    } else {
      toast(`Account ${shouldFreeze ? 'frozen' : 'unfrozen'}`);
      setFreezeDialogOpen(false);
      fetchDetail(orgDetail.id);
    }
    setIsTogglingFreeze(false);
  };

  // =====================================================================
  // Render
  // =====================================================================

  const isFrozen = orgDetail?.accountStatus === 'SUSPENDED';
  const isMetered = activePlan?.activeAssignment?.templateBillingMode === 'METERED';

  return (
    <div className="flex h-full min-w-0">
      {/* ── Left: Org list ───────────────────────────────────────────── */}
      <div
        className={`flex h-full min-w-0 flex-col border-r border-border ${
          selectedOrgId ? 'w-1/3 min-w-0' : 'w-full'
        } transition-all`}
      >
        {/* Header */}
        <div className="flex items-center justify-end border-b border-border px-4 py-3">
          <Dialog open={createDialogOpen} onOpenChange={handleCreateDialogOpenChange}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                <Plus className="mr-1.5 h-3.5 w-3.5" />
                Create Org
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Create Organization for User</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-2">
                {/* Step 1: Look up user by email */}
                <div>
                  <Label className="text-label-muted">Step 1: Find user by email</Label>
                  <div className="mt-1.5 flex gap-2">
                    <Input
                      placeholder="User email…"
                      value={lookupEmail}
                      onChange={(e) => setLookupEmail(e.target.value)}
                      onKeyDown={(e) => !isImeComposing(e) && e.key === 'Enter' && handleLookup()}
                      className="flex-1"
                    />
                    <Button
                      size="sm"
                      onClick={handleLookup}
                      disabled={isLookingUp || !lookupEmail.trim()}
                    >
                      {isLookingUp ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Look up'}
                    </Button>
                  </div>
                </div>

                {/* User found */}
                {lookupResult && (
                  <>
                    <div className="bg-muted/30 flex items-center gap-2 rounded-md border border-border p-2.5 text-sm">
                      <User className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">
                          {lookupResult.name}
                          {lookupResult.lastName ? ` ${lookupResult.lastName}` : ''}
                        </p>
                        <p className="text-caption truncate">{lookupResult.email}</p>
                        {lookupResult.organizations && lookupResult.organizations.length > 0 && (
                          <p className="mt-0.5 text-xs text-[color:var(--status-warning)]">
                            Already in: {lookupResult.organizations.map((o) => o.name).join(', ')}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Step 2: Org name */}
                    <div>
                      <Label className="text-label-muted">Step 2: Organization name</Label>
                      <div className="mt-1.5 flex gap-2">
                        <Input
                          placeholder="Organization name…"
                          value={newOrgName}
                          onChange={(e) => setNewOrgName(e.target.value)}
                          onKeyDown={(e) =>
                            !isImeComposing(e) && e.key === 'Enter' && handleCreateOrg()
                          }
                          className="flex-1"
                        />
                        <Button
                          size="sm"
                          onClick={handleCreateOrg}
                          disabled={isCreating || !newOrgName.trim()}
                        >
                          {isCreating ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Create'}
                        </Button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Search */}
        <div className="border-b border-border px-4 py-2">
          <div className="relative max-w-xs">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search organizations…"
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        {/* Org table */}
        <div className="min-h-0 min-w-0 flex-1 overflow-auto">
          {isLoadingOrgs ? (
            <div className="flex items-center justify-center py-12">
              <Loader size={24} />
            </div>
          ) : orgs.length === 0 ? (
            <div className="text-body-muted py-12 text-center">No organizations found</div>
          ) : (
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="text-caption border-b border-border text-left">
                  <th className="px-4 py-2 font-medium">Name</th>
                  <th className="px-4 py-2 font-medium">Members</th>
                  <th className="px-4 py-2 font-medium">Created</th>
                  <th className="w-8 px-4 py-2 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {orgs.map((org) => (
                  <tr
                    key={org.id}
                    onClick={() => selectOrg(org.id)}
                    className={`hover:bg-muted/50 cursor-pointer border-b border-border transition-colors ${
                      selectedOrgId === org.id ? 'bg-muted/70' : ''
                    }`}
                  >
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <Building2 className="h-4 w-4 shrink-0 text-muted-foreground" />
                        <span className="font-medium">{org.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground">{org.memberCount}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">
                      {formatDate(org.createdAt)}
                    </td>
                    <td className="px-4 py-2.5">
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* ── Right: Detail panel (2/3 width) ──────────────────────────── */}
      {selectedOrgId && (
        <div className="flex h-full w-2/3 min-w-0 flex-col overflow-auto">
          {/* Detail header */}
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <h2 className="text-h3 text-semibold">{orgDetail?.name ?? 'Loading…'}</h2>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  fetchDetail(selectedOrgId);
                  fetchInvites(selectedOrgId);
                  fetchOrgs(searchQuery);
                }}
                disabled={isLoadingDetail}
              >
                <RefreshCw className={`h-3.5 w-3.5 ${isLoadingDetail ? 'animate-spin' : ''}`} />
              </Button>
              <Button variant="ghost" size="sm" onClick={closeDetail}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {isLoadingDetail && !orgDetail ? (
            <div className="flex flex-1 items-center justify-center">
              <Loader size={24} />
            </div>
          ) : orgDetail ? (
            <TooltipProvider delayDuration={150}>
              <div className="flex-1 space-y-6 overflow-auto p-5">
                {/* ── Overview ──────────────────────────────────── */}
                <Section title="Overview" subtitle="Identifiers, ownership, and basic counts.">
                  <dl className="grid grid-cols-[8rem_1fr] gap-y-1.5 text-sm">
                    <dt className="text-muted-foreground">ID</dt>
                    <dd className="font-mono">{orgDetail.id}</dd>
                    <dt className="text-muted-foreground">Owner</dt>
                    <dd className="truncate">{orgDetail.ownerEmail || orgDetail.ownerId}</dd>
                    <dt className="text-muted-foreground">Members</dt>
                    <dd>{orgDetail.memberCount}</dd>
                    <dt className="text-muted-foreground">Created</dt>
                    <dd>{formatDate(orgDetail.createdAt)}</dd>
                  </dl>
                </Section>

                {/* ── Status & flags ────────────────────────────── */}
                <Section
                  title="Status & flags"
                  subtitle="Account lifecycle and per-org capability flags."
                  right={
                    isFrozen ? (
                      <Badge variant="destructive" className="text-xs">
                        Suspended
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="text-xs">
                        Active
                      </Badge>
                    )
                  }
                >
                  {/* Free Trial */}
                  <div className="flex items-center justify-between rounded-md border border-border px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      <FlaskConical className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <Label className="text-title">Free Trial</Label>
                        <p className="text-caption">Hides billing & usage pages for org members</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {orgDetail.freeTrial && (
                        <Badge variant="secondary" className="text-xs">
                          Active
                        </Badge>
                      )}
                      {isTogglingFreeTrial ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Switch
                          checked={orgDetail.freeTrial}
                          onCheckedChange={handleFreeTrialToggle}
                        />
                      )}
                    </div>
                  </div>

                  {/* Verified */}
                  <div className="flex items-center justify-between rounded-md border border-border px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <Label className="text-title">Verified</Label>
                        <p className="text-caption">
                          Higher rate limits for verified orgs
                          {orgDetail.verifiedAt && (
                            <> · Verified {formatDate(orgDetail.verifiedAt)}</>
                          )}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {isTogglingVerified ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Switch
                          checked={orgDetail.verified}
                          onCheckedChange={handleVerifiedToggle}
                        />
                      )}
                    </div>
                  </div>

                  {/* Freeze / unfreeze */}
                  <div className="flex items-center justify-between rounded-md border border-border px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      <Snowflake className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <Label className="text-title">Account access</Label>
                        <p className="text-caption">
                          Freezing suspends API calls until manually unfrozen.
                        </p>
                      </div>
                    </div>
                    <AlertDialog open={freezeDialogOpen} onOpenChange={setFreezeDialogOpen}>
                      <Button
                        variant={isFrozen ? 'default' : 'destructive'}
                        size="sm"
                        onClick={() => setFreezeDialogOpen(true)}
                      >
                        <Snowflake className="mr-1.5 h-3.5 w-3.5" />
                        {isFrozen ? 'Unfreeze' : 'Freeze'}
                      </Button>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle className="flex items-center gap-2">
                            <AlertTriangle className="h-5 w-5 text-[color:var(--status-warning)]" />
                            {isFrozen ? 'Unfreeze Account?' : 'Freeze Account?'}
                          </AlertDialogTitle>
                          <AlertDialogDescription>
                            {isFrozen
                              ? `This will reactivate the billing account for "${orgDetail.name}". The organization will be able to use the platform again.`
                              : `This will suspend the billing account for "${orgDetail.name}". The organization will not be able to make API calls until unfrozen.`}
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel disabled={isTogglingFreeze}>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={handleToggleFreeze}
                            disabled={isTogglingFreeze}
                            className={
                              isFrozen
                                ? ''
                                : 'hover:bg-destructive/90 bg-destructive text-destructive-foreground'
                            }
                          >
                            {isTogglingFreeze ? (
                              <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                            ) : null}
                            {isFrozen ? 'Unfreeze' : 'Freeze'}
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </Section>

                {/* ── Members ───────────────────────────────────── */}
                <Section
                  title="Members"
                  subtitle="Invite users by email and review pending invitations."
                  right={
                    invites.length > 0 ? (
                      <Badge variant="secondary" className="text-xs">
                        {invites.length} pending
                      </Badge>
                    ) : null
                  }
                >
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Mail className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input
                        type="email"
                        placeholder="user@example.com"
                        value={inviteEmail}
                        onChange={(e) => setInviteEmail(e.target.value)}
                        onKeyDown={(e) =>
                          !isImeComposing(e) && e.key === 'Enter' && handleInviteUser()
                        }
                        className="pl-9"
                      />
                    </div>
                    <Select value={inviteRoleName} onValueChange={setInviteRoleName}>
                      <SelectTrigger className="w-[130px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Admin">Admin</SelectItem>
                        <SelectItem value="Member">Member</SelectItem>
                        <SelectItem value="Viewer">Viewer</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button
                      size="sm"
                      onClick={handleInviteUser}
                      disabled={isInviting || !inviteEmail.trim()}
                    >
                      {isInviting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Send Invite'}
                    </Button>
                  </div>

                  {isLoadingInvites ? (
                    <div className="flex items-center justify-center py-3">
                      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    </div>
                  ) : invites.length > 0 ? (
                    <div className="space-y-1.5">
                      <Label className="text-label-muted">Pending Invites</Label>
                      <div className="space-y-1">
                        {invites.map((inv) => (
                          <div
                            key={inv.id}
                            className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm"
                          >
                            <div className="flex min-w-0 items-center gap-2">
                              <Mail className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                              <span className="truncate">{inv.email}</span>
                            </div>
                            <div className="ml-2 flex shrink-0 items-center gap-2">
                              {inv.status === 'expired' ? (
                                <Badge variant="destructive" className="text-xs">
                                  Expired
                                </Badge>
                              ) : (
                                <Badge variant="secondary" className="text-xs">
                                  <Clock className="mr-1 h-3 w-3" />
                                  Pending
                                </Badge>
                              )}
                              <span className="text-caption">{formatDate(inv.createdAt)}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </Section>

                {/* ── Billing (credits wallet) ──────────────────── */}
                <Section
                  title="Billing"
                  subtitle={
                    isMetered
                      ? 'METERED plans bill via Stripe meters; the credits wallet is not consumed.'
                      : 'Promo / payment credits drawn down by usage on CREDITS plans.'
                  }
                >
                  <div className="flex items-center justify-between rounded-md border border-border px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      <Coins className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <Label className="text-title">Credits</Label>
                        <p
                          className={`text-h3 text-semibold mt-0.5 ${
                            isMetered
                              ? 'text-muted-foreground'
                              : orgDetail.credits > 0
                                ? 'text-[color:var(--status-success)]'
                                : 'text-foreground'
                          }`}
                        >
                          {orgDetail.credits.toFixed(2)} credits
                        </p>
                        {isMetered && orgDetail.credits > 0 && (
                          <p className="text-caption mt-0.5 text-[color:var(--status-warning)]">
                            Stranded balance from a previous CREDITS plan.
                          </p>
                        )}
                      </div>
                    </div>

                    {isMetered ? (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          {/*
                            Wrap the disabled button in a span so the tooltip
                            still picks up pointer events (a disabled <button>
                            doesn't dispatch them on its own).
                          */}
                          <span tabIndex={0}>
                            <Button variant="outline" size="sm" disabled>
                              <Plus className="mr-1.5 h-3.5 w-3.5" />
                              Add Credits
                            </Button>
                          </span>
                        </TooltipTrigger>
                        <TooltipContent
                          side="left"
                          className="max-w-xs whitespace-normal p-2 text-xs"
                        >
                          <span className="font-medium">Disabled for METERED plans</span>
                          <span className="mt-0.5 block text-muted-foreground">
                            METERED accounts settle each period via Stripe meters and don&rsquo;t
                            draw down the credits wallet. Switch the account to a CREDITS plan first
                            if you want to grant credits.
                          </span>
                        </TooltipContent>
                      </Tooltip>
                    ) : (
                      <Dialog open={creditDialogOpen} onOpenChange={handleCreditDialogOpenChange}>
                        <DialogTrigger asChild>
                          <Button variant="outline" size="sm">
                            <Plus className="mr-1.5 h-3.5 w-3.5" />
                            Add Credits
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-sm">
                          <DialogHeader>
                            <DialogTitle>Add Credits</DialogTitle>
                          </DialogHeader>
                          <div className="space-y-4 py-4">
                            <div>
                              <Label className="text-sm">Type</Label>
                              <Select
                                value={creditType}
                                onValueChange={(v) => setCreditType(v as 'promo' | 'payment')}
                              >
                                <SelectTrigger className="mt-1.5">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="promo">Promo</SelectItem>
                                  <SelectItem value="payment">Payment</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div>
                              <Label className="text-sm">Amount (credits)</Label>
                              <Input
                                type="number"
                                placeholder="e.g. 100"
                                value={creditAmount}
                                onChange={(e) => setCreditAmount(e.target.value)}
                                onKeyDown={(e) =>
                                  !isImeComposing(e) && e.key === 'Enter' && handleAddCredits()
                                }
                                className="mt-1.5"
                                min="0"
                                step="1"
                                autoFocus
                              />
                              {creditAmount &&
                                (isNaN(parseFloat(creditAmount)) ||
                                  parseFloat(creditAmount) <= 0) && (
                                  <p className="text-body-sm text-error mt-1">
                                    Enter a valid positive amount
                                  </p>
                                )}
                            </div>
                          </div>
                          <DialogFooter>
                            <Button
                              onClick={handleAddCredits}
                              disabled={
                                isAddingCredits ||
                                !creditAmount ||
                                isNaN(parseFloat(creditAmount)) ||
                                parseFloat(creditAmount) <= 0
                              }
                            >
                              {isAddingCredits ? (
                                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                              ) : null}
                              Add {creditAmount || '0'} Credits
                            </Button>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>
                    )}
                  </div>

                  {/* ── Business Profile ─────────────────────────── */}
                  {/*
                    Editable display of the BillingAccount profile that
                    drives:
                      * the addressee block on every Stripe invoice,
                      * the data Stripe Customer creation reads from,
                      * tax-id collection (printed on the invoice + used
                        by Stripe Tax).
                    We surface it ABOVE the Stripe Customer row so the
                    operator's instinct is "fill profile first, then
                    provision".
                  */}
                  {planActions &&
                    (() => {
                      const profile = orgDetail.billingProfile;
                      const addressLine = formatAddressLine(profile.billingAddress);
                      const ready = profileMeetsProvisioningMinimum(profile);
                      const provisioned = !!orgDetail.stripeCustomerId;
                      return (
                        <div className="rounded-md border border-border px-3 py-2.5">
                          <div className="flex items-start justify-between">
                            <div className="flex min-w-0 flex-1 items-start gap-2">
                              <Building2 className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2">
                                  <Label className="text-title">Business Profile</Label>
                                  {!ready && !provisioned && (
                                    <Badge variant="destructive" className="text-xs">
                                      Email missing
                                    </Badge>
                                  )}
                                </div>
                                <p className="text-caption">
                                  Used as the invoice addressee and to populate the Stripe Customer
                                  record. Edit before provisioning so the new Customer ships with
                                  full details.
                                </p>
                              </div>
                            </div>
                            <Button size="sm" variant="outline" onClick={openProfileDialog}>
                              Edit
                            </Button>
                          </div>

                          <dl className="mt-3 grid grid-cols-[6rem_1fr] gap-y-1 text-sm">
                            <dt className="text-muted-foreground">Email</dt>
                            <dd className="truncate">
                              {profile.billingEmail || (
                                <span className="italic text-muted-foreground">Not set</span>
                              )}
                            </dd>
                            <dt className="text-muted-foreground">Name</dt>
                            <dd className="truncate">
                              {profile.name || (
                                <span className="italic text-muted-foreground">Not set</span>
                              )}
                            </dd>
                            <dt className="text-muted-foreground">Tax ID</dt>
                            <dd className="truncate">
                              {profile.taxId ? (
                                <>
                                  {profile.taxId}
                                  {profile.taxIdType && (
                                    <span className="text-muted-foreground">
                                      {' '}
                                      ({profile.taxIdType})
                                    </span>
                                  )}
                                </>
                              ) : (
                                <span className="italic text-muted-foreground">Not set</span>
                              )}
                            </dd>
                            <dt className="text-muted-foreground">Address</dt>
                            <dd className="truncate">
                              {addressLine || (
                                <span className="italic text-muted-foreground">Not set</span>
                              )}
                            </dd>
                          </dl>
                        </div>
                      );
                    })()}

                  {/* ── Stripe Customer ────────────────────────────── */}
                  {planActions && (
                    <div className="flex items-center justify-between rounded-md border border-border px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        <CreditCard className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <Label className="text-title">Stripe Customer</Label>
                          <p className="text-caption">
                            {orgDetail.stripeCustomerId
                              ? `Provisioned (${orgDetail.stripeCustomerId}). METERED templates can be assigned.`
                              : 'Not set. Required before assigning a METERED template or invoicing in Stripe.'}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {orgDetail.stripeCustomerId ? (
                          <CheckCircle2 className="h-4 w-4 text-[color:var(--status-success)]" />
                        ) : (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span tabIndex={0}>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => setProvisionConfirmOpen(true)}
                                  disabled={
                                    stripeBusy ||
                                    !profileMeetsProvisioningMinimum(orgDetail.billingProfile)
                                  }
                                >
                                  <Plus className="mr-1.5 h-3.5 w-3.5" />
                                  Provision
                                </Button>
                              </span>
                            </TooltipTrigger>
                            {!profileMeetsProvisioningMinimum(orgDetail.billingProfile) && (
                              <TooltipContent
                                side="left"
                                className="max-w-xs whitespace-normal p-2 text-xs"
                              >
                                <span className="font-medium">Set a billing email first</span>
                                <span className="mt-0.5 block text-muted-foreground">
                                  Stripe Customer creation requires an email — fill the Business
                                  Profile above before provisioning.
                                </span>
                              </TooltipContent>
                            )}
                          </Tooltip>
                        )}
                      </div>
                    </div>
                  )}
                </Section>

                {/* ── Plan ──────────────────────────────────────── */}
                {planActions && (
                  <Section
                    title="Plan"
                    subtitle="Active billing-plan template, plus history of past assignments."
                  >
                    <OrgPlanSection
                      orgId={orgDetail.id}
                      hasStripeCustomer={!!orgDetail.stripeCustomerId}
                      actions={planActions}
                      onAccountUpdated={() => fetchDetail(orgDetail.id)}
                      onActivePlanChange={setActivePlan}
                      notify={toast}
                      planGroupId={orgDetail.planGroupId}
                    />
                  </Section>
                )}
              </div>
            </TooltipProvider>
          ) : null}
        </div>
      )}

      {/* ── Business Profile edit dialog ───────────────────────────── */}
      <Dialog open={profileDialogOpen} onOpenChange={setProfileDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Business Profile</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2 text-sm">
            <p className="text-caption">
              Saved changes are persisted to the BillingAccount and, if a Stripe Customer already
              exists, best-effort synced to Stripe (so the next invoice picks them up).
              Already-issued invoices are immutable.
            </p>

            <div>
              <Label className="text-label-muted">Billing email *</Label>
              <Input
                type="email"
                value={profileForm.billingEmail ?? ''}
                onChange={(e) =>
                  setProfileForm((p) => ({ ...p, billingEmail: e.target.value || null }))
                }
                placeholder="invoices@customer.com"
                className="mt-1.5"
              />
              <p className="text-caption mt-0.5">
                Where Stripe sends invoices. Required to provision a Stripe Customer.
              </p>
            </div>

            <div>
              <Label className="text-label-muted">Display / business name</Label>
              <Input
                value={profileForm.name ?? ''}
                onChange={(e) => setProfileForm((p) => ({ ...p, name: e.target.value || null }))}
                placeholder="Acme, Inc."
                className="mt-1.5"
              />
              <p className="text-caption mt-0.5">
                Shown as the customer name on every Stripe invoice.
              </p>
            </div>

            <div className="grid grid-cols-[1fr_8rem] gap-2">
              <div>
                <Label className="text-label-muted">Tax ID</Label>
                <Input
                  value={profileForm.taxId ?? ''}
                  onChange={(e) => setProfileForm((p) => ({ ...p, taxId: e.target.value || null }))}
                  placeholder="VAT / EIN / ABN…"
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label className="text-label-muted">Type</Label>
                <Input
                  value={profileForm.taxIdType ?? ''}
                  onChange={(e) =>
                    setProfileForm((p) => ({ ...p, taxIdType: e.target.value || null }))
                  }
                  placeholder="eu_vat"
                  className="mt-1.5"
                />
              </div>
            </div>
            <p className="text-caption">
              Stripe tax-id type code (e.g. <code>eu_vat</code>, <code>us_ein</code>,
              <code> gb_vat</code>). Leave blank to let the backend infer from the address country.
            </p>

            <div className="space-y-2 rounded-md border border-border p-3">
              <Label className="text-label-muted">Billing address</Label>
              <Input
                value={profileForm.billingAddress.line1 ?? ''}
                onChange={(e) =>
                  setProfileForm((p) => ({
                    ...p,
                    billingAddress: { ...p.billingAddress, line1: e.target.value },
                  }))
                }
                placeholder="Address line 1"
              />
              <Input
                value={profileForm.billingAddress.line2 ?? ''}
                onChange={(e) =>
                  setProfileForm((p) => ({
                    ...p,
                    billingAddress: { ...p.billingAddress, line2: e.target.value },
                  }))
                }
                placeholder="Address line 2 (optional)"
              />
              <div className="grid grid-cols-2 gap-2">
                <Input
                  value={profileForm.billingAddress.city ?? ''}
                  onChange={(e) =>
                    setProfileForm((p) => ({
                      ...p,
                      billingAddress: { ...p.billingAddress, city: e.target.value },
                    }))
                  }
                  placeholder="City"
                />
                <Input
                  value={profileForm.billingAddress.state ?? ''}
                  onChange={(e) =>
                    setProfileForm((p) => ({
                      ...p,
                      billingAddress: { ...p.billingAddress, state: e.target.value },
                    }))
                  }
                  placeholder="State / Region"
                />
                <Input
                  value={profileForm.billingAddress.postalCode ?? ''}
                  onChange={(e) =>
                    setProfileForm((p) => ({
                      ...p,
                      billingAddress: { ...p.billingAddress, postalCode: e.target.value },
                    }))
                  }
                  placeholder="Postal code"
                />
                <Input
                  value={profileForm.billingAddress.country ?? ''}
                  onChange={(e) =>
                    setProfileForm((p) => ({
                      ...p,
                      billingAddress: {
                        ...p.billingAddress,
                        country: e.target.value.toUpperCase(),
                      },
                    }))
                  }
                  placeholder="Country (ISO-2, e.g. US)"
                  maxLength={2}
                />
              </div>
              <p className="text-caption">
                Country is required by Stripe Tax for accurate tax computation; postal code is
                recommended.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setProfileDialogOpen(false)}
              disabled={isSavingProfile}
            >
              Cancel
            </Button>
            <Button onClick={handleSaveProfile} disabled={isSavingProfile}>
              {isSavingProfile ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
              Save profile
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Provision Stripe Customer confirmation ─────────────────── */}
      <AlertDialog open={provisionConfirmOpen} onOpenChange={setProvisionConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-muted-foreground" />
              Provision Stripe Customer?
            </AlertDialogTitle>
            <AlertDialogDescription>
              A Stripe Customer is created from the current Business Profile (email, name, address,
              tax ID). Make sure the profile is complete and accurate — fields you don&rsquo;t fill
              in will be missing from the Stripe record and from every invoice we send to this
              customer. Already-finalised invoices can&rsquo;t be retro-edited.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={stripeBusy}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleEnsureStripeCustomer} disabled={stripeBusy}>
              {stripeBusy ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
              Provision
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
