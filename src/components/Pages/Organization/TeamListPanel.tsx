"use client";

import { useState } from "react";
import { Team } from "@/types/team"; 
import { OrganizationMember } from "@/types/organization";
import { Input } from "@/components/UI/input";
import { Search, MoreVertical, Trash2, UserPlus, UserMinus, Pencil } from "lucide-react";
import { Button } from "@/components/UI/button";
import CreateTeamDialog from "./CreateTeamDialog";
import UpdateTeamDialog from "./UpdateTeamDialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator
} from "@/components/UI/dropdown-menu";
import {
    Dialog, DialogContent, DialogHeader, DialogTitle
} from "@/components/UI/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/UI/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/UI/select";
import PrimaryButton from "@/components/Common/Buttons/Primary";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/UI/tooltip";

interface TeamListPanelProps {
  teams: Team[];
  members: OrganizationMember[]; 
  onCreateTeam: (name: string, desc: string) => void;
  onUpdateTeam: (teamId: number, name: string, desc: string) => void;
  onDeleteTeam: (id: number) => void;
  onAddMember: (teamId: number, userId: string) => void;
  onRemoveMember: (teamId: number, userId: string) => void;
}

const TeamListPanel = ({ teams, members, onCreateTeam, onUpdateTeam, onDeleteTeam, onAddMember, onRemoveMember }: TeamListPanelProps) => {
  const [search, setSearch] = useState("");
  const [addMemberDialogOpen, setAddMemberDialogOpen] = useState(false);
  const [removeMemberDialogOpen, setRemoveMemberDialogOpen] = useState(false);
  const [updateTeamDialogOpen, setUpdateTeamDialogOpen] = useState(false);

  const [selectedTeamId, setSelectedTeamId] = useState<number | null>(null);
  const [selectedUserId, setSelectedUserId] = useState<string>("");

  const filteredTeams = teams.filter(t => t.name.toLowerCase().includes(search.toLowerCase()));
  const selectedTeam = teams.find(t => t.id === selectedTeamId);

  const handleAddMemberClick = (teamId: number) => {
      setSelectedTeamId(teamId);
      setSelectedUserId(""); 
      setAddMemberDialogOpen(true);
  }

  const handleRemoveMemberClick = (teamId: number) => {
      setSelectedTeamId(teamId);
      setSelectedUserId(""); 
      setRemoveMemberDialogOpen(true);
  }

  const handleUpdateTeamClick = (teamId: number) => {
      setSelectedTeamId(teamId);
      setUpdateTeamDialogOpen(true);
  }

  const executeAddMember = () => {
      if(selectedTeamId && selectedUserId) {
          onAddMember(selectedTeamId, selectedUserId);
          setAddMemberDialogOpen(false);
      }
  }

  const executeRemoveMember = () => {
      if(selectedTeamId && selectedUserId) {
          onRemoveMember(selectedTeamId, selectedUserId);
          setRemoveMemberDialogOpen(false);
      }
  }

  const executeUpdateTeam = (name: string, desc: string) => {
      if (selectedTeamId) {
          onUpdateTeam(selectedTeamId, name, desc);
      }
  }

  const availableMembers = members.filter(m => {
      if (!selectedTeamId) return false;
      const team = teams.find(t => t.id === selectedTeamId);
      if (!team) return false;
      if (!team.members || team.members.length === 0) return true;
      return !team.members.includes(m.user_id);
  });

  const currentTeamMembers = members.filter(m => {
      if (!selectedTeamId) return false;
      const team = teams.find(t => t.id === selectedTeamId);
      if (!team || !team.members) return false;
      return team.members.includes(m.user_id);
  });

  return (
    <div className="h-full flex flex-col border-l bg-background shadow-xl w-full">
      {/* Header */}
      <div className="p-4 border-b flex flex-col gap-4">
        <div className="flex items-center justify-between gap-2">
            <div className="relative flex-1">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input 
                    placeholder="Search Team" 
                    className="pl-9"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                />
            </div>
            <CreateTeamDialog onCreate={onCreateTeam} />
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-auto px-3">
        {filteredTeams.length === 0 ? (
            <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                No teams found.
            </div>
        ) : (
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead className="w-[30%]">Team</TableHead>
                        <TableHead className="w-[45%]">Description</TableHead>
                        <TableHead className="w-[15%] text-center">Members</TableHead>
                        <TableHead className="w-[10%] text-right"></TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {filteredTeams.map(team => (
                        <TableRow key={team.id} className="hover:bg-muted/50">
                            <TableCell className="font-medium">
                                <div className="truncate max-w-[150px]" title={team.name}>
                                    {team.name}
                                </div>
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                                <div className="truncate max-w-[200px]" title={team.description}>
                                    {team.description || "-"}
                                </div>
                            </TableCell>
                            <TableCell className="text-center text-sm">
                                {team.members?.length || 0}
                            </TableCell>
                            <TableCell className="text-right">
                                <DropdownMenu>
                                    <TooltipProvider delayDuration={300}>
                                        <Tooltip>
                                            <TooltipTrigger asChild>
                                                <DropdownMenuTrigger asChild>
                                                    <Button variant="ghost" size="icon" className="h-8 w-8">
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
                                        <DropdownMenuItem onClick={() => onDeleteTeam(team.id)} className="text-destructive">
                                            <Trash2 className="mr-2 h-4 w-4" /> Delete team
                                        </DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        )}
      </div>

      {/* Update Team Dialog */}
      <UpdateTeamDialog 
        open={updateTeamDialogOpen}
        setOpen={setUpdateTeamDialogOpen}
        initialName={selectedTeam?.name || ""}
        initialDescription={selectedTeam?.description || ""}
        onUpdate={executeUpdateTeam}
      />

      {/* Add Member Dialog */}
      <Dialog open={addMemberDialogOpen} onOpenChange={setAddMemberDialogOpen}>
        <DialogContent>
            <DialogHeader><DialogTitle>Add Member to Team</DialogTitle></DialogHeader>
            <div className="py-4 space-y-4">
                <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                    <SelectTrigger>
                        <SelectValue placeholder="Select a member" />
                    </SelectTrigger>
                    <SelectContent>
                        {availableMembers.length > 0 ? (
                            availableMembers.map(m => (
                                <SelectItem key={m.user_id} value={m.user_id}>
                                    {m.name || m.email || "Unknown User"}
                                </SelectItem>
                            ))
                        ) : (
                            <div className="p-2 text-sm text-muted-foreground text-center">No available members</div>
                        )}
                    </SelectContent>
                </Select>
                <div className="flex justify-end">
                    <Button 
                        variant="outline" 
                        onClick={executeAddMember} 
                        disabled={!selectedUserId}
                    >
                        Add
                    </Button>
                </div>
            </div>
        </DialogContent>
      </Dialog>

      {/* Remove Member Dialog */}
      <Dialog open={removeMemberDialogOpen} onOpenChange={setRemoveMemberDialogOpen}>
        <DialogContent>
            <DialogHeader><DialogTitle>Remove Member from Team</DialogTitle></DialogHeader>
            <div className="py-4 space-y-4">
                <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                    <SelectTrigger><SelectValue placeholder="Select a member to remove" /></SelectTrigger>
                    <SelectContent>
                        {currentTeamMembers.length > 0 ? (
                            currentTeamMembers.map(m => (
                                <SelectItem key={m.user_id} value={m.user_id}>
                                    {m.name || m.email || "Unknown User"}
                                </SelectItem>
                            ))
                        ) : (
                            <div className="p-2 text-sm text-muted-foreground text-center">No members in this team</div>
                        )}
                    </SelectContent>
                </Select>
                <div className="flex justify-end">
                    <PrimaryButton label="Remove" onClick={executeRemoveMember} disabled={!selectedUserId}/>
                </div>
            </div>
        </DialogContent>
      </Dialog>

    </div>
  );
};

export default TeamListPanel;