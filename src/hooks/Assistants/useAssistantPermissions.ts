'use client';

import { useMemo } from 'react';
import { useWorkspace } from '@/components/Pages/Providers/WorkspaceProvider';
import { Assistant } from '@/types/assistants/assistant';

/**
 * Permission state for assistant operations.
 *
 * Current Implementation:
 * - canHire: Only org Owner or Admin can hire in org context; anyone in personal workspace
 * - canWrite/canDelete: Assistant creator, org Owner, or org Admin can modify in org context;
 *   regular org Members can only view but not edit other members' assistants
 *
 * Future: Will be extended to use full RBAC with assistant:read/write/delete permissions
 */
export interface AssistantPermissions {
  /** Whether we're in an organization workspace */
  isOrgContext: boolean;
  /** Whether the current user is the org Owner */
  isOrgOwner: boolean;
  /** Whether the user can hire (create) new assistants */
  canHire: boolean;
  /** Check if user can write (edit) a specific assistant */
  canWrite: (assistant: Assistant) => boolean;
  /** Check if user can delete a specific assistant */
  canDelete: (assistant: Assistant) => boolean;
}

/**
 * Hook to determine assistant permissions based on workspace context.
 *
 * Consumes WorkspaceProvider context internally - no props needed.
 *
 * @returns AssistantPermissions object with permission flags and checkers
 *
 * @example
 * ```tsx
 * const { canHire, canWrite, canDelete } = useAssistantPermissions();
 *
 * // In component:
 * {canHire && <Button>Hire New Assistant</Button>}
 * {canWrite(assistant) && <Button>Edit</Button>}
 * {canDelete(assistant) && <Button>Delete</Button>}
 * ```
 */
export function useAssistantPermissions(): AssistantPermissions {
  const { activeWorkspace, activeOrganization, currentUserId } = useWorkspace();

  const isOrgContext = activeWorkspace?.type === 'organization';
  const isOrgOwner = activeOrganization?.roleName === 'Owner';
  const isOrgAdmin = activeOrganization?.roleName === 'Admin';

  return useMemo(
    () => ({
      isOrgContext,
      isOrgOwner,

      // v0: Owner or Admin can hire in org context; anyone can hire in personal workspace
      canHire: !isOrgContext || isOrgOwner || isOrgAdmin,

      // Assistant creator, org owner, or org admin can write in org context
      // In personal workspace, user always has full access
      canWrite: (assistant: Assistant) => {
        if (!isOrgContext) return true;
        return assistant.userId === currentUserId || isOrgOwner || isOrgAdmin;
        // TODO v2: Add || checkResourcePermission('assistant:write', assistant.agentId)
      },

      // Assistant creator, org owner, or org admin can delete in org context
      // Same logic as canWrite for now
      canDelete: (assistant: Assistant) => {
        if (!isOrgContext) return true;
        return assistant.userId === currentUserId || isOrgOwner || isOrgAdmin;
        // TODO v2: Add || checkResourcePermission('assistant:delete', assistant.agentId)
      },
    }),
    [isOrgContext, isOrgOwner, isOrgAdmin, currentUserId]
  );
}
