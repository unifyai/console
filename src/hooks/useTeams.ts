import { useState, useCallback, useEffect } from 'react';
import { Team, TeamActions } from '@/types/team';
import { toast } from 'sonner';

export const useTeams = (orgId: number | undefined, actions: TeamActions) => {
  const [teams, setTeams] = useState<Team[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Fetch Teams and their details (members)
  const fetchTeams = useCallback(async () => {
    if (!orgId) {
      setTeams([]);
      return;
    }

    setIsLoading(true);
    try {
      // 1. Get the list of teams
      const listRes = await actions.getTeams(orgId);

      if ('detail' in listRes) {
        console.error(listRes.detail);
        return;
      }

      const basicTeams = listRes as Team[];

      // 2. Fetch details for each team to get the member list
      const detailedTeams = await Promise.all(
        basicTeams.map(async (t) => {
          const details = await actions.getTeamDetails(orgId, t.id);
          return 'detail' in details ? t : (details as Team);
        })
      );

      setTeams(detailedTeams);
    } catch (error) {
      console.error(error);
      toast.error('Failed to load teams');
    } finally {
      setIsLoading(false);
    }
  }, [orgId, actions]);

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

  return {
    teams,
    isLoading,
    refreshTeams: fetchTeams,
    handleCreateTeam,
    handleUpdateTeam,
    handleDeleteTeam,
    handleAddTeamMember,
    handleRemoveTeamMember,
  };
};
