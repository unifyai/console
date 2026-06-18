'use client';

import { useState } from 'react';
import { Team } from '@/types/team';
import { OrganizationMember } from '@/types/organization';
import type { DataSharingMode } from '@/types/organization';
import { Input } from '@/components/UI/input';
import { Search, MoreVertical, Trash2, UserPlus, UserMinus, Pencil } from 'lucide-react';
import { Button } from '@/components/UI/button';
import CreateTeamDialog from './CreateTeamDialog';
import UpdateTeamDialog from './UpdateTeamDialog';
import { Switch } from '@/components/UI/switch';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/UI/dropdown-menu';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/UI/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/UI/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/UI/select';
import PrimaryButton from '@/components/Common/Buttons/Primary';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/UI/tooltip';
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
interface TeamListPanelProps {
  teams: Team[];
  members: OrganizationMember[];
  isLoading?: boolean;
  orgSharingMode: DataSharingMode;
  canManageOrgSharing: boolean;
  onCreateTeam: (name: string, desc: string) => void;
  onUpdateTeam: (teamId: number, name: string, desc: string) => void;
  onDeleteTeam: (id: number) => void;
  onAddMember: (teamId: number, userId: string) => void;
  onRemoveMember: (teamId: number, userId: string) => void;
  onUpdateOrgSharingMode: (dataSharingMode: DataSharingMode) => Promise<unknown>;
}

const TeamListPanel = ({
  teams,
  members,
  isLoading = false,
  orgSharingMode,
  canManageOrgSharing,
  onCreateTeam,
  onUpdateTeam,
  onDeleteTeam,
  onAddMember,
  onRemoveMember,
  onUpdateOrgSharingMode,
}: TeamListPanelProps) => {
  const [search, setSearch] = useState('');
  const [addMemberDialogOpen, setAddMemberDialogOpen] = useState(false);
  const [removeMemberDialogOpen, setRemoveMemberDialogOpen] = useState(false);
  const [updateTeamDialogOpen, setUpdateTeamDialogOpen] = useState(false);
  const [disableSharingDialogOpen, setDisableSharingDialogOpen] = useState(false);
  const [isUpdatingSharing, setIsUpdatingSharing] = useState(false);

  const [selectedTeamId, setSelectedTeamId] = useState<number | null>(null);
  const [selectedUserId, setSelectedUserId] = useState<string>('');

  const filteredTeams = teams.filter((t) => t.name.toLowerCase().includes(search.toLowerCase()));
  const selectedTeam = teams.find((t) => t.id === selectedTeamId);
  const sharingEnabled = orgSharingMode === 'shared' || teams.some((team) => team.isOrgWideSharing);

  const handleAddMemberClick = (teamId: number) => {
    setSelectedTeamId(teamId);
    setSelectedUserId('');
    setAddMemberDialogOpen(true);
  };

  const handleRemoveMemberClick = (teamId: number) => {
    setSelectedTeamId(teamId);
    setSelectedUserId('');
    setRemoveMemberDialogOpen(true);
  };

  const handleUpdateTeamClick = (teamId: number) => {
    setSelectedTeamId(teamId);
    setUpdateTeamDialogOpen(true);
  };

  const executeAddMember = () => {
    if (selectedTeamId && selectedUserId) {
      onAddMember(selectedTeamId, selectedUserId);
      setAddMemberDialogOpen(false);
    }
  };

  const executeRemoveMember = () => {
    if (selectedTeamId && selectedUserId) {
      onRemoveMember(selectedTeamId, selectedUserId);
      setRemoveMemberDialogOpen(false);
    }
  };

  const executeUpdateTeam = (name: string, desc: string) => {
    if (selectedTeamId) {
      onUpdateTeam(selectedTeamId, name, desc);
    }
  };

  const updateSharingMode = async (nextMode: DataSharingMode) => {
    setIsUpdatingSharing(true);
    try {
      await onUpdateOrgSharingMode(nextMode);
    } finally {
      setIsUpdatingSharing(false);
      setDisableSharingDialogOpen(false);
    }
  };

  const availableMembers = members.filter((m) => {
    if (!selectedTeamId) return false;
    const team = teams.find((t) => t.id === selectedTeamId);
    if (!team) return false;
    if (!team.members || team.members.length === 0) return true;
    return !team.members.includes(m.userId);
  });

  const currentTeamMembers = members.filter((m) => {
    if (!selectedTeamId) return false;
    const team = teams.find((t) => t.id === selectedTeamId);
    if (!team || !team.members) return false;
    return team.members.includes(m.userId);
  });

  return (
    <div className="flex w-full flex-1 flex-col bg-background" data-testid="team-list-panel">
      {/* Header */}
      <div className="flex flex-shrink-0 flex-col gap-4 border-b p-4">
        <div className="flex flex-col gap-4 rounded-lg border bg-card p-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex flex-col gap-1">
              <p className="text-body font-medium text-foreground">Org-wide sharing</p>
              <p className="text-caption max-w-3xl text-muted-foreground">
                {sharingEnabled
                  ? 'All current and future org members and droids are included in the managed Org team for optional shared knowledge, skills, and know-how.'
                  : 'Droids learn privately unless you enable a managed Org team for optional shared knowledge, skills, and know-how.'}
              </p>
            </div>
            <Switch
              checked={sharingEnabled}
              disabled={!canManageOrgSharing || isUpdatingSharing}
              aria-label="Toggle org-wide sharing"
              data-testid="org-sharing-toggle"
              onCheckedChange={(checked) => {
                if (checked) {
                  updateSharingMode('shared');
                } else {
                  setDisableSharingDialogOpen(true);
                }
              }}
            />
          </div>
          {sharingEnabled && (
            <p
              className="text-caption text-muted-foreground"
              data-testid="org-sharing-enabled-copy"
            >
              The managed Org team cannot be renamed, deleted, or manually edited. Disable org-wide
              sharing to remove it and delete its shared contents.
            </p>
          )}
        </div>

        <div className="flex items-center gap-2">
          <CreateTeamDialog onCreate={onCreateTeam} />
          <div className="relative w-64">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search teams..."
              className="pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-auto px-3">
        <Table className="table-fixed">
          <TableHeader>
            <TableRow>
              <TableHead className="w-[30%]">Team</TableHead>
              <TableHead className="w-[45%]">Description</TableHead>
              <TableHead className="w-[15%] text-center">Members</TableHead>
              <TableHead className="w-[10%] text-right"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && filteredTeams.length === 0 ? (
              Array.from({ length: 5 }).map((_, i) => <TeamRowSkeleton key={`team-skel-${i}`} />)
            ) : filteredTeams.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-body-muted py-12 text-center">
                  No teams found.
                </TableCell>
              </TableRow>
            ) : null}
            {filteredTeams.map((team) => (
              <TableRow key={team.id} className="hover:bg-muted/50">
                <TableCell className="font-medium">
                  <div className="flex min-w-0 items-center gap-2">
                    <div className="truncate" title={team.name}>
                      {team.name}
                    </div>
                    {team.isOrgWideSharing && (
                      <span className="text-caption shrink-0 rounded-full border border-border px-2 py-0.5 text-muted-foreground">
                        Managed
                      </span>
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  <div className="truncate" title={team.description}>
                    {team.description || '-'}
                  </div>
                </TableCell>
                <TableCell className="text-body text-center">{team.members?.length || 0}</TableCell>
                <TableCell className="text-right">
                  {team.isOrgWideSharing ? (
                    <span className="text-caption text-muted-foreground">Managed</span>
                  ) : (
                    <DropdownMenu>
                      <TooltipProvider delayDuration={300}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                aria-label="More team"
                              >
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>More team</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleAddMemberClick(team.id)}>
                          <UserPlus className="mr-2 h-4 w-4" /> Add member
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleRemoveMemberClick(team.id)}>
                          <UserMinus className="mr-2 h-4 w-4" /> Remove member
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => handleUpdateTeamClick(team.id)}>
                          <Pencil className="mr-2 h-4 w-4" /> Update team
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => onDeleteTeam(team.id)}
                          className="text-destructive"
                        >
                          <Trash2 className="mr-2 h-4 w-4" /> Delete team
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Update Team Dialog */}
      <UpdateTeamDialog
        open={updateTeamDialogOpen}
        setOpen={setUpdateTeamDialogOpen}
        initialName={selectedTeam?.name || ''}
        initialDescription={selectedTeam?.description || ''}
        onUpdate={executeUpdateTeam}
      />

      <AlertDialog open={disableSharingDialogOpen} onOpenChange={setDisableSharingDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Disable Org-Wide Sharing?</AlertDialogTitle>
            <AlertDialogDescription>
              This will delete the managed Org team and all shared knowledge, skills, and general
              know-how stored in that shared pool. This cannot be undone. Transcripts, emails, and
              files are not shared through this pool.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isUpdatingSharing}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={isUpdatingSharing}
              onClick={() => updateSharingMode('private')}
              className="hover:bg-destructive/90 bg-destructive text-destructive-foreground"
              data-testid="confirm-disable-org-sharing"
            >
              Disable sharing
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Add Member Dialog */}
      <Dialog open={addMemberDialogOpen} onOpenChange={setAddMemberDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Member to Team</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <Select value={selectedUserId} onValueChange={setSelectedUserId}>
              <SelectTrigger>
                <SelectValue placeholder="Select a member" />
              </SelectTrigger>
              <SelectContent>
                {availableMembers.length > 0 ? (
                  availableMembers.map((m) => (
                    <SelectItem key={m.userId} value={m.userId}>
                      {m.name || m.email || 'Unknown User'}
                    </SelectItem>
                  ))
                ) : (
                  <div className="text-body-muted p-2 text-center">No available members</div>
                )}
              </SelectContent>
            </Select>
            <div className="flex justify-end">
              <Button variant="outline" onClick={executeAddMember} disabled={!selectedUserId}>
                Add
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Remove Member Dialog */}
      <Dialog open={removeMemberDialogOpen} onOpenChange={setRemoveMemberDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove Member from Team</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <Select value={selectedUserId} onValueChange={setSelectedUserId}>
              <SelectTrigger>
                <SelectValue placeholder="Select a member to remove" />
              </SelectTrigger>
              <SelectContent>
                {currentTeamMembers.length > 0 ? (
                  currentTeamMembers.map((m) => (
                    <SelectItem key={m.userId} value={m.userId}>
                      {m.name || m.email || 'Unknown User'}
                    </SelectItem>
                  ))
                ) : (
                  <div className="text-body-muted p-2 text-center">No members in this team</div>
                )}
              </SelectContent>
            </Select>
            <div className="flex justify-end">
              <PrimaryButton
                label="Remove"
                onClick={executeRemoveMember}
                disabled={!selectedUserId}
              />
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default TeamListPanel;

// Use raw `<div>` with `bg-muted` (proven pattern from `MemoryTable`)
// instead of the global `<Skeleton>` component. The latter applies
// `bg-primary/10`, an opacity-modified CSS variable that silently
// no-ops in our theme (vars are raw hex, not HSL channels), making the
// placeholder invisible.
function SkeletonBar({ className }: { className?: string }) {
  return <div className={`animate-pulse rounded-md bg-muted ${className ?? ''}`} />;
}

function TeamRowSkeleton() {
  return (
    <TableRow>
      <TableCell>
        <SkeletonBar className="h-3.5 w-32" />
      </TableCell>
      <TableCell>
        <SkeletonBar className="h-3.5 w-64" />
      </TableCell>
      <TableCell>
        <div className="flex justify-center">
          <SkeletonBar className="h-3.5 w-6" />
        </div>
      </TableCell>
      <TableCell className="text-right">
        <div className="flex justify-end">
          <SkeletonBar className="h-7 w-7 rounded-md" />
        </div>
      </TableCell>
    </TableRow>
  );
}
