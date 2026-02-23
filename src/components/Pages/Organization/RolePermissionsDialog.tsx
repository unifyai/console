'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/UI/dialog';
import { Button } from '@/components/UI/button';
import { Role, Permission } from '@/types/role';
import { ScrollArea } from '@/components/UI/scroll-area';
import { Badge } from '@/components/UI/badge';
import { Plus, X, Building, Folder, Users, Key, Monitor } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/UI/select';
import { Separator } from '@/components/UI/separator';

interface RolePermissionsDialogProps {
  open: boolean;
  setOpen: (open: boolean) => void;
  role: Role | null;
  allPermissions: Permission[];
  onAddPermission: (roleId: number, permissionIds: number[]) => void;
  onRemovePermission: (roleId: number, permissionId: number) => void;
}

const getResourceIcon = (resourceType: string) => {
  switch (resourceType.toLowerCase()) {
    case 'organization':
      return <Building className="h-4 w-4" />;
    case 'project':
      return <Folder className="h-4 w-4" />;
    case 'team':
      return <Users className="h-4 w-4" />;
    case 'interface':
      return <Monitor className="h-4 w-4" />;
    default:
      return <Key className="h-4 w-4" />;
  }
};

const RolePermissionsDialog = ({
  open,
  setOpen,
  role,
  allPermissions,
  onAddPermission,
  onRemovePermission,
}: RolePermissionsDialogProps) => {
  const [selectedPermissionId, setSelectedPermissionId] = useState<string>('');

  if (!role) return null;

  // Filter permissions that the role doesn't have yet
  const rolePermissionIds = role.permissions.map((p) => p.id);
  const availablePermissions = allPermissions.filter((p) => !rolePermissionIds.includes(p.id));

  // Group permissions by resource type
  const groupedPermissions = role.permissions.reduce(
    (acc, perm) => {
      const key = perm.resourceType;
      if (!acc[key]) acc[key] = [];
      acc[key].push(perm);
      return acc;
    },
    {} as Record<string, Permission[]>
  );

  const handleAdd = () => {
    if (selectedPermissionId) {
      onAddPermission(role.id, [parseInt(selectedPermissionId)]);
      setSelectedPermissionId('');
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-2xl">
        <div className="space-y-6">
          {/* Add Permission Section - Only for custom roles */}
          {!role.isSystemRole && (
            <div className="flex items-end gap-2">
              <div className="flex-1 space-y-2">
                <label className="text-title">Add Permission</label>
                <Select value={selectedPermissionId} onValueChange={setSelectedPermissionId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a permission to add" />
                  </SelectTrigger>
                  <SelectContent>
                    {availablePermissions.length > 0 ? (
                      availablePermissions.map((p) => (
                        <SelectItem key={p.id} value={p.id.toString()}>
                          {p.name} ({p.resourceType}:{p.action})
                        </SelectItem>
                      ))
                    ) : (
                      <div className="text-body-muted p-2 text-center">
                        No available permissions to add
                      </div>
                    )}
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={handleAdd} disabled={!selectedPermissionId}>
                <Plus className="mr-1 h-4 w-4" /> Add
              </Button>
            </div>
          )}

          {!role.isSystemRole && <Separator />}

          {/* Permissions List */}
          <div>
            <h4 className="text-title mb-3">Assigned Permissions</h4>
            <ScrollArea className="h-[400px] rounded-md border p-4">
              {role.permissions.length === 0 ? (
                <p className="text-body-muted py-4 text-center">
                  No permissions assigned to this role.
                </p>
              ) : (
                <div className="space-y-6">
                  {Object.entries(groupedPermissions).map(([resource, perms]) => (
                    <div key={resource}>
                      <h5 className="text-label text-semibold mb-2 flex items-center gap-2 uppercase text-muted-foreground">
                        {getResourceIcon(resource)} {resource}
                      </h5>
                      <div className="grid grid-cols-1 gap-1">
                        {perms.map((p) => (
                          <div
                            key={p.id}
                            className="group flex items-start justify-between rounded-md p-2 transition-colors hover:bg-muted"
                          >
                            <div className="flex flex-col gap-0.5">
                              <span className="text-title">{p.name}</span>
                              {p.description && (
                                <span className="text-caption">{p.description}</span>
                              )}
                              <span className="mt-0.5 font-mono text-[10px] text-muted-foreground opacity-50">
                                {p.action}
                              </span>
                            </div>
                            {!role.isSystemRole && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
                                onClick={() => onRemovePermission(role.id, p.id)}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default RolePermissionsDialog;
