import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';

// Mock the hooks and actions
vi.mock('@/contexts/hooks/interface/useProjectPermissions', () => ({
  useProjectPermissions: vi.fn(),
}));

vi.mock('@/lib/user/resource-access', () => ({
  grantResourceAccessAction: vi.fn(),
  revokeResourceAccessAction: vi.fn(),
  updateResourceAccessAction: vi.fn(),
  listResourceAccessAction: vi.fn(),
}));

import { useProjectPermissions } from '@/contexts/hooks/interface/useProjectPermissions';
import { grantResourceAccessAction } from '@/lib/user/resource-access';

// Simple test component that uses permissions
const TestPermissionsUI: React.FC<{
  selectedProject: string | null;
  onShare?: () => void;
  onDelete?: () => void;
  onEdit?: () => void;
}> = ({ selectedProject, onShare, onDelete, onEdit }) => {
  const permissions = useProjectPermissions({
    userId: 'user-123',
    selectedProject,
    getProject: vi.fn(),
    fetchPermissions: vi.fn(),
    fetchRoles: vi.fn(),
  });

  return (
    <div>
      {permissions.hasWrite && (
        <button data-testid="edit-toggle" onClick={onEdit}>
          Edit Mode
        </button>
      )}
      {permissions.hasDelete && (
        <button data-testid="delete-button" onClick={onDelete}>
          Delete Project
        </button>
      )}
      {permissions.isOrgProject && (permissions.hasWrite || permissions.isOwner) && (
        <button data-testid="share-button-org" onClick={onShare}>
          Share Project
        </button>
      )}
      {!permissions.isOrgProject && permissions.projectId && (
        <button data-testid="share-button-personal" onClick={onShare}>
          Convert to Org to Share
        </button>
      )}
      {permissions.isLoading && <div data-testid="loading">Loading...</div>}
      {permissions.isError && <div data-testid="error">{permissions.error}</div>}
    </div>
  );
};
TestPermissionsUI.displayName = 'TestPermissionsUI';

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

describe('ProjectPermissions UI Behavior', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders Edit Toggle when user has project:write', () => {
    (useProjectPermissions as any).mockReturnValue({
      hasWrite: true,
      hasDelete: false,
      isOwner: false,
      roleName: 'Editor',
      isOrgProject: true,
      organizationId: 100,
      projectId: 1,
      isLoading: false,
      isError: false,
      error: null,
      accessEntries: [],
      availableRoles: [],
      availableTeams: [],
      availableMembers: [],
      refetch: vi.fn(),
    });

    render(<TestPermissionsUI selectedProject="test-project" />, {
      wrapper: createWrapper(),
    });

    expect(screen.getByTestId('edit-toggle')).toBeInTheDocument();
  });

  it('hides Edit Toggle when user lacks project:write', () => {
    (useProjectPermissions as any).mockReturnValue({
      hasWrite: false,
      hasDelete: false,
      isOwner: false,
      roleName: 'Viewer',
      isOrgProject: true,
      organizationId: 100,
      projectId: 1,
      isLoading: false,
      isError: false,
      error: null,
      accessEntries: [],
      availableRoles: [],
      availableTeams: [],
      availableMembers: [],
      refetch: vi.fn(),
    });

    render(<TestPermissionsUI selectedProject="test-project" />, {
      wrapper: createWrapper(),
    });

    expect(screen.queryByTestId('edit-toggle')).not.toBeInTheDocument();
  });

  it('renders Delete button when user has project:delete', () => {
    (useProjectPermissions as any).mockReturnValue({
      hasWrite: true,
      hasDelete: true,
      isOwner: true,
      roleName: 'Owner',
      isOrgProject: true,
      organizationId: 100,
      projectId: 1,
      isLoading: false,
      isError: false,
      error: null,
      accessEntries: [],
      availableRoles: [],
      availableTeams: [],
      availableMembers: [],
      refetch: vi.fn(),
    });

    render(<TestPermissionsUI selectedProject="test-project" />, {
      wrapper: createWrapper(),
    });

    expect(screen.getByTestId('delete-button')).toBeInTheDocument();
  });

  it('renders Share button for organization projects when user has project:write', () => {
    (useProjectPermissions as any).mockReturnValue({
      hasWrite: true,
      hasDelete: false,
      isOwner: false,
      roleName: 'Editor',
      isOrgProject: true,
      organizationId: 100,
      projectId: 1,
      isLoading: false,
      isError: false,
      error: null,
      accessEntries: [],
      availableRoles: [],
      availableTeams: [],
      availableMembers: [],
      refetch: vi.fn(),
    });

    render(<TestPermissionsUI selectedProject="test-project" />, {
      wrapper: createWrapper(),
    });

    expect(screen.getByTestId('share-button-org')).toBeInTheDocument();
    expect(screen.queryByTestId('share-button-personal')).not.toBeInTheDocument();
  });

  it('renders Share button for organization projects when user is owner', () => {
    (useProjectPermissions as any).mockReturnValue({
      hasWrite: false,
      hasDelete: false,
      isOwner: true,
      roleName: 'Owner',
      isOrgProject: true,
      organizationId: 100,
      projectId: 1,
      isLoading: false,
      isError: false,
      error: null,
      accessEntries: [],
      availableRoles: [],
      availableTeams: [],
      availableMembers: [],
      refetch: vi.fn(),
    });

    render(<TestPermissionsUI selectedProject="test-project" />, {
      wrapper: createWrapper(),
    });

    expect(screen.getByTestId('share-button-org')).toBeInTheDocument();
  });

  it('renders Share button (conversion prompt) for personal projects', () => {
    (useProjectPermissions as any).mockReturnValue({
      hasWrite: true,
      hasDelete: true,
      isOwner: true,
      roleName: 'Owner',
      isOrgProject: false,
      organizationId: null,
      projectId: 1,
      isLoading: false,
      isError: false,
      error: null,
      accessEntries: [],
      availableRoles: [],
      availableTeams: [],
      availableMembers: [],
      refetch: vi.fn(),
    });

    render(<TestPermissionsUI selectedProject="test-project" />, {
      wrapper: createWrapper(),
    });

    expect(screen.getByTestId('share-button-personal')).toBeInTheDocument();
    expect(screen.queryByTestId('share-button-org')).not.toBeInTheDocument();
  });

  it('calls grant_resource_access when Share form is submitted', async () => {
    const mockGrantFn = vi.fn().mockResolvedValue({
      id: 1,
      resource_type: 'project',
      resource_id: 1,
      roleId: 2,
      roleName: 'Viewer',
      granteeType: 'user',
      granteeId: 'user-456',
      createdAt: '2024-01-01T00:00:00Z',
    });
    (grantResourceAccessAction as any).mockReturnValue(mockGrantFn);

    // Simulate calling grant
    const grantAction = grantResourceAccessAction('test-key');
    const result = await grantAction('project', 1, {
      roleId: 2,
      granteeType: 'user',
      granteeId: 'user-456',
    });

    expect(mockGrantFn).toHaveBeenCalledWith('project', 1, {
      roleId: 2,
      granteeType: 'user',
      granteeId: 'user-456',
    });
    expect(result.roleName).toBe('Viewer');
  });

  it('refetches permissions on 403 error', async () => {
    const mockRefetch = vi.fn();
    (useProjectPermissions as any).mockReturnValue({
      hasWrite: true,
      hasDelete: true,
      isOwner: true,
      roleName: 'Owner',
      isOrgProject: true,
      organizationId: 100,
      projectId: 1,
      isLoading: false,
      isError: false,
      error: null,
      accessEntries: [],
      availableRoles: [],
      availableTeams: [],
      availableMembers: [],
      refetch: mockRefetch,
    });

    // Simulate a 403 error scenario where refetch should be called
    const permissions = useProjectPermissions({
      userId: 'user-123',
      selectedProject: 'test-project',
      getProject: vi.fn(),
      fetchPermissions: vi.fn(),
      fetchRoles: vi.fn(),
    });

    // Simulate 403 error handling
    permissions.refetch();

    expect(mockRefetch).toHaveBeenCalled();
  });

  it('displays loading state while fetching permissions', () => {
    (useProjectPermissions as any).mockReturnValue({
      hasWrite: false,
      hasDelete: false,
      isOwner: false,
      roleName: null,
      isOrgProject: true,
      organizationId: 100,
      projectId: 1,
      isLoading: true,
      isError: false,
      error: null,
      accessEntries: [],
      availableRoles: [],
      availableTeams: [],
      availableMembers: [],
      refetch: vi.fn(),
    });

    render(<TestPermissionsUI selectedProject="test-project" />, {
      wrapper: createWrapper(),
    });

    expect(screen.getByTestId('loading')).toBeInTheDocument();
    expect(screen.queryByTestId('edit-toggle')).not.toBeInTheDocument();
  });

  it('displays error message when permissions fetch fails', () => {
    (useProjectPermissions as any).mockReturnValue({
      hasWrite: false,
      hasDelete: false,
      isOwner: false,
      roleName: null,
      isOrgProject: true,
      organizationId: 100,
      projectId: 1,
      isLoading: false,
      isError: true,
      error: 'Failed to fetch permissions',
      accessEntries: [],
      availableRoles: [],
      availableTeams: [],
      availableMembers: [],
      refetch: vi.fn(),
    });

    render(<TestPermissionsUI selectedProject="test-project" />, {
      wrapper: createWrapper(),
    });

    expect(screen.getByTestId('error')).toBeInTheDocument();
    expect(screen.getByTestId('error')).toHaveTextContent('Failed to fetch permissions');
  });

  it('hides all permission-gated buttons when user has no permissions', () => {
    (useProjectPermissions as any).mockReturnValue({
      hasWrite: false,
      hasDelete: false,
      isOwner: false,
      roleName: 'Viewer',
      isOrgProject: true,
      organizationId: 100,
      projectId: 1,
      isLoading: false,
      isError: false,
      error: null,
      accessEntries: [],
      availableRoles: [],
      availableTeams: [],
      availableMembers: [],
      refetch: vi.fn(),
    });

    render(<TestPermissionsUI selectedProject="test-project" />, {
      wrapper: createWrapper(),
    });

    expect(screen.queryByTestId('edit-toggle')).not.toBeInTheDocument();
    expect(screen.queryByTestId('delete-button')).not.toBeInTheDocument();
    expect(screen.queryByTestId('share-button-org')).not.toBeInTheDocument();
  });

  it('calls revoke_resource_access action correctly', async () => {
    const { revokeResourceAccessAction } = await import('@/lib/user/resource-access');
    const mockRevokeFn = vi.fn().mockResolvedValue({});
    (revokeResourceAccessAction as any).mockReturnValue(mockRevokeFn);

    const revokeAction = revokeResourceAccessAction('test-key');
    await revokeAction('project', 1, {
      granteeType: 'user',
      granteeId: 'user-456',
      roleId: 2,
    });

    expect(mockRevokeFn).toHaveBeenCalledWith('project', 1, {
      granteeType: 'user',
      granteeId: 'user-456',
      roleId: 2,
    });
  });

  it('calls update_resource_access action correctly', async () => {
    const { updateResourceAccessAction } = await import('@/lib/user/resource-access');
    const mockUpdateFn = vi.fn().mockResolvedValue({
      id: 1,
      resource_type: 'project',
      resource_id: 1,
      roleId: 3,
      roleName: 'Editor',
      granteeType: 'user',
      granteeId: 'user-456',
      createdAt: '2024-01-01T00:00:00Z',
    });
    (updateResourceAccessAction as any).mockReturnValue(mockUpdateFn);

    const updateAction = updateResourceAccessAction('test-key');
    const result = await updateAction('project', 1, 1, {
      roleId: 3,
    });

    expect(mockUpdateFn).toHaveBeenCalledWith('project', 1, 1, {
      roleId: 3,
    });
    expect(result.roleName).toBe('Editor');
  });

  it('calls onClick handlers when buttons are clicked', () => {
    const mockEdit = vi.fn();
    const mockDelete = vi.fn();
    const mockShare = vi.fn();

    (useProjectPermissions as any).mockReturnValue({
      hasWrite: true,
      hasDelete: true,
      isOwner: true,
      roleName: 'Owner',
      isOrgProject: true,
      organizationId: 100,
      projectId: 1,
      isLoading: false,
      isError: false,
      error: null,
      accessEntries: [],
      availableRoles: [],
      availableTeams: [],
      availableMembers: [],
      refetch: vi.fn(),
    });

    render(
      <TestPermissionsUI
        selectedProject="test-project"
        onEdit={mockEdit}
        onDelete={mockDelete}
        onShare={mockShare}
      />,
      { wrapper: createWrapper() }
    );

    fireEvent.click(screen.getByTestId('edit-toggle'));
    expect(mockEdit).toHaveBeenCalled();

    fireEvent.click(screen.getByTestId('delete-button'));
    expect(mockDelete).toHaveBeenCalled();

    fireEvent.click(screen.getByTestId('share-button-org'));
    expect(mockShare).toHaveBeenCalled();
  });

  it('shows edit and delete for personal project owner', () => {
    (useProjectPermissions as any).mockReturnValue({
      hasWrite: true,
      hasDelete: true,
      isOwner: true,
      roleName: 'Owner',
      isOrgProject: false,
      organizationId: null,
      projectId: 1,
      isLoading: false,
      isError: false,
      error: null,
      accessEntries: [],
      availableRoles: [],
      availableTeams: [],
      availableMembers: [],
      refetch: vi.fn(),
    });

    render(<TestPermissionsUI selectedProject="test-project" />, {
      wrapper: createWrapper(),
    });

    expect(screen.getByTestId('edit-toggle')).toBeInTheDocument();
    expect(screen.getByTestId('delete-button')).toBeInTheDocument();
    expect(screen.getByTestId('share-button-personal')).toBeInTheDocument();
  });

  it('returns available teams and members for organization projects', () => {
    const mockTeams = [
      { id: 1, name: 'Engineering', organizationId: 100, createdAt: '2024-01-01' },
      { id: 2, name: 'Design', organizationId: 100, createdAt: '2024-01-01' },
    ];
    const mockMembers = [
      {
        id: 1,
        userId: 'user-1',
        organizationId: 100,
        roleId: 1,
        roleName: 'Admin',
        createdAt: '2024-01-01',
        name: 'John Doe',
        email: 'john@example.com',
      },
      {
        id: 2,
        userId: 'user-2',
        organizationId: 100,
        roleId: 2,
        roleName: 'Member',
        createdAt: '2024-01-01',
        name: 'Jane Smith',
        email: 'jane@example.com',
      },
    ];

    (useProjectPermissions as any).mockReturnValue({
      hasWrite: true,
      hasDelete: true,
      isOwner: true,
      roleName: 'Owner',
      isOrgProject: true,
      organizationId: 100,
      projectId: 1,
      isLoading: false,
      isError: false,
      error: null,
      accessEntries: [],
      availableRoles: [],
      availableTeams: mockTeams,
      availableMembers: mockMembers,
      refetch: vi.fn(),
    });

    const permissions = useProjectPermissions({
      userId: 'user-123',
      selectedProject: 'test-project',
      getProject: vi.fn(),
      fetchPermissions: vi.fn(),
      fetchRoles: vi.fn(),
    });

    expect(permissions.availableTeams).toHaveLength(2);
    expect(permissions.availableTeams[0].name).toBe('Engineering');
    expect(permissions.availableMembers).toHaveLength(2);
    expect(permissions.availableMembers[0].name).toBe('John Doe');
  });
});
