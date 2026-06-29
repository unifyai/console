import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAssistantPermissions } from '@/hooks/Assistants/useAssistantPermissions';
import type { Assistant } from '@/types/assistants/assistant';
import { useWorkspace } from '@/components/Pages/Providers/WorkspaceProvider';

vi.mock('@/components/Pages/Providers/WorkspaceProvider', () => ({
  useWorkspace: vi.fn(),
}));

const mockUseWorkspace = vi.mocked(useWorkspace);

function setOrganizationWorkspace({
  currentUserId,
  roleName,
  organizationId = 7,
}: {
  currentUserId: string;
  roleName: 'Owner' | 'Admin' | 'Member' | 'Viewer';
  organizationId?: number;
}) {
  const roleIdByName = {
    Owner: 1,
    Admin: 2,
    Member: 3,
    Viewer: 4,
  } as const;
  mockUseWorkspace.mockReturnValue({
    user: null,
    workspaces: [],
    activeWorkspace: {
      id: String(organizationId),
      name: 'Acme',
      type: 'organization',
    },
    activeOrganization: {
      id: organizationId,
      name: 'Acme',
      ownerId: 'owner-user',
      roleId: roleIdByName[roleName],
      roleName,
      apiKey: 'org-api-key',
    },
    currentUserId,
    isUnifyAdmin: false,
    isUnifyMember: false,
    isWorkspaceSwitchable: true,
    isSwitchingWorkspace: false,
    switchWorkspace: vi.fn(),
  });
}

function buildAssistant(
  overrides: Partial<Assistant> &
    Pick<Assistant, 'agentId' | 'userId' | 'organizationId' | 'isCoordinator'>
): Assistant {
  return {
    ...overrides,
  } as Assistant;
}

describe('useAssistantPermissions coordinator visibility', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('blocks org members from opening another users coordinator chat', () => {
    setOrganizationWorkspace({ currentUserId: 'member-user', roleName: 'Member' });
    const coordinator = buildAssistant({
      agentId: 'owner-coordinator',
      userId: 'owner-user',
      organizationId: 7,
      isCoordinator: true,
    });

    const { result } = renderHook(() => useAssistantPermissions());

    expect(result.current.canOpenAssistantChat(coordinator)).toBe(false);
  });

  it('blocks org admins from opening another users coordinator chat', () => {
    setOrganizationWorkspace({ currentUserId: 'admin-user', roleName: 'Admin' });
    const coordinator = buildAssistant({
      agentId: 'owner-coordinator',
      userId: 'owner-user',
      organizationId: 7,
      isCoordinator: true,
    });

    const { result } = renderHook(() => useAssistantPermissions());

    expect(result.current.canOpenAssistantChat(coordinator)).toBe(false);
  });

  it('blocks org admins from editing another users coordinator', () => {
    setOrganizationWorkspace({ currentUserId: 'admin-user', roleName: 'Admin' });
    const coordinator = buildAssistant({
      agentId: 'owner-coordinator',
      userId: 'owner-user',
      organizationId: 7,
      isCoordinator: true,
    });

    const { result } = renderHook(() => useAssistantPermissions());

    expect(result.current.canWrite(coordinator)).toBe(false);
  });

  it('allows users to open their own org coordinator chat', () => {
    setOrganizationWorkspace({ currentUserId: 'member-user', roleName: 'Member' });
    const coordinator = buildAssistant({
      agentId: 'member-coordinator',
      userId: 'member-user',
      organizationId: 7,
      isCoordinator: true,
    });

    const { result } = renderHook(() => useAssistantPermissions());

    expect(result.current.canOpenAssistantChat(coordinator)).toBe(true);
  });

  it('allows users to edit their own org coordinator', () => {
    setOrganizationWorkspace({ currentUserId: 'member-user', roleName: 'Member' });
    const coordinator = buildAssistant({
      agentId: 'member-coordinator',
      userId: 'member-user',
      organizationId: 7,
      isCoordinator: true,
    });

    const { result } = renderHook(() => useAssistantPermissions());

    expect(result.current.canWrite(coordinator)).toBe(true);
  });
});
