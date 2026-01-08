import { ResponseProps } from "./common";

export interface Permission {
  id: number;
  name: string;
  description?: string;
  resourceType: string;
  action: string;
  createdAt: string;
}

export interface Role {
  id: number;
  name: string;
  description?: string;
  organizationId?: number;
  isSystemRole: boolean;
  createdAt: string;
  permissions: Permission[];
}

export interface RoleActions {
  getRoles: (orgId: number) => Promise<Role[] | ResponseProps>;
  createRole: (orgId: number, name: string, description: string, permissionIds: number[]) => Promise<Role | ResponseProps>;
  updateRole: (orgId: number, roleId: number, name: string, description: string) => Promise<Role | ResponseProps>;
  deleteRole: (orgId: number, roleId: number) => Promise<void | ResponseProps>;
  getAllPermissions: () => Promise<Permission[] | ResponseProps>;
  addPermissionsToRole: (orgId: number, roleId: number, permissionIds: number[]) => Promise<Role | ResponseProps>;
  removePermissionFromRole: (orgId: number, roleId: number, permissionId: number) => Promise<Role | ResponseProps>;
}
