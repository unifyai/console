'use client';

/**
 * Plan Groups tab for the /admin/plans page.
 *
 * Curated bundles of switchable templates that scope the
 * customer-facing self-serve plan switch endpoint
 * (`POST /v0/billing/plan`). Per-account assignment of a group lives
 * on the org-detail panel; this tab is pure catalog management.
 *
 * The previous standalone /admin/plan-groups page used a master /
 * detail split-pane. This tab replaces it with a flat table + an
 * Edit dialog so the operator workflow matches the Plans tab UX:
 * scan a list, click Edit on a row to drill in.
 *
 * Position semantics (kept in lock-step with the backend DAO):
 *   * NULL   → unordered alternative (cards UX on the customer side).
 *   * INT ≥0 → rung in an ordered ladder; lower = smaller tier (and
 *              therefore the downgrade target). The DAO enforces
 *              uniqueness within a group via a partial unique index.
 *
 * Position reordering uses an atomic clear-then-set on the backend
 * so concurrent rung swaps never collide on the unique index.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ListFilter,
  Loader2,
  MoreHorizontal,
  Pencil,
  Plus,
  Power,
  PowerOff,
  Search,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/UI/badge';
import { Button } from '@/components/UI/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/UI/dialog';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/UI/dropdown-menu';
import { Input } from '@/components/UI/input';
import { Label } from '@/components/UI/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/UI/select';
import { Switch } from '@/components/UI/switch';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/UI/table';
import type {
  AdminBillingPlansActions,
  AdminBillingPlanTemplate,
  AdminPlanGroupDetail,
  AdminPlanGroupMemberItem,
  AdminPlanGroupSummary,
} from '@/types/admin';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Server actions return `T | ResponseProps`. ResponseProps has an
 * open string index signature so the union doesn't narrow via
 * `'detail' in result` — TS still considers the success type to
 * potentially be the error shape. We discriminate with this
 * predicate and explicitly cast on the success branch.
 */
function isError(result: unknown): result is { detail: string } {
  return (
    typeof result === 'object' &&
    result !== null &&
    'detail' in result &&
    typeof (result as { detail: unknown }).detail === 'string'
  );
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

/**
 * Sentinel id for the platform-default plan group, mirroring
 * ``DEFAULT_PLAN_GROUP_ID`` on the backend. Every account is
 * auto-assigned to this group at creation; the row should never be
 * deleted, renamed, or deactivated through the admin UI. We render
 * a small "Default" badge on its row and disable destructive
 * controls (active toggle) inside the edit dialog so an operator
 * can't break the system by accident — the underlying admin API
 * still permits these mutations for emergency repair via curl.
 */
const DEFAULT_PLAN_GROUP_ID = 1;

interface Props {
  actions: AdminBillingPlansActions;
  /** Already-loaded catalog rows for the add-member dropdown. */
  templates: AdminBillingPlanTemplate[];
  /** Loaded groups (parent owns the data so the Plans tab can
   *  share the template→groups map for filtering / column display). */
  groups: AdminPlanGroupSummary[];
  loading: boolean;
  showInactive: boolean;
  setShowInactive: (v: boolean) => void;
  /** Refresh the parent's groups state after a mutation. */
  refresh: () => Promise<void>;
}

export default function BillingPlanGroupsTab({
  actions,
  templates,
  groups,
  loading,
  showInactive,
  setShowInactive,
  refresh,
}: Props) {
  // ── Create dialog state ──────────────────────────────────────────────
  const [createOpen, setCreateOpen] = useState(false);
  const [createName, setCreateName] = useState('');
  const [createDisplayName, setCreateDisplayName] = useState('');
  const [createDescription, setCreateDescription] = useState('');
  const [creating, setCreating] = useState(false);

  // ── Top-bar filter state ─────────────────────────────────────────────
  // Local search predicate over the parent-loaded `groups` slice. The
  // ``Show deprecated`` toggle still lives on `showInactive` (parent
  // owns it because flipping it changes the orchestra fetch query).
  const [search, setSearch] = useState('');

  // ── Edit dialog state ────────────────────────────────────────────────
  // The row-level dropdown surfaces "Edit group" (metadata) and
  // "Edit members" as distinct entry points; each opens its own
  // Dialog so the operator only sees the slice they came in for.
  // Both dialogs share the same ``editingDetail`` snapshot — only
  // one can be open at a time so this is simpler than per-dialog
  // state, and re-fetches only happen when an id transitions from
  // null to set.
  const [editingMetaId, setEditingMetaId] = useState<number | null>(null);
  const [editingMembersId, setEditingMembersId] = useState<number | null>(null);
  const [editingDetail, setEditingDetail] = useState<AdminPlanGroupDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Edit-form metadata buffer (separate from the detail snapshot so
  // the operator can type without each keystroke firing a save).
  const [editDisplayName, setEditDisplayName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editIsActive, setEditIsActive] = useState(true);
  const [savingMetadata, setSavingMetadata] = useState(false);

  // Add-member sub-form (inside the edit dialog).
  const [addTemplateId, setAddTemplateId] = useState<string>('');
  const [addPosition, setAddPosition] = useState<string>('');
  const [adding, setAdding] = useState(false);

  // Per-row position-edit buffer. Stored as strings so the input can
  // hold transient empties while the operator is typing; coerce on
  // save.
  const [positionEdits, setPositionEdits] = useState<Record<number, string>>({});

  // One-shot guard for activate/deactivate from the row dropdown so
  // concurrent clicks don't double-fire the round-trip.
  const [togglingId, setTogglingId] = useState<number | null>(null);

  // --------------------------------------------------------------------
  // Edit-dialog loaders
  // --------------------------------------------------------------------

  const loadDetail = useCallback(
    async (groupId: number) => {
      setLoadingDetail(true);
      const result = await actions.getGroup(groupId);
      if (isError(result)) {
        toast.error(result.detail);
        setEditingDetail(null);
        setLoadingDetail(false);
        return;
      }
      const group = result as AdminPlanGroupDetail;
      setEditingDetail(group);
      setEditDisplayName(group.displayName ?? '');
      setEditDescription(group.description ?? '');
      setEditIsActive(group.isActive);
      setPositionEdits(
        Object.fromEntries(
          group.members.map((m: AdminPlanGroupMemberItem) => [
            m.templateId,
            m.position?.toString() ?? '',
          ])
        )
      );
      setLoadingDetail(false);
    },
    [actions]
  );

  // Active editing id across either dialog — only one can be open at
  // a time so this collapses cleanly into a single fetch trigger.
  const currentEditingId = editingMetaId ?? editingMembersId;
  useEffect(() => {
    if (currentEditingId !== null) loadDetail(currentEditingId);
    else setEditingDetail(null);
  }, [currentEditingId, loadDetail]);

  // --------------------------------------------------------------------
  // Handlers
  // --------------------------------------------------------------------

  const filteredGroups = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (q === '') return groups;
    return groups.filter((g) => {
      const hay = [g.name, g.displayName ?? ''].join(' ').toLowerCase();
      return hay.includes(q);
    });
  }, [groups, search]);

  const handleToggleActive = async (g: AdminPlanGroupSummary) => {
    if (g.id === DEFAULT_PLAN_GROUP_ID) {
      toast.error('The default plan group cannot be deactivated.');
      return;
    }
    setTogglingId(g.id);
    const result = await actions.updateGroup(g.id, { isActive: !g.isActive });
    setTogglingId(null);
    if (isError(result)) {
      toast.error(result.detail);
      return;
    }
    toast.success(g.isActive ? 'Group deactivated' : 'Group activated');
    await refresh();
  };

  const openEditDialog = (groupId: number, mode: 'metadata' | 'members') => {
    if (mode === 'metadata') setEditingMetaId(groupId);
    else setEditingMembersId(groupId);
  };

  const handleCreate = async () => {
    if (!createName.trim()) {
      toast.error('Group slug is required');
      return;
    }
    setCreating(true);
    const result = await actions.createGroup({
      name: createName.trim(),
      displayName: createDisplayName.trim() || undefined,
      description: createDescription.trim() || undefined,
      isActive: true,
    });
    setCreating(false);
    if (isError(result)) {
      toast.error(result.detail);
      return;
    }
    const created = result as AdminPlanGroupDetail;
    toast.success(`Created plan group "${created.name}"`);
    setCreateOpen(false);
    setCreateName('');
    setCreateDisplayName('');
    setCreateDescription('');
    await refresh();
    // Open the new group's members dialog straight away so the
    // operator can add templates without an extra click — a freshly
    // created group is empty and members is the next-most-likely
    // task.
    setEditingMembersId(created.id);
  };

  const handleSaveMetadata = async () => {
    if (!editingDetail) return;
    setSavingMetadata(true);
    const result = await actions.updateGroup(editingDetail.id, {
      displayName: editDisplayName.trim() || undefined,
      description: editDescription.trim() || undefined,
      isActive: editIsActive,
    });
    setSavingMetadata(false);
    if (isError(result)) {
      toast.error(result.detail);
      return;
    }
    const updated = result as AdminPlanGroupDetail;
    setEditingDetail(updated);
    toast.success('Group updated');
    await refresh();
  };

  const handleAddMember = async () => {
    if (!editingDetail) return;
    const tid = Number(addTemplateId);
    if (!Number.isFinite(tid) || tid <= 0) {
      toast.error('Pick a template to add');
      return;
    }
    const positionRaw = addPosition.trim();
    let position: number | null = null;
    if (positionRaw !== '') {
      const parsed = Number(positionRaw);
      if (!Number.isFinite(parsed) || parsed < 0) {
        toast.error('Position must be a non-negative integer');
        return;
      }
      position = parsed;
    }
    setAdding(true);
    const result = await actions.addMember(editingDetail.id, tid, position);
    setAdding(false);
    if (isError(result)) {
      toast.error(result.detail);
      return;
    }
    const updated = result as AdminPlanGroupDetail;
    setEditingDetail(updated);
    setAddTemplateId('');
    setAddPosition('');
    setPositionEdits(
      Object.fromEntries(
        updated.members.map((m: AdminPlanGroupMemberItem) => [
          m.templateId,
          m.position?.toString() ?? '',
        ])
      )
    );
    await refresh();
  };

  const handleRemoveMember = async (templateId: number) => {
    if (!editingDetail) return;
    const result = await actions.removeMember(editingDetail.id, templateId);
    if (isError(result)) {
      toast.error(result.detail);
      return;
    }
    setEditingDetail(result as AdminPlanGroupDetail);
    await refresh();
  };

  const dirtyPositions = useMemo(() => {
    if (!editingDetail) return [];
    return editingDetail.members
      .filter((m) => {
        const edited = positionEdits[m.templateId] ?? '';
        const current = m.position?.toString() ?? '';
        return edited !== current;
      })
      .map((m) => {
        const edited = positionEdits[m.templateId] ?? '';
        const parsed = edited === '' ? null : Number(edited);
        return { templateId: m.templateId, position: parsed };
      });
  }, [editingDetail, positionEdits]);

  const handleSavePositions = async () => {
    if (!editingDetail || dirtyPositions.length === 0) return;
    for (const p of dirtyPositions) {
      if (p.position !== null && (!Number.isFinite(p.position) || p.position < 0)) {
        toast.error('All positions must be non-negative integers (or empty)');
        return;
      }
    }
    const result = await actions.setPositions(editingDetail.id, dirtyPositions);
    if (isError(result)) {
      toast.error(result.detail);
      return;
    }
    const updated = result as AdminPlanGroupDetail;
    setEditingDetail(updated);
    setPositionEdits(
      Object.fromEntries(
        updated.members.map((m: AdminPlanGroupMemberItem) => [
          m.templateId,
          m.position?.toString() ?? '',
        ])
      )
    );
    toast.success('Positions updated');
    await refresh();
  };

  // Templates not already in the group — the add-member dropdown.
  const addableTemplates = useMemo(() => {
    const memberIds = new Set(editingDetail?.members.map((m) => m.templateId) ?? []);
    return templates.filter((t) => !memberIds.has(t.id));
  }, [templates, editingDetail]);

  // ====================================================================
  // Render
  // ====================================================================

  return (
    <div>
      {/* ── Filter bar (mirrors the Plans tab: search + filters
            dropdown + count + create CTA) ───────────────────────── */}
      <div className="flex items-center gap-2 border-b border-border px-4 py-2">
        <div className="relative w-72">
          <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or slug…"
            className="h-8 pl-7"
          />
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="h-8">
              <ListFilter className="mr-1.5 h-3.5 w-3.5" />
              Filters
              {showInactive && (
                <Badge variant="secondary" className="ml-2 h-4 px-1.5 text-[10px]">
                  1
                </Badge>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56">
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
        <span className="text-caption ml-auto">
          {filteredGroups.length} group
          {filteredGroups.length === 1 ? '' : 's'}
        </span>
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          <Plus className="mr-1 h-3.5 w-3.5" />
          New Group
        </Button>
      </div>

      {/* ── Groups table ─────────────────────────────────────────── */}
      <div>
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : filteredGroups.length === 0 ? (
          <div className="text-body-muted py-12 text-center">
            {groups.length === 0
              ? 'No plan groups yet. Create one to expose self-serve plan switching for your customers.'
              : `No groups match "${search}".`}
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[300px]">Name</TableHead>
                <TableHead className="w-24">Members</TableHead>
                <TableHead className="w-32">Status</TableHead>
                <TableHead className="w-32">Created</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredGroups.map((g) => {
                const isDefault = g.id === DEFAULT_PLAN_GROUP_ID;
                const isToggling = togglingId === g.id;
                return (
                  <TableRow key={g.id} data-testid={`plan-group-row-${g.id}`}>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="text-body-sm flex items-center gap-2 font-medium">
                          {g.displayName ?? g.name}
                          {isDefault && (
                            <Badge
                              variant="outline"
                              className="text-[10px] uppercase"
                              title="System default — auto-applied to every new account"
                            >
                              Default
                            </Badge>
                          )}
                        </span>
                        <span className="text-caption font-mono">{g.name}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">
                      {g.memberCount} template{g.memberCount === 1 ? '' : 's'}
                    </TableCell>
                    <TableCell>
                      {g.isActive ? (
                        <Badge variant="default" className="text-xs">
                          Active
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="text-xs">
                          Deprecated
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-caption">
                      {/* Created date isn't on the summary; show "—" so the
                          column still aligns with the Plans tab. */}
                      —
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            aria-label={`Actions for ${g.name}`}
                            disabled={isToggling}
                          >
                            {isToggling ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <MoreHorizontal className="h-3.5 w-3.5" />
                            )}
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-44">
                          {/* Default group is structurally required —
                              backend rejects deactivation with 409 anyway,
                              but hiding the item avoids a misleading
                              "Disable" affordance for operators. */}
                          {!isDefault &&
                            (g.isActive ? (
                              <DropdownMenuItem onSelect={() => handleToggleActive(g)}>
                                <PowerOff className="mr-2 h-3.5 w-3.5" />
                                Disable group
                              </DropdownMenuItem>
                            ) : (
                              <DropdownMenuItem onSelect={() => handleToggleActive(g)}>
                                <Power className="mr-2 h-3.5 w-3.5" />
                                Enable group
                              </DropdownMenuItem>
                            ))}
                          {!isDefault && <DropdownMenuSeparator />}
                          <DropdownMenuItem onSelect={() => openEditDialog(g.id, 'metadata')}>
                            <Pencil className="mr-2 h-3.5 w-3.5" />
                            Edit group
                          </DropdownMenuItem>
                          <DropdownMenuItem onSelect={() => openEditDialog(g.id, 'members')}>
                            <Users className="mr-2 h-3.5 w-3.5" />
                            Edit members
                          </DropdownMenuItem>
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

      {/* ── Create dialog ────────────────────────────────────────── */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create plan group</DialogTitle>
            <DialogDescription>
              The slug is the operator-facing identifier and must be unique catalog-wide. The
              display name is what customers see in the "Switch plan" section. Members can be added
              after creating the group.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="pg-name">Slug</Label>
              <Input
                id="pg-name"
                value={createName}
                onChange={(e) => setCreateName(e.target.value)}
                placeholder="clientgamma-public"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="pg-display-name">Display name</Label>
              <Input
                id="pg-display-name"
                value={createDisplayName}
                onChange={(e) => setCreateDisplayName(e.target.value)}
                placeholder="ClientGamma tiers"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="pg-description">Description</Label>
              <Input
                id="pg-description"
                value={createDescription}
                onChange={(e) => setCreateDescription(e.target.value)}
                placeholder="Public ClientGamma ladder"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              <X className="mr-1 h-4 w-4" /> Cancel
            </Button>
            <Button onClick={handleCreate} disabled={creating}>
              {creating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Edit group (metadata-only) dialog ────────────────────── */}
      <Dialog
        open={editingMetaId !== null}
        onOpenChange={(open) => {
          if (!open) setEditingMetaId(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingDetail
                ? `Edit ${editingDetail.displayName ?? editingDetail.name}`
                : 'Edit plan group'}
            </DialogTitle>
            <DialogDescription>
              Display name, description and active state. Member templates are managed from the row
              dropdown's <em>Edit members</em> entry.
            </DialogDescription>
          </DialogHeader>

          {loadingDetail && (
            <div className="flex justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          )}

          {!loadingDetail && editingDetail && editingMetaId !== null && (
            <div className="space-y-3">
              {editingDetail.id === DEFAULT_PLAN_GROUP_ID && (
                <p className="text-caption bg-muted/50 rounded-md border border-border px-3 py-2">
                  Platform-default plan group. Every new billing account is auto-assigned here.
                  Deactivating or renaming is disabled — use the API directly for emergency repair.
                </p>
              )}
              <div className="space-y-1">
                <Label htmlFor="edit-display-name">Display name</Label>
                <Input
                  id="edit-display-name"
                  value={editDisplayName}
                  onChange={(e) => setEditDisplayName(e.target.value)}
                  placeholder={editingDetail.name}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-label-muted">Name</Label>
                <Input value={editingDetail.name} disabled />
                <p className="text-caption">Internal identifier — immutable once created.</p>
              </div>
              <div className="space-y-1">
                <Label htmlFor="edit-description">Description</Label>
                <Input
                  id="edit-description"
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  placeholder="What this bundle is for"
                />
              </div>
              <Label className="flex items-center gap-2 text-xs">
                <Switch
                  checked={editIsActive}
                  onCheckedChange={setEditIsActive}
                  aria-label="Toggle active"
                  disabled={editingDetail.id === DEFAULT_PLAN_GROUP_ID}
                />
                Active
              </Label>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingMetaId(null)}>
              <X className="mr-1 h-4 w-4" /> Cancel
            </Button>
            <Button
              onClick={async () => {
                await handleSaveMetadata();
                setEditingMetaId(null);
              }}
              disabled={savingMetadata || !editingDetail}
            >
              {savingMetadata && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Edit members dialog ──────────────────────────────────── */}
      <Dialog
        open={editingMembersId !== null}
        onOpenChange={(open) => {
          if (!open) setEditingMembersId(null);
        }}
      >
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>
              {editingDetail
                ? `Members of ${editingDetail.displayName ?? editingDetail.name}`
                : 'Edit members'}
            </DialogTitle>
            <DialogDescription>
              Templates customers on this group can self-serve switch between. Position controls
              ladder ordering — lower = smaller tier (downgrade target); leave empty for an
              unordered card.
            </DialogDescription>
          </DialogHeader>

          {loadingDetail && (
            <div className="flex justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          )}

          {!loadingDetail && editingDetail && editingMembersId !== null && (
            <div className="max-h-[65vh] space-y-4 overflow-auto pr-2">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-24">Position</TableHead>
                    <TableHead>Template</TableHead>
                    <TableHead className="w-24">Status</TableHead>
                    <TableHead className="w-12" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {editingDetail.members.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4} className="text-body-muted text-center">
                        No members. Add a template below.
                      </TableCell>
                    </TableRow>
                  )}
                  {editingDetail.members.map((m) => (
                    <TableRow key={m.templateId}>
                      <TableCell>
                        <Input
                          type="number"
                          min={0}
                          placeholder="—"
                          value={positionEdits[m.templateId] ?? ''}
                          onChange={(e) =>
                            setPositionEdits((prev) => ({
                              ...prev,
                              [m.templateId]: e.target.value,
                            }))
                          }
                          className="h-8 w-20"
                        />
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="text-body-sm font-medium">{m.templateDisplayName}</span>
                          <span className="text-caption font-mono">{m.templateName}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {m.isActive ? (
                          <Badge variant="default" className="text-xs">
                            Live
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="text-xs">
                            Deprecated
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => handleRemoveMember(m.templateId)}
                          aria-label="Remove member"
                        >
                          <Trash2 className="h-4 w-4 text-muted-foreground" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {/* ── Add member sub-form ───────────────────────── */}
              <div className="rounded-md border border-border p-3">
                <h5 className="text-body-sm mb-2 font-medium">Add template</h5>
                <div className="flex flex-wrap items-end gap-2">
                  <div className="flex flex-col gap-1">
                    <Label className="text-xs">Template</Label>
                    <Select value={addTemplateId} onValueChange={(v) => setAddTemplateId(v)}>
                      <SelectTrigger className="w-72">
                        <SelectValue placeholder="Select template…" />
                      </SelectTrigger>
                      <SelectContent>
                        {addableTemplates.length === 0 && (
                          <SelectItem value="-" disabled>
                            All templates already added
                          </SelectItem>
                        )}
                        {addableTemplates.map((t) => (
                          <SelectItem key={t.id} value={String(t.id)}>
                            {t.displayName ?? t.name} ({t.billingMode})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex flex-col gap-1">
                    <Label className="text-xs">Position (optional)</Label>
                    <Input
                      type="number"
                      min={0}
                      placeholder="—"
                      value={addPosition}
                      onChange={(e) => setAddPosition(e.target.value)}
                      className="w-24"
                    />
                  </div>
                  <Button onClick={handleAddMember} disabled={adding}>
                    {adding && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Add
                  </Button>
                </div>
              </div>

              <p className="text-caption">
                Created {formatDate(editingDetail.createdAt)}
                {editingDetail.createdByUserId ? ` by ${editingDetail.createdByUserId}` : ''}
              </p>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingMembersId(null)}>
              Close
            </Button>
            <Button onClick={handleSavePositions} disabled={dirtyPositions.length === 0}>
              Save positions
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
