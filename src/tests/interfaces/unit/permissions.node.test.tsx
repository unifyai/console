import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { useProjectPermissions } from '@/contexts/hooks/interface/useProjectPermissions';

// Mock fetch for teams/members queries
global.fetch = vi.fn();

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });
  const Wrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  Wrapper.displayName = 'TestQueryClientWrapper';
  return Wrapper;
};

// Helper to create mock functions for the hook
const createMockOptions = (
  overrides: {
    projectData?: any;
    accessData?: any;
    rolesData?: any;
    userId?: string;
    selectedProject?: string | null;
  } = {}
) => {
  const {
    projectData = null,
    accessData = { access_entries: [] },
    rolesData = [],
    userId = 'user-123',
    selectedProject = 'test-project',
  } = overrides;

  return {
    userId,
    selectedProject,
    getProject: vi.fn().mockResolvedValue(projectData),
    fetchPermissions: vi.fn().mockResolvedValue(accessData),
    fetchRoles: vi.fn().mockResolvedValue(rolesData),
  };
};

describe('useProjectPermissions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Mock fetch for teams/members API calls
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([]),
    });
  });

  it('should return true for project:write if user is owner (personal project)', async () => {
    const options = createMockOptions({
      projectData: {
        id: 1,
        name: 'test-project',
        userId: 'user-123', // Same as userId - personal owner
        organizationId: null, // Personal project
      },
    });

    const { result } = renderHook(() => useProjectPermissions(options), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // Personal project - should have full permissions
    expect(result.current.hasWrite).toBe(true);
    expect(result.current.hasDelete).toBe(true);
    expect(result.current.isOwner).toBe(true);
    expect(result.current.roleName).toBe('Owner');
    expect(result.current.isOrgProject).toBe(false);
  });

  it('should return false for project:write if role permissions do not include it', async () => {
    const options = createMockOptions({
      projectData: {
        id: 1,
        name: 'test-project',
        userId: 'other-user',
        organizationId: 100,
      },
      accessData: {
        access_entries: [
          {
            id: 1,
            resource_type: 'project',
            resource_id: 1,
            roleId: 2,
            roleName: 'Viewer',
            grantee_type: 'user',
            grantee_id: 'user-123',
            createdAt: '2024-01-01T00:00:00Z',
          },
        ],
      },
      rolesData: [
        {
          id: 2,
          name: 'Viewer',
          description: 'Read-only access',
          is_system_role: true,
          createdAt: '2024-01-01T00:00:00Z',
          permissions: [
            {
              id: 1,
              name: 'project:read',
              resource_type: 'project',
              action: 'read',
              createdAt: '2024-01-01T00:00:00Z',
            },
          ],
        },
      ],
    });

    const { result } = renderHook(() => useProjectPermissions(options), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.hasWrite).toBe(false);
    expect(result.current.hasDelete).toBe(false);
    expect(result.current.isOwner).toBe(false);
    expect(result.current.roleName).toBe('Viewer');
  });

  it('should return true for project:delete if role has project:delete', async () => {
    const options = createMockOptions({
      projectData: {
        id: 1,
        name: 'test-project',
        userId: 'other-user',
        organizationId: 100,
      },
      accessData: {
        access_entries: [
          {
            id: 1,
            resource_type: 'project',
            resource_id: 1,
            roleId: 3,
            roleName: 'Admin',
            grantee_type: 'user',
            grantee_id: 'user-123',
            createdAt: '2024-01-01T00:00:00Z',
          },
        ],
      },
      rolesData: [
        {
          id: 3,
          name: 'Admin',
          description: 'Admin access',
          is_system_role: true,
          createdAt: '2024-01-01T00:00:00Z',
          permissions: [
            {
              id: 1,
              name: 'project:read',
              resource_type: 'project',
              action: 'read',
              createdAt: '2024-01-01T00:00:00Z',
            },
            {
              id: 2,
              name: 'project:write',
              resource_type: 'project',
              action: 'write',
              createdAt: '2024-01-01T00:00:00Z',
            },
            {
              id: 3,
              name: 'project:delete',
              resource_type: 'project',
              action: 'delete',
              createdAt: '2024-01-01T00:00:00Z',
            },
          ],
        },
      ],
    });

    const { result } = renderHook(() => useProjectPermissions(options), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.hasWrite).toBe(true);
    expect(result.current.hasDelete).toBe(true);
    expect(result.current.roleName).toBe('Admin');
  });

  it('should handle personal projects implicitly as owner', async () => {
    const options = createMockOptions({
      projectData: {
        id: 1,
        name: 'test-project',
        userId: 'user-123',
        organizationId: null, // Personal project
      },
    });

    const { result } = renderHook(() => useProjectPermissions(options), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // Personal project (organizationId is null) should have full permissions
    expect(result.current.hasWrite).toBe(true);
    expect(result.current.hasDelete).toBe(true);
    expect(result.current.isOwner).toBe(true);
    expect(result.current.isOrgProject).toBe(false);
  });

  it('should return Owner permissions when role is Owner', async () => {
    const options = createMockOptions({
      projectData: {
        id: 1,
        name: 'test-project',
        userId: 'other-user',
        organizationId: 100,
      },
      accessData: {
        access_entries: [
          {
            id: 1,
            resource_type: 'project',
            resource_id: 1,
            roleId: 1,
            roleName: 'Owner',
            grantee_type: 'user',
            grantee_id: 'user-123',
            createdAt: '2024-01-01T00:00:00Z',
          },
        ],
      },
      rolesData: [
        {
          id: 1,
          name: 'Owner',
          description: 'Full access',
          is_system_role: true,
          createdAt: '2024-01-01T00:00:00Z',
          permissions: [
            {
              id: 1,
              name: 'project:read',
              resource_type: 'project',
              action: 'read',
              createdAt: '2024-01-01T00:00:00Z',
            },
            {
              id: 2,
              name: 'project:write',
              resource_type: 'project',
              action: 'write',
              createdAt: '2024-01-01T00:00:00Z',
            },
            {
              id: 3,
              name: 'project:delete',
              resource_type: 'project',
              action: 'delete',
              createdAt: '2024-01-01T00:00:00Z',
            },
          ],
        },
      ],
    });

    const { result } = renderHook(() => useProjectPermissions(options), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.hasWrite).toBe(true);
    expect(result.current.hasDelete).toBe(true);
    expect(result.current.isOwner).toBe(true);
    expect(result.current.roleName).toBe('Owner');
  });

  it('should return no permissions when user has no access entry', async () => {
    const options = createMockOptions({
      projectData: {
        id: 1,
        name: 'test-project',
        userId: 'other-user',
        organizationId: 100,
      },
      accessData: {
        access_entries: [
          {
            id: 1,
            resource_type: 'project',
            resource_id: 1,
            roleId: 2,
            roleName: 'Viewer',
            grantee_type: 'user',
            grantee_id: 'different-user', // Different user
            createdAt: '2024-01-01T00:00:00Z',
          },
        ],
      },
      rolesData: [
        {
          id: 2,
          name: 'Viewer',
          is_system_role: true,
          createdAt: '2024-01-01T00:00:00Z',
          permissions: [
            {
              id: 1,
              name: 'project:read',
              resource_type: 'project',
              action: 'read',
              createdAt: '2024-01-01T00:00:00Z',
            },
          ],
        },
      ],
    });

    const { result } = renderHook(() => useProjectPermissions(options), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.hasWrite).toBe(false);
    expect(result.current.hasDelete).toBe(false);
    expect(result.current.isOwner).toBe(false);
    expect(result.current.roleName).toBeNull();
  });

  it('should handle write-only role (write without delete)', async () => {
    const options = createMockOptions({
      projectData: {
        id: 1,
        name: 'test-project',
        userId: 'other-user',
        organizationId: 100,
      },
      accessData: {
        access_entries: [
          {
            id: 1,
            resource_type: 'project',
            resource_id: 1,
            roleId: 4,
            roleName: 'Editor',
            grantee_type: 'user',
            grantee_id: 'user-123',
            createdAt: '2024-01-01T00:00:00Z',
          },
        ],
      },
      rolesData: [
        {
          id: 4,
          name: 'Editor',
          description: 'Can edit but not delete',
          is_system_role: true,
          createdAt: '2024-01-01T00:00:00Z',
          permissions: [
            {
              id: 1,
              name: 'project:read',
              resource_type: 'project',
              action: 'read',
              createdAt: '2024-01-01T00:00:00Z',
            },
            {
              id: 2,
              name: 'project:write',
              resource_type: 'project',
              action: 'write',
              createdAt: '2024-01-01T00:00:00Z',
            },
            // No project:delete
          ],
        },
      ],
    });

    const { result } = renderHook(() => useProjectPermissions(options), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.hasWrite).toBe(true);
    expect(result.current.hasDelete).toBe(false);
    expect(result.current.isOwner).toBe(false);
    expect(result.current.roleName).toBe('Editor');
  });

  it('should return default permissions when selectedProject is null', async () => {
    const options = createMockOptions({
      selectedProject: null,
    });

    const { result } = renderHook(() => useProjectPermissions(options), {
      wrapper: createWrapper(),
    });

    // Should return default empty permissions when no project selected
    expect(result.current.hasWrite).toBe(false);
    expect(result.current.hasDelete).toBe(false);
    expect(result.current.isOwner).toBe(false);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.projectId).toBeNull();
  });

  it('should expose accessEntries for sharing UI', async () => {
    const accessEntries = [
      {
        id: 1,
        resource_type: 'project',
        resource_id: 1,
        roleId: 1,
        roleName: 'Owner',
        grantee_type: 'user',
        grantee_id: 'user-123',
        granteeName: 'user@example.com',
        createdAt: '2024-01-01T00:00:00Z',
      },
      {
        id: 2,
        resource_type: 'project',
        resource_id: 1,
        roleId: 2,
        roleName: 'Viewer',
        grantee_type: 'team',
        grantee_id: 'team-456',
        granteeName: 'Engineering Team',
        createdAt: '2024-01-01T00:00:00Z',
      },
    ];

    const options = createMockOptions({
      projectData: {
        id: 1,
        name: 'test-project',
        userId: 'other-user',
        organizationId: 100,
      },
      accessData: {
        access_entries: accessEntries,
      },
      rolesData: [
        {
          id: 1,
          name: 'Owner',
          is_system_role: true,
          createdAt: '2024-01-01T00:00:00Z',
          permissions: [
            {
              id: 1,
              name: 'project:read',
              resource_type: 'project',
              action: 'read',
              createdAt: '2024-01-01T00:00:00Z',
            },
            {
              id: 2,
              name: 'project:write',
              resource_type: 'project',
              action: 'write',
              createdAt: '2024-01-01T00:00:00Z',
            },
            {
              id: 3,
              name: 'project:delete',
              resource_type: 'project',
              action: 'delete',
              createdAt: '2024-01-01T00:00:00Z',
            },
          ],
        },
      ],
    });

    const { result } = renderHook(() => useProjectPermissions(options), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.accessEntries).toHaveLength(2);
    expect(result.current.accessEntries[0].granteeName).toBe('user@example.com');
    expect(result.current.accessEntries[1].granteeType).toBe('team');
  });

  it('should expose availableRoles for role selection', async () => {
    const roles = [
      {
        id: 1,
        name: 'Owner',
        is_system_role: true,
        createdAt: '2024-01-01T00:00:00Z',
        permissions: [],
      },
      {
        id: 2,
        name: 'Viewer',
        is_system_role: true,
        createdAt: '2024-01-01T00:00:00Z',
        permissions: [],
      },
      {
        id: 3,
        name: 'Editor',
        is_system_role: true,
        createdAt: '2024-01-01T00:00:00Z',
        permissions: [],
      },
    ];

    const options = createMockOptions({
      projectData: {
        id: 1,
        name: 'test-project',
        userId: 'other-user',
        organizationId: 100,
      },
      accessData: {
        access_entries: [
          {
            id: 1,
            resource_type: 'project',
            resource_id: 1,
            roleId: 1,
            roleName: 'Owner',
            grantee_type: 'user',
            grantee_id: 'user-123',
            createdAt: '2024-01-01T00:00:00Z',
          },
        ],
      },
      rolesData: roles,
    });

    const { result } = renderHook(() => useProjectPermissions(options), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.availableRoles).toHaveLength(3);
    expect(result.current.availableRoles.map((r) => r.name)).toEqual(['Owner', 'Viewer', 'Editor']);
  });

  it('should expose refetch function', async () => {
    const options = createMockOptions({
      projectData: {
        id: 1,
        name: 'test-project',
        userId: 'other-user',
        organizationId: 100,
      },
      accessData: { access_entries: [] },
      rolesData: [],
    });

    const { result } = renderHook(() => useProjectPermissions(options), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // refetch should be a function
    expect(typeof result.current.refetch).toBe('function');
  });

  it('should expose availableTeams and availableMembers', async () => {
    const mockTeams = [
      { id: 1, name: 'Engineering', organizationId: 100, createdAt: '2024-01-01' },
    ];
    const mockMembers = [
      {
        id: 1,
        userId: 'user-1',
        organizationId: 100,
        roleId: 1,
        roleName: 'Admin',
        createdAt: '2024-01-01',
        name: 'John',
        email: 'john@example.com',
      },
    ];

    // Mock fetch to return teams and members
    (global.fetch as any).mockImplementation((url: string) => {
      if (url.includes('/teams')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockTeams),
        });
      }
      if (url.includes('/members')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockMembers),
        });
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve([]),
      });
    });

    const options = createMockOptions({
      projectData: {
        id: 1,
        name: 'test-project',
        userId: 'other-user',
        organizationId: 100,
      },
      accessData: { access_entries: [] },
      rolesData: [],
    });

    const { result } = renderHook(() => useProjectPermissions(options), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    await waitFor(() => {
      expect(result.current.availableTeams).toHaveLength(1);
    });

    expect(result.current.availableTeams[0].name).toBe('Engineering');
    expect(result.current.availableMembers[0].name).toBe('John');
  });
});
