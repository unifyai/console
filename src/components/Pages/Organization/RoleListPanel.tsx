'use client';

import { useState } from 'react';
import { Role, Permission } from '@/types/role';
import { Input } from '@/components/UI/input';
import { Search, MoreVertical, Trash2, Pencil, Shield } from 'lucide-react';
import { Button } from '@/components/UI/button';
import CreateRoleDialog from './CreateRoleDialog';
import UpdateRoleDialog from './UpdateRoleDialog';
import RolePermissionsDialog from './RolePermissionsDialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/UI/dropdown-menu';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/UI/table';
import { Badge } from '@/components/UI/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/UI/tooltip';

interface RoleListPanelProps {
  roles: Role[];
  allPermissions: Permission[];
  onCreateRole: (name: string, description: string, permissionIds: number[]) => void;
  onUpdateRole: (roleId: number, name: string, description: string) => void;
  onDeleteRole: (roleId: number) => void;
  onAddPermission: (roleId: number, permissionIds: number[]) => void;
  onRemovePermission: (roleId: number, permissionId: number) => void;
}

const RoleListPanel = ({
  roles,
  allPermissions,
  onCreateRole,
  onUpdateRole,
  onDeleteRole,
  onAddPermission,
  onRemovePermission,
}: RoleListPanelProps) => {
  const [search, setSearch] = useState('');
  const [updateRoleDialogOpen, setUpdateRoleDialogOpen] = useState(false);
  const [permissionsDialogOpen, setPermissionsDialogOpen] = useState(false);
  const [selectedRoleId, setSelectedRoleId] = useState<number | null>(null);

  const filteredRoles = roles.filter((r) => r.name.toLowerCase().includes(search.toLowerCase()));
  const selectedRole = roles.find((r) => r.id === selectedRoleId) || null;

  const handleUpdateRoleClick = (roleId: number) => {
    setSelectedRoleId(roleId);
    setUpdateRoleDialogOpen(true);
  };

  const handlePermissionsClick = (roleId: number) => {
    setSelectedRoleId(roleId);
    setPermissionsDialogOpen(true);
  };

  const executeUpdateRole = (name: string, desc: string) => {
    if (selectedRoleId) {
      onUpdateRole(selectedRoleId, name, desc);
    }
  };

  return (
    <div
      className="flex h-full w-full flex-col border-l bg-background shadow-xl"
      data-testid="role-list-panel"
    >
      {/* Header */}
      <div className="flex flex-col gap-4 border-b p-4">
        <div className="flex items-center justify-between gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search Roles"
              className="pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <CreateRoleDialog onCreate={onCreateRole} availablePermissions={allPermissions} />
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-auto px-3">
        {filteredRoles.length === 0 ? (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            No roles found.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[30%]">Role</TableHead>
                <TableHead className="w-[20%]">Type</TableHead>
                <TableHead className="w-[25%]">Description</TableHead>
                <TableHead className="w-[15%] text-center">Perms</TableHead>
                <TableHead className="w-[10%] text-right"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredRoles.map((role) => (
                <TableRow key={role.id} className="hover:bg-muted/50">
                  <TableCell className="font-medium">
                    <div className="max-w-[150px] truncate" title={role.name}>
                      {role.name}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={role.isSystemRole ? 'secondary' : 'outline'}
                      className="h-5 text-[10px] font-normal"
                    >
                      {role.isSystemRole ? 'System' : 'Custom'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    <TooltipProvider delayDuration={300}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="max-w-[150px] cursor-help truncate">
                            {role.description || '-'}
                          </div>
                        </TooltipTrigger>
                        <TooltipContent className="max-w-[300px] whitespace-normal">
                          <p>{role.description || 'No description provided.'}</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </TableCell>
                  <TableCell className="text-center text-sm">{role.permissions.length}</TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <TooltipProvider delayDuration={300}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                aria-label="More role"
                              >
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>More role</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handlePermissionsClick(role.id)}>
                          <Shield className="mr-2 h-4 w-4" />{' '}
                          {role.isSystemRole ? 'View Permissions' : 'Manage Permissions'}
                        </DropdownMenuItem>

                        {!role.isSystemRole && (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => handleUpdateRoleClick(role.id)}>
                              <Pencil className="mr-2 h-4 w-4" /> Edit Role
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => onDeleteRole(role.id)}
                              className="text-destructive"
                            >
                              <Trash2 className="mr-2 h-4 w-4" /> Delete Role
                            </DropdownMenuItem>
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Dialogs */}
      <UpdateRoleDialog
        open={updateRoleDialogOpen}
        setOpen={setUpdateRoleDialogOpen}
        initialName={selectedRole?.name || ''}
        initialDescription={selectedRole?.description || ''}
        onUpdate={executeUpdateRole}
      />

      <RolePermissionsDialog
        open={permissionsDialogOpen}
        setOpen={setPermissionsDialogOpen}
        role={selectedRole}
        allPermissions={allPermissions}
        onAddPermission={onAddPermission}
        onRemovePermission={onRemovePermission}
      />
    </div>
  );
};

export default RoleListPanel;
