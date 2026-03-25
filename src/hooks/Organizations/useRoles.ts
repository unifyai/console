import { useState, useCallback, useEffect } from 'react';
import { Role, RoleActions, Permission } from '@/types/role';
import { toast } from 'sonner';

export const useRoles = (orgId: number | undefined, actions: RoleActions) => {
  const [roles, setRoles] = useState<Role[]>([]);
  const [allPermissions, setAllPermissions] = useState<Permission[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Fetch Roles and Permissions
  const fetchData = useCallback(async () => {
    if (!orgId) {
      setRoles([]);
      return;
    }

    setIsLoading(true);
    try {
      const [rolesRes, permsRes] = await Promise.all([
        actions.getRoles(orgId),
        actions.getAllPermissions(),
      ]);

      if ('detail' in rolesRes) {
        console.error(rolesRes.detail);
        toast.error('Failed to load roles');
      } else {
        setRoles(rolesRes as Role[]);
      }

      if ('detail' in permsRes) {
        console.error(permsRes.detail);
      } else {
        setAllPermissions(permsRes as Permission[]);
      }
    } catch (error) {
      console.error(error);
      toast.error('Failed to load roles data');
    } finally {
      setIsLoading(false);
    }
  }, [orgId, actions]);

  // Initial Fetch
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // --- Handlers ---

  const handleCreateRole = async (name: string, description: string, permissionIds: number[]) => {
    if (!orgId) return;
    try {
      const res = await actions.createRole(orgId, name, description, permissionIds);

      if ('detail' in res) {
        toast.error(res.detail);
      } else {
        toast.success('Role created');
        fetchData();
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
        fetchData();
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
        fetchData();
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
        fetchData();
      }
    } catch (e) {
      toast.error('Failed to remove permission');
    }
  };

  return {
    roles,
    allPermissions,
    isLoading,
    refreshRoles: fetchData,
    handleCreateRole,
    handleUpdateRole,
    handleDeleteRole,
    handleAddPermission,
    handleRemovePermission,
  };
};
