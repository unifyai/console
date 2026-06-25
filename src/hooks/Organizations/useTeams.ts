import { useState, useCallback, useEffect, useRef } from 'react';
import { Team, TeamActions } from '@/types/team';
import type { DataSharingMode } from '@/types/organization';
import { toast } from 'sonner';

export const useTeams = (orgId: number | undefined, actions: TeamActions) => {
  const [teams, setTeams] = useState<Team[]>([]);
  // Mirrors the proven pattern in `useBrainData`: initialize to
  // `true` so the first paint of the consumer renders skeleton rows
  // immediately, then flip to `false` in the fetch's `finally`.
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Mirror the latest `actions` through a ref so callbacks can stay
  // structurally stable. Without this, every server-action roundtrip
  // hands the parent server-component a fresh `actions` object,
  // restarting `fetchTeams` on every call → refetch loop.
  const actionsRef = useRef(actions);
  actionsRef.current = actions;

  // Fetch Teams (the list endpoint now includes members inline)
  const fetchTeams = useCallback(async () => {
    if (!orgId) {
      setTeams([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const listRes = await actionsRef.current.getTeams(orgId);

      if ('detail' in listRes) {
        console.error(listRes.detail);
        return;
      }

      setTeams(listRes as Team[]);
    } catch (error) {
      console.error(error);
      toast.error('Failed to load teams');
    } finally {
      setIsLoading(false);
    }
  }, [orgId]);

  // Initial Fetch
  useEffect(() => {
    fetchTeams();
  }, [fetchTeams]);

  // --- Handlers ---

  const handleCreateTeam = async (name: string, description: string) => {
    if (!orgId) return;
    try {
      const res = await actions.createTeam(orgId, name, description);

      if ('detail' in res) {
        toast.error(res.detail);
      } else {
        toast.success('Team created');
        fetchTeams(); // Refresh list
      }
    } catch (e) {
      toast.error('Failed to create team');
    }
  };

  const handleUpdateTeam = async (teamId: number, name: string, description: string) => {
    if (!orgId) return;
    try {
      const res = await actions.updateTeam(orgId, teamId, name, description);

      if ('detail' in res) {
        toast.error(res.detail);
      } else {
        toast.success('Team updated');
        fetchTeams(); // Refresh list
      }
    } catch (e) {
      toast.error('Failed to update team');
    }
  };

  const handleDeleteTeam = async (teamId: number) => {
    if (!orgId) return;
    try {
      const res = await actions.deleteTeam(orgId, teamId);

      if (res && 'detail' in res) {
        toast.error(res.detail);
      } else {
        toast.success('Team deleted');
        setTeams((prev) => prev.filter((t) => t.id !== teamId));
      }
    } catch (e) {
      toast.error('Failed to delete team');
    }
  };

  const handleAddTeamMember = async (teamId: number, userId: string) => {
    if (!orgId) return;
    try {
      const res = await actions.addTeamMember(orgId, teamId, userId);

      if (res && 'detail' in res) {
        toast.error(res.detail);
      } else {
        toast.success('Member added to team');
        fetchTeams();
      }
    } catch (e) {
      toast.error('Failed to add member');
    }
  };

  const handleRemoveTeamMember = async (teamId: number, userId: string) => {
    if (!orgId) return;
    try {
      const res = await actions.removeTeamMember(orgId, teamId, userId);

      if (res && 'detail' in res) {
        toast.error(res.detail);
      } else {
        toast.success('Member removed from team');
        fetchTeams();
      }
    } catch (e) {
      toast.error('Failed to remove member');
    }
  };

  const handleUpdateOrgSharingMode = async (dataSharingMode: DataSharingMode) => {
    if (!orgId) return null;
    try {
      const res = await actions.updateOrgSharingMode(orgId, dataSharingMode);

      if ('detail' in res) {
        toast.error('Could not update sharing settings. Please try again.');
        return null;
      }

      toast.success(dataSharingMode === 'shared' ? 'Org sharing enabled' : 'Org sharing disabled');
      await fetchTeams();
      return res;
    } catch (e) {
      console.error(e);
      toast.error('Could not update sharing settings. Please try again.');
      return null;
    }
  };

  return {
    teams,
    isLoading,
    refreshTeams: fetchTeams,
    handleCreateTeam,
    handleUpdateTeam,
    handleDeleteTeam,
    handleAddTeamMember,
    handleRemoveTeamMember,
    handleUpdateOrgSharingMode,
  };
};
