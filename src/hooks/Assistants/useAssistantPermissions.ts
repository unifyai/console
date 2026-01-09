"use client";

import { useMemo } from 'react';
import { useWorkspace } from '@/components/Pages/Providers/WorkspaceProvider';
import { Assistant } from '@/types/assistants/assistant';

/**
 * Permission state for assistant operations.
 * 
 * v0 Implementation:
 * - canHire: Only org Owner can hire in org context; anyone in personal workspace
 * - canWrite/canDelete: Only the assistant creator can modify in org context
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

  return useMemo(() => ({
    isOrgContext,
    isOrgOwner,

    // v0: Only org Owner can hire in org context; anyone can hire in personal workspace
    canHire: !isOrgContext || isOrgOwner,

    // v0: Only assistant creator can write in org context
    // In personal workspace, user always has full access
    canWrite: (assistant: Assistant) => {
      if (!isOrgContext) return true;
      return assistant.userId === currentUserId;
      // TODO v1: Add || isOrgOwner for org owner god-mode
      // TODO v2: Add || checkResourcePermission('assistant:write', assistant.agentId)
    },

    // v0: Only assistant creator can delete in org context
    // Same logic as canWrite for now
    canDelete: (assistant: Assistant) => {
      if (!isOrgContext) return true;
      return assistant.userId === currentUserId;
      // TODO v1: Add || isOrgOwner for org owner god-mode
      // TODO v2: Add || checkResourcePermission('assistant:delete', assistant.agentId)
    },
  }), [isOrgContext, isOrgOwner, currentUserId]);
}


