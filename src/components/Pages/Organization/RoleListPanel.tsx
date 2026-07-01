'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import { Role, Permission } from '@/types/role';
import { cn } from '@/lib/utils';
import { Input } from '@/components/UI/input';
import { Search, MoreVertical, Trash2, Pencil, Shield } from 'lucide-react';
import { Button } from '@/components/UI/button';

// All three role-management dialogs are only mounted on user
// interaction (Create button click, kebab → Edit / Manage
// Permissions). Loading them lazily keeps them out of the
// Organizations initial JS bundle, where they used to ride along
// even on the default Organization tab.
const CreateRoleDialog = dynamic(() => import('./CreateRoleDialog'), { ssr: false });
const UpdateRoleDialog = dynamic(() => import('./UpdateRoleDialog'), { ssr: false });
const RolePermissionsDialog = dynamic(() => import('./RolePermissionsDialog'), { ssr: false });
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
  isLoading?: boolean;
  onCreateRole: (name: string, description: string, permissionIds: number[]) => void;
  onUpdateRole: (roleId: number, name: string, description: string) => void;
  onDeleteRole: (roleId: number) => void;
  onAddPermission: (roleId: number, permissionIds: number[]) => void;
  onRemovePermission: (roleId: number, permissionId: number) => void;
}

const RoleListPanel = ({
  roles,
  allPermissions,
  isLoading = false,
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
    <div className="flex w-full flex-1 flex-col bg-background" data-testid="role-list-panel">
      {/* Header */}
      <div className="flex flex-shrink-0 flex-col gap-4 border-b p-4">
        <div className="flex items-center gap-2">
          <CreateRoleDialog onCreate={onCreateRole} availablePermissions={allPermissions} />
          <div className="relative w-64">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search roles..."
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
              <TableHead className="w-[30%]">Role</TableHead>
              <TableHead className="w-[20%]">Type</TableHead>
              <TableHead className="w-[25%]">Description</TableHead>
              <TableHead className="w-[15%] text-center">Perms</TableHead>
              <TableHead className="w-[10%] text-right"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && filteredRoles.length === 0 ? (
              Array.from({ length: 5 }).map((_, i) => <RoleRowSkeleton key={`role-skel-${i}`} />)
            ) : filteredRoles.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-body-muted py-12 text-center">
                  No roles found.
                </TableCell>
              </TableRow>
            ) : null}
            {filteredRoles.map((role) => (
              <TableRow key={role.id} className="hover:bg-muted/50">
                <TableCell className="font-medium">
                  <div className="truncate" title={role.name}>
                    {role.name}
                  </div>
                </TableCell>
                <TableCell>
                  <Badge
                    variant={role.isSystemRole ? undefined : 'outline'}
                    className={cn(
                      'h-5 text-[10px] font-normal',
                      role.isSystemRole && 'border-transparent bg-muted text-muted-foreground'
                    )}
                  >
                    {role.isSystemRole ? 'System' : 'Custom'}
                  </Badge>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  <TooltipProvider delayDuration={300}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="cursor-help truncate">{role.description || '-'}</div>
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

// Use raw `<div>` with `bg-muted` (proven pattern from `BrainTable`)
// instead of the global `<Skeleton>` component when a muted placeholder
// is needed without the shimmer treatment.
function SkeletonBar({ className }: { className?: string }) {
  return <div className={`animate-pulse rounded-md bg-muted ${className ?? ''}`} />;
}

function RoleRowSkeleton() {
  return (
    <TableRow>
      <TableCell>
        <SkeletonBar className="h-3.5 w-32" />
      </TableCell>
      <TableCell>
        <SkeletonBar className="h-5 w-14 rounded-full" />
      </TableCell>
      <TableCell>
        <SkeletonBar className="h-3.5 w-48" />
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
