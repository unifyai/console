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

import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  Search,
  Plus,
  ChevronRight,
  X,
  Loader2,
  Building2,
  ShieldCheck,
  FlaskConical,
  CreditCard,
  Snowflake,
  User,
  RefreshCw,
  UserPlus,
  Mail,
  Clock,
  AlertTriangle,
} from 'lucide-react';
import { Button } from '@/components/UI/button';
import { Input } from '@/components/UI/input';
import { Badge } from '@/components/UI/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/UI/card';
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
import { Separator } from '@/components/UI/separator';
import type {
  AdminOnboardingActions,
  AdminOrgListItem,
  AdminOrgDetail,
  AdminUserLookup,
  AdminOrgInvite,
} from '@/types/admin';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface OrganizationsAdminMainProps {
  actions: AdminOnboardingActions;
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

// ---------------------------------------------------------------------------
// Toast-style inline notification (simple, no external dep)
// ---------------------------------------------------------------------------

function useToast() {
  const [message, setMessage] = useState<{
    text: string;
    type: 'success' | 'error';
  } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback(
    (text: string, type: 'success' | 'error' = 'success') => {
      if (timer.current) clearTimeout(timer.current);
      setMessage({ text, type });
      timer.current = setTimeout(() => setMessage(null), 4000);
    },
    []
  );

  const Toast = message ? (
    <div
      className={`fixed bottom-4 right-4 z-[100] rounded-lg px-4 py-2 text-sm shadow-lg ${
        message.type === 'success'
          ? 'bg-green-600 text-white'
          : 'bg-red-600 text-white'
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

export default function OrganizationsAdminMain({
  actions,
}: OrganizationsAdminMainProps) {
  const { show: toast, Toast } = useToast();

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
  const [lookupResult, setLookupResult] = useState<AdminUserLookup | null>(
    null
  );
  const [isLookingUp, setIsLookingUp] = useState(false);
  const [newOrgName, setNewOrgName] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  // ── Invite form + invite list state ──────────────────────────────────
  const [inviteEmail, setInviteEmail] = useState('');
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
    [actions, toast]
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
    [actions, toast]
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
    fetchDetail(orgId);
    fetchInvites(orgId);
  };

  const closeDetail = () => {
    setSelectedOrgId(null);
    setOrgDetail(null);
    setInviteEmail('');
    setInvites([]);
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
    const result = await actions.createOrganizationForUser(
      newOrgName.trim(),
      lookupResult.id
    );
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
    const result = await actions.inviteUserToOrg(orgDetail.id, trimmed);
    if (isError(result)) {
      toast(result.detail, 'error');
    } else {
      toast(`Invite sent to ${trimmed}`);
      setInviteEmail('');
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
      toast(`$${amount} ${creditType} credits added`);
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

  return (
    <div className="flex h-full">
      {/* ── Left: Org list ───────────────────────────────────────────── */}
      <div
        className={`flex h-full flex-col border-r border-border ${
          selectedOrgId ? 'w-1/3' : 'w-full'
        } transition-all`}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h1 className="text-h1 text-semibold">Admin · Organizations</h1>
          <Dialog
            open={createDialogOpen}
            onOpenChange={handleCreateDialogOpenChange}
          >
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
                  <Label className="text-label-muted">
                    Step 1: Find user by email
                  </Label>
                  <div className="mt-1.5 flex gap-2">
                    <Input
                      placeholder="User email…"
                      value={lookupEmail}
                      onChange={(e) => setLookupEmail(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleLookup()}
                      className="flex-1"
                    />
                    <Button
                      size="sm"
                      onClick={handleLookup}
                      disabled={isLookingUp || !lookupEmail.trim()}
                    >
                      {isLookingUp ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        'Look up'
                      )}
                    </Button>
                  </div>
                </div>

                {/* User found */}
                {lookupResult && (
                  <>
                    <div className="flex items-center gap-2 rounded-md border border-border bg-muted/30 p-2.5 text-sm">
                      <User className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">
                          {lookupResult.name}
                          {lookupResult.lastName
                            ? ` ${lookupResult.lastName}`
                            : ''}
                        </p>
                        <p className="truncate text-caption">
                          {lookupResult.email}
                        </p>
                        {lookupResult.organizations &&
                          lookupResult.organizations.length > 0 && (
                            <p className="mt-0.5 text-xs text-amber-600 dark:text-amber-400">
                              Already in:{' '}
                              {lookupResult.organizations
                                .map((o) => o.name)
                                .join(', ')}
                            </p>
                          )}
                      </div>
                    </div>

                    {/* Step 2: Org name */}
                    <div>
                      <Label className="text-label-muted">
                        Step 2: Organization name
                      </Label>
                      <div className="mt-1.5 flex gap-2">
                        <Input
                          placeholder="Organization name…"
                          value={newOrgName}
                          onChange={(e) => setNewOrgName(e.target.value)}
                          onKeyDown={(e) =>
                            e.key === 'Enter' && handleCreateOrg()
                          }
                          className="flex-1"
                        />
                        <Button
                          size="sm"
                          onClick={handleCreateOrg}
                          disabled={isCreating || !newOrgName.trim()}
                        >
                          {isCreating ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            'Create'
                          )}
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
          <div className="relative">
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
        <div className="flex-1 overflow-auto">
          {isLoadingOrgs ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : orgs.length === 0 ? (
            <div className="py-12 text-center text-body-muted">
              No organizations found
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-caption">
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
                    className={`cursor-pointer border-b border-border transition-colors hover:bg-muted/50 ${
                      selectedOrgId === org.id ? 'bg-muted/70' : ''
                    }`}
                  >
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <Building2 className="h-4 w-4 shrink-0 text-muted-foreground" />
                        <span className="font-medium">{org.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground">
                      {org.memberCount}
                    </td>
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
        <div className="flex h-full w-2/3 flex-col overflow-auto">
          {/* Detail header */}
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <h2 className="text-h3 text-semibold">
              {orgDetail?.name ?? 'Loading…'}
            </h2>
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
                <RefreshCw
                  className={`h-3.5 w-3.5 ${
                    isLoadingDetail ? 'animate-spin' : ''
                  }`}
                />
              </Button>
              <Button variant="ghost" size="sm" onClick={closeDetail}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {isLoadingDetail && !orgDetail ? (
            <div className="flex flex-1 items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : orgDetail ? (
            <div className="flex-1 space-y-4 overflow-auto p-4">
              {/* ── Info ──────────────────────────────────────────── */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-title">
                    Organization Info
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-1.5 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">ID</span>
                    <span className="font-mono">{orgDetail.id}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Owner</span>
                    <span className="max-w-[250px] truncate text-sm">
                      {orgDetail.ownerEmail || orgDetail.ownerId}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Members</span>
                    <span>{orgDetail.memberCount}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Created</span>
                    <span>{formatDate(orgDetail.createdAt)}</span>
                  </div>
                </CardContent>
              </Card>

              {/* ── Free Trial ────────────────────────────────────── */}
              <Card>
                <CardContent className="flex items-center justify-between py-4">
                  <div className="flex items-center gap-2">
                    <FlaskConical className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <Label className="text-title">Free Trial</Label>
                      <p className="text-caption">
                        Hides billing & usage pages for org members
                      </p>
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
                </CardContent>
              </Card>

              {/* ── Verification ──────────────────────────────────── */}
              <Card>
                <CardContent className="flex items-center justify-between py-4">
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
                    {orgDetail.verified && (
                      <Badge variant="secondary" className="text-xs">
                        Verified
                      </Badge>
                    )}
                    {isTogglingVerified ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Switch
                        checked={orgDetail.verified}
                        onCheckedChange={handleVerifiedToggle}
                      />
                    )}
                  </div>
                </CardContent>
              </Card>

              <Separator />

              {/* ── Invite User + Pending Invites ─────────────────── */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-title">
                    <UserPlus className="h-4 w-4" />
                    Invite User
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Mail className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input
                        type="email"
                        placeholder="user@example.com"
                        value={inviteEmail}
                        onChange={(e) => setInviteEmail(e.target.value)}
                        onKeyDown={(e) =>
                          e.key === 'Enter' && handleInviteUser()
                        }
                        className="pl-9"
                      />
                    </div>
                    <Button
                      size="sm"
                      onClick={handleInviteUser}
                      disabled={isInviting || !inviteEmail.trim()}
                    >
                      {isInviting ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        'Send Invite'
                      )}
                    </Button>
                  </div>

                  {/* Pending invites list */}
                  {isLoadingInvites ? (
                    <div className="flex items-center justify-center py-3">
                      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    </div>
                  ) : invites.length > 0 ? (
                    <div className="space-y-1.5">
                      <Label className="text-label-muted">
                        Pending Invites
                      </Label>
                      <div className="space-y-1">
                        {invites.map((inv) => (
                          <div
                            key={inv.id}
                            className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <Mail className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                              <span className="truncate">{inv.email}</span>
                            </div>
                            <div className="flex items-center gap-2 shrink-0 ml-2">
                              {inv.status === 'expired' ? (
                                <Badge
                                  variant="destructive"
                                  className="text-xs"
                                >
                                  Expired
                                </Badge>
                              ) : (
                                <Badge
                                  variant="secondary"
                                  className="text-xs"
                                >
                                  <Clock className="mr-1 h-3 w-3" />
                                  Pending
                                </Badge>
                              )}
                              <span className="text-caption">
                                {formatDate(inv.createdAt)}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </CardContent>
              </Card>

              <Separator />

              {/* ── Billing (simplified 2-column layout) ──────────── */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-title">
                    <CreditCard className="h-4 w-4" />
                    Billing
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {/* Credits row */}
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-body-muted">
                        Credits
                      </span>
                      <p
                        className={`text-h1 text-semibold ${
                          orgDetail.credits > 0
                            ? 'text-green-600 dark:text-green-400'
                            : 'text-foreground'
                        }`}
                      >
                        ${orgDetail.credits.toFixed(2)}
                      </p>
                    </div>
                    <Dialog
                      open={creditDialogOpen}
                      onOpenChange={handleCreditDialogOpenChange}
                    >
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
                              onValueChange={(v) =>
                                setCreditType(v as 'promo' | 'payment')
                              }
                            >
                              <SelectTrigger className="mt-1.5">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="promo">Promo</SelectItem>
                                <SelectItem value="payment">
                                  Payment
                                </SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label className="text-sm">Amount (USD)</Label>
                            <Input
                              type="number"
                              placeholder="e.g. 100"
                              value={creditAmount}
                              onChange={(e) => setCreditAmount(e.target.value)}
                              onKeyDown={(e) =>
                                e.key === 'Enter' && handleAddCredits()
                              }
                              className="mt-1.5"
                              min="0"
                              step="1"
                              autoFocus
                            />
                            {creditAmount &&
                              (isNaN(parseFloat(creditAmount)) ||
                                parseFloat(creditAmount) <= 0) && (
                                <p className="mt-1 text-body-sm text-error">
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
                            Add ${creditAmount || '0'} Credits
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  </div>

                  <Separator />

                  {/* Status row */}
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-body-muted">
                        Status
                      </span>
                      <div className="mt-0.5">
                        <Badge
                          variant={
                            orgDetail.accountStatus === 'ACTIVE'
                              ? 'default'
                              : 'destructive'
                          }
                          className="text-xs"
                        >
                          {orgDetail.accountStatus}
                        </Badge>
                      </div>
                    </div>
                    <AlertDialog
                      open={freezeDialogOpen}
                      onOpenChange={setFreezeDialogOpen}
                    >
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
                            <AlertTriangle className="h-5 w-5 text-amber-500" />
                            {isFrozen
                              ? 'Unfreeze Account?'
                              : 'Freeze Account?'}
                          </AlertDialogTitle>
                          <AlertDialogDescription>
                            {isFrozen
                              ? `This will reactivate the billing account for "${orgDetail.name}". The organization will be able to use the platform again.`
                              : `This will suspend the billing account for "${orgDetail.name}". The organization will not be able to make API calls until unfrozen.`}
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel disabled={isTogglingFreeze}>
                            Cancel
                          </AlertDialogCancel>
                          <AlertDialogAction
                            onClick={handleToggleFreeze}
                            disabled={isTogglingFreeze}
                            className={
                              isFrozen
                                ? ''
                                : 'bg-destructive text-destructive-foreground hover:bg-destructive/90'
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
                </CardContent>
              </Card>
            </div>
          ) : null}
        </div>
      )}

      {Toast}
    </div>
  );
}
