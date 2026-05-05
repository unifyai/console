import { useState, useCallback, useEffect, useRef } from 'react';
import { Role, RoleActions, Permission } from '@/types/role';
import { toast } from 'sonner';

interface UseRolesOptions {
  /**
   * When `true`, the hook also pulls down the global permissions
   * catalog in parallel with the roles list. Defaults to `false`
   * because most consumers (org-level permission checks, role-name
   * dropdowns, member role pickers) only need the roles themselves —
   * the catalog is exclusively used by the role-management dialogs in
   * `RoleListPanel`, which lazy-loads via `loadPermissions` when its
   * tab is first opened.
   *
   * Splitting the fetch this way removes an eager `GET /v0/permissions`
   * from the default Organizations page load.
   */
  loadPermissions?: boolean;
}

export const useRoles = (
  orgId: number | undefined,
  actions: RoleActions,
  { loadPermissions = false }: UseRolesOptions = {}
) => {
  const [roles, setRoles] = useState<Role[]>([]);
  const [allPermissions, setAllPermissions] = useState<Permission[]>([]);
  // Initialize to `true` (proven pattern, see `useMemoryData`) so the
  // role list renders skeleton rows on first paint instead of briefly
  // flashing an empty body before the fetch effect runs.
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [permissionsLoaded, setPermissionsLoaded] = useState(false);

  // Ref the (otherwise unstable) actions object so callbacks below
  // don't churn on every server-action roundtrip — see useOrganization
  // for the longer story; same root cause.
  const actionsRef = useRef(actions);
  actionsRef.current = actions;

  const fetchRoles = useCallback(async () => {
    if (!orgId) {
      setRoles([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const rolesRes = await actionsRef.current.getRoles(orgId);
      if ('detail' in rolesRes) {
        console.error(rolesRes.detail);
        toast.error('Failed to load roles');
      } else {
        setRoles(rolesRes as Role[]);
      }
    } catch (error) {
      console.error(error);
      toast.error('Failed to load roles data');
    } finally {
      setIsLoading(false);
    }
  }, [orgId]);

  // On-demand permissions catalog fetch. Idempotent — repeated calls
  // (e.g. when `RoleListPanel` re-mounts) reuse the already-loaded
  // list rather than re-fetching.
  const fetchPermissions = useCallback(async () => {
    if (permissionsLoaded) return;
    try {
      const permsRes = await actionsRef.current.getAllPermissions();
      if ('detail' in permsRes) {
        console.error(permsRes.detail);
      } else {
        setAllPermissions(permsRes as Permission[]);
        setPermissionsLoaded(true);
      }
    } catch (error) {
      console.error(error);
    }
  }, [permissionsLoaded]);

  useEffect(() => {
    fetchRoles();
  }, [fetchRoles]);

  useEffect(() => {
    if (loadPermissions) {
      fetchPermissions();
    }
  }, [loadPermissions, fetchPermissions]);

  // --- Handlers ---

  const handleCreateRole = async (name: string, description: string, permissionIds: number[]) => {
    if (!orgId) return;
    try {
      const res = await actions.createRole(orgId, name, description, permissionIds);

      if ('detail' in res) {
        toast.error(res.detail);
      } else {
        toast.success('Role created');
        fetchRoles();
      }
    } catch (e) {
      toast.error('Failed to create role');
    }
  };

  const handleUpdateRole = async (roleId: number, name: string, description: string) => {
    if (!orgId) return;
    try {
      const res = await actions.updateRole(orgId, roleId, name, description);

      if ('detail' in res) {
        toast.error(res.detail);
      } else {
        toast.success('Role updated');
        fetchRoles();
      }
    } catch (e) {
      toast.error('Failed to update role');
    }
  };

  const handleDeleteRole = async (roleId: number) => {
    if (!orgId) return;
    try {
      const res = await actions.deleteRole(orgId, roleId);

      if (res && 'detail' in res) {
        toast.error(res.detail);
      } else {
        toast.success('Role deleted');
        setRoles((prev) => prev.filter((r) => r.id !== roleId));
      }
    } catch (e) {
      toast.error('Failed to delete role');
    }
  };

  const handleAddPermission = async (roleId: number, permissionIds: number[]) => {
    if (!orgId) return;
    try {
      const res = await actions.addPermissionsToRole(orgId, roleId, permissionIds);

      if ('detail' in res) {
        toast.error(res.detail);
      } else {
        toast.success('Permissions added');
        fetchRoles();
      }
    } catch (e) {
      toast.error('Failed to add permissions');
    }
  };

  const handleRemovePermission = async (roleId: number, permissionId: number) => {
    if (!orgId) return;
    try {
      const res = await actions.removePermissionFromRole(orgId, roleId, permissionId);

      if ('detail' in res) {
        toast.error(res.detail);
      } else {
        toast.success('Permission removed');
        fetchRoles();
      }
    } catch (e) {
      toast.error('Failed to remove permission');
    }
  };

  return {
    roles,
    allPermissions,
    isLoading,
    refreshRoles: fetchRoles,
    loadPermissions: fetchPermissions,
    handleCreateRole,
    handleUpdateRole,
    handleDeleteRole,
    handleAddPermission,
    handleRemovePermission,
  };
};
