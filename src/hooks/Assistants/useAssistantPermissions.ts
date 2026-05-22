'use client';

import { useMemo } from 'react';
import { useWorkspace } from '@/components/Pages/Providers/WorkspaceProvider';
import { Assistant } from '@/types/assistants/assistant';

/**
 * Permission state for assistant operations.
 *
 * - canHire: Only org Owner or Admin can hire in org context; anyone in personal workspace
 * - canWrite/canDelete: Assistant creator, org Owner, or org Admin can modify in org context;
 *   regular org Members can only view but not edit other members' assistants.
 * - Personal coordinator chat/write access is owner-scoped; org coordinator chat follows active org scope.
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
  /** Check if user can end a specific assistant contract */
  canEndContract: (assistant: Assistant) => boolean;
  /** Check if user can open the Coordinator chat surface */
  canOpenAssistantChat: (assistant: Assistant) => boolean;
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
  const activeOrganizationId = activeOrganization?.id ?? null;
  const isOrgOwner = activeOrganization?.roleName === 'Owner';
  const isOrgAdmin = activeOrganization?.roleName === 'Admin';

  return useMemo(
    () => ({
      isOrgContext,
      isOrgOwner,

      // Owner or Admin can hire in org context; anyone can hire in personal workspace.
      canHire: !isOrgContext || isOrgOwner || isOrgAdmin,

      // Assistant creator, org owner, or org admin can write in org context.
      // Personal coordinator lifecycle stays owner-scoped.
      // In personal workspace, user always has full access.
      canWrite: (assistant: Assistant) => {
        if (assistant.isCoordinator) {
          if (assistant.organizationId === null) return assistant.userId === currentUserId;
          if (!isOrgContext || activeOrganizationId == null) return false;
          if (assistant.organizationId !== activeOrganizationId) return false;
          return assistant.userId === currentUserId || isOrgOwner || isOrgAdmin;
        }
        if (!isOrgContext) return true;
        return assistant.userId === currentUserId || isOrgOwner || isOrgAdmin;
      },

      // Assistant creator, org owner, or org admin can delete in org context.
      canDelete: (assistant: Assistant) => {
        if (assistant.isCoordinator) return false;
        if (!isOrgContext) return true;
        return assistant.userId === currentUserId || isOrgOwner || isOrgAdmin;
      },

      canEndContract: (assistant: Assistant) => {
        if (assistant.isCoordinator) return false;
        if (!isOrgContext) return true;
        return assistant.userId === currentUserId || isOrgOwner || isOrgAdmin;
      },

      canOpenAssistantChat: (assistant: Assistant) => {
        if (!assistant.isCoordinator) return true;
        if (assistant.organizationId === null) {
          return assistant.userId === currentUserId;
        }
        return (
          isOrgContext &&
          activeOrganizationId != null &&
          assistant.organizationId === activeOrganizationId
        );
      },
    }),
    [activeOrganizationId, currentUserId, isOrgAdmin, isOrgContext, isOrgOwner]
  );
}
