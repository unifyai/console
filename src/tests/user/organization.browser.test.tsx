import { describe, it, expect, vi, beforeEach, } from 'vitest';
import { render, screen, waitFor, within, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Main from '@/components/Pages/Organization/Main';
import { mockOrgActions, mockTeamActions, mockRoleActions } from './mocks/actions';
import { mockOrganizations, mockUser, mockMembers } from './mocks/data';

// Use vi.hoisted to initialize variables used in mocks
const { mockSwitchWorkspace, activeWorkspaceRef } = vi.hoisted(() => {
    return {
        mockSwitchWorkspace: vi.fn(),
        activeWorkspaceRef: { current: { type: 'organization', id: '1' } }
    };
});

vi.mock("@/components/Pages/Providers/WorkspaceProvider", () => ({
    useWorkspace: () => ({
        get activeWorkspace() { return activeWorkspaceRef.current; },
        switchWorkspace: mockSwitchWorkspace,
    }),
}));

vi.mock("next/navigation", () => ({
    useRouter: () => ({
        refresh: vi.fn(),
        push: vi.fn(),
    }),
}));

describe('Organization Management System', () => {
    
    // Reset mocks and setup default active workspace before each test
    beforeEach(() => {
        vi.clearAllMocks();
        activeWorkspaceRef.current = { type: 'organization', id: '1' };
        // Reset specific mock implementations to default
        mockOrgActions.getMembers.mockResolvedValue(mockMembers);
    });

    const renderMain = () => {
        return render(
            <Main 
                initialOrganizations={mockOrganizations}
                userId={mockUser.id}
                actions={mockOrgActions}
                teamActions={mockTeamActions}
                roleActions={mockRoleActions}
            />
        );
    };

    // Helper to ensure data has loaded before interacting
    const waitForDataLoad = async () => {
        // Wait for the user to appear in the list, indicating members have fetched
        await waitFor(() => expect(screen.getAllByText(/Test User/i)[0]).toBeInTheDocument());
    };

    describe('Organization Lifecycle', () => {
        it('should allow a user to create a new organization successfully',
            {
                meta: {
                    alias: 'create-org-success',
                    behavior: 'User creates a new organization which triggers server action and workspace switch',
                    scenario: 'Happy path organization creation from personal workspace'
                }
            },
            async () => {
            activeWorkspaceRef.current = { type: 'personal', id: 'personal' };
            renderMain();

            const createBtn = screen.getByRole('button', { name: /create organization/i });
            await userEvent.click(createBtn);

            const input = screen.getByPlaceholderText(/acme corp/i);
            await userEvent.type(input, 'New Tech Corp');
            
            const submitBtn = screen.getByRole('button', { name: 'Create' });
            await userEvent.click(submitBtn);

            expect(mockOrgActions.createOrg).toHaveBeenCalledWith('New Tech Corp');
            await waitFor(() => {
                expect(mockSwitchWorkspace).toHaveBeenCalled();
            });
        });

        it('should handle duplicate organization name errors gracefully',
        {
            meta: {
                alias: 'create-org-duplicate',
                behavior: 'System prevents duplicate names via validation before submission',
                scenario: 'User attempts to create org with existing name'
            }
        },
        async () => {
            activeWorkspaceRef.current = { type: 'personal', id: 'personal' };
            
            mockOrgActions.getAllOrganizations = vi.fn().mockResolvedValue({
                organizations: [{ name: 'Existing Corp', id: 5, owner_id: '1', member_count: 1 }],
                limit: 10,
                offset: 0
            });

            renderMain();

            await userEvent.click(screen.getByRole('button', { name: /create organization/i }));
            
            const input = screen.getByPlaceholderText(/acme corp/i);
            await userEvent.type(input, 'Existing Corp');
            
            const submitBtn = screen.getByRole('button', { name: 'Create' });
            await userEvent.click(submitBtn);

            await waitFor(() => {
                expect(screen.getByText(/organization with this name already exists/i)).toBeInTheDocument();
            });
            
            expect(mockOrgActions.createOrg).not.toHaveBeenCalled();
        });

        it('should allow renaming an organization',
        {
            meta: {
                alias: 'update-org-name',
                behavior: 'Renaming updates the server state and reflects immediately',
                scenario: 'Owner corrects a typo in the organization name'
            }
        },
        async () => {
            renderMain();
            await waitForDataLoad();

            // Use getByRole to find the specific action button (Pencil icon often has label)
            const editBtn = screen.getByRole('button', { name: /update organization/i });
            await userEvent.click(editBtn);

            const input = screen.getByPlaceholderText(/organization name/i);
            await userEvent.clear(input);
            await userEvent.type(input, 'Acme Corp Updated');

            const updateBtn = screen.getByRole('button', { name: 'Update' });
            await userEvent.click(updateBtn);

            expect(mockOrgActions.updateOrg).toHaveBeenCalledWith(1, 'Acme Corp Updated');
        });

        it('should support organization deletion with confirmation',
        {
            meta: {
                alias: 'delete-org',
                behavior: 'Deleting organization requires confirmation and redirects to personal workspace',
                scenario: 'Owner dissolves the organization'
            }
        },
        async () => {
            renderMain();
            await waitForDataLoad();

            const deleteBtn = screen.getByRole('button', { name: /delete organization/i });
            await userEvent.click(deleteBtn);

            // Confirm in dialog
            const proceedBtn = screen.getByRole('button', { name: 'Proceed' });
            await userEvent.click(proceedBtn);

            expect(mockOrgActions.deleteOrg).toHaveBeenCalledWith(1);
            await waitFor(() => {
                expect(mockSwitchWorkspace).toHaveBeenCalledWith('personal');
            });
        });

    });

    describe('Member Management & RBAC', () => {
        it('should allow inviting a new member via email', 
        {
            meta: {
                alias: 'invite-member',
                behavior: 'Inviting a user calls server action and refreshes list',
                scenario: 'Admin invites a new colleague via email'
            }
        },
        async () => {
            renderMain();
            await waitForDataLoad();

            const inviteTrigger = screen.getByRole('button', { name: /invite a new member/i });
            await userEvent.click(inviteTrigger);

            const emailInput = screen.getByPlaceholderText(/colleague@organization.com/i);
            await userEvent.type(emailInput, 'new.hire@unify.ai');

            const submitInvite = screen.getByRole('button', { name: 'Invite' });
            await userEvent.click(submitInvite);

            expect(mockOrgActions.inviteMember).toHaveBeenCalledWith(1, 'new.hire@unify.ai');
        });

        it('should validate email format before sending invite',
        {
            meta: {
                alias: 'invite-validation',
                behavior: 'Invalid emails block the invite action locally',
                scenario: 'User types malformed email address'
            }
        },
        async () => {
            renderMain();
            await waitForDataLoad();

            // 1. Open Dialog
            const inviteTrigger = screen.getByRole('button', { name: /invite a new member/i });
            await userEvent.click(inviteTrigger);

            // 2. Find input and ensure dialog is open
            const emailInput = await screen.findByPlaceholderText(/colleague@organization.com/i);
            
            // 3. Type invalid email
            await userEvent.type(emailInput, 'not-an-email');
            
            // Ensure typing is registered
            expect(emailInput).toHaveValue('not-an-email');

            // 4. Submit
            const submitBtn = screen.getByRole('button', { name: 'Invite' });
            await userEvent.click(submitBtn);

            // 5. Wait for validation error to appear
            const errorMsg = await screen.findByText(/Please enter a valid email address/i);
            expect(errorMsg).toBeVisible();
            
            // Ensure API was not called
            expect(mockOrgActions.inviteMember).not.toHaveBeenCalled();
        });

        it('should hide administrative actions for non-admin users',
        {
            meta: {
                alias: 'rbac-ui-restrictions',
                behavior: 'UI elements requiring write permissions are hidden for read-only users',
                scenario: 'Regular member views the organization dashboard'
            }
        },
        async () => {
            // Setup: Current user is a "Member" (Role ID 2), not Owner. 
            // Role 2 has "Read Org" but not "Write Org" in mock data.
            const readOnlyMembers = mockMembers.map(m => 
                m.user_id === mockUser.id 
                ? { ...m, role_id: 2, role_name: 'Member' } 
                : m
            );
            
            mockOrgActions.getMembers.mockResolvedValue(readOnlyMembers);

            renderMain();
            // Wait for load
            await waitFor(() => expect(screen.getAllByText(/Test User/i)[0]).toBeVisible());

            // Assertions: Administrative buttons should not be in the document
            expect(screen.queryByLabelText(/invite a new member/i)).not.toBeInTheDocument();
            expect(screen.queryByLabelText(/delete organization/i)).not.toBeInTheDocument();
            expect(screen.queryByLabelText(/update organization/i)).not.toBeInTheDocument();

            // Verify row actions are limited
            const janeName = screen.getByText('Jane Doe');
            const janeRow = janeName.closest('tr');
            
            // If menu exists, check it doesn't have restricted options
            const menuBtn = within(janeRow!).queryByRole('button', { name: /manage member/i });
            if (menuBtn) {
                await userEvent.click(menuBtn);
                expect(screen.queryByText(/remove member/i)).not.toBeInTheDocument();
                expect(screen.queryByText(/update role/i)).not.toBeInTheDocument();
            }
        });

        it('should filter member list based on search query',
        {
            meta: {
                alias: 'member-search',
                behavior: 'Typing in search bar filters the visible rows immediately',
                scenario: 'User searches for specific employee "Jane"'
            }
        },
        async () => {
            renderMain();
            await waitForDataLoad();
            
            expect(screen.getByText('Jane Doe')).toBeVisible();
            // Test User is present
            expect(screen.getAllByText(/Test User/i)[0]).toBeVisible();

            const searchInput = screen.getByPlaceholderText(/search members/i);
            await userEvent.type(searchInput, 'Jane');

            // Jane should remain, Test User should disappear
            expect(screen.getByText('Jane Doe')).toBeVisible();
            expect(screen.queryByText('Test User')).not.toBeInTheDocument();
        });

        it('should allow removing an existing member',
        {
            meta: {
                alias: 'remove-member',
                behavior: 'Removing a member revokes access immediately',
                scenario: 'Admin offboards an employee'
            }
        },
        async () => {
            renderMain();
            await waitForDataLoad();

            const memberRow = screen.getByText('Jane Doe').closest('tr');
            const menuBtn = within(memberRow!).getByRole('button', { name: /manage member/i });
            await userEvent.click(menuBtn);

            const removeOption = screen.getByText(/remove member/i);
            await userEvent.click(removeOption);

            expect(mockOrgActions.removeMember).toHaveBeenCalledWith(1, 'user_2');
        });

        it('should allow resending an invitation',
        {
            meta: {
                alias: 'resend-invite',
                behavior: 'Resending invite triggers the invite action again for the same email',
                scenario: 'Admin resends invite to pending user'
            }
        },
        async () => {
             renderMain();
             await waitForDataLoad();

             // "pending@acme.com" is in default mockInvites
             const pendingRow = screen.getByText('pending@acme.com').closest('tr');
             const menuBtn = within(pendingRow!).getByRole('button', { name: /manage member/i });
             await userEvent.click(menuBtn);

             const resendOption = screen.getByText(/resend invite/i);
             await userEvent.click(resendOption);

             expect(mockOrgActions.inviteMember).toHaveBeenCalledWith(1, 'pending@acme.com');
        });

        it('should allow cancelling a pending invitation',
        {
            meta: {
                alias: 'cancel-invite',
                behavior: 'Cancelling invite removes the pending token',
                scenario: 'Admin revokes an accidental invite'
            }
        },
        async () => {
            renderMain();
            await waitForDataLoad();
            
            const pendingRow = screen.getByText('pending@acme.com').closest('tr');
            const menuBtn = within(pendingRow!).getByRole('button', { name: /manage member/i });
            await userEvent.click(menuBtn);

            const cancelOption = screen.getByText(/cancel invite/i);
            await userEvent.click(cancelOption);

            expect(mockOrgActions.cancelInvite).toHaveBeenCalledWith(1, 'inv_1');
        });
    });

    describe('Team Management', () => {
        beforeEach(async () => {
            renderMain();
            await waitForDataLoad();
            const teamToggle = screen.getByRole('button', { name: /view teams/i });
            await userEvent.click(teamToggle);
        });

        it('should create a new team successfully',
        {
            meta: {
                alias: 'create-team',
                behavior: 'Creating a team calls API and updates local state',
                scenario: 'User adds a specific "Frontend" team'
            }
        },
        async () => {
            const createTeamBtn = screen.getByRole('button', { name: /create new team/i });
            await userEvent.click(createTeamBtn);

            const nameInput = screen.getByPlaceholderText(/team name/i);
            await userEvent.type(nameInput, 'Frontend');

            const submitBtn = screen.getByRole('button', { name: 'Create' });
            await userEvent.click(submitBtn);

            expect(mockTeamActions.createTeam).toHaveBeenCalledWith(1, 'Frontend', '');
        });

        it('should update team details',
        {
            meta: {
                alias: 'update-team',
                behavior: 'Updating team name/description persists changes',
                scenario: 'Manager renames "Engineering" to "Core Engineering"'
            }
        },
        async () => {
            const teamPanel = screen.getByTestId('team-list-panel');
            const teamRow = within(teamPanel).getByText('Engineering').closest('tr');
            const menuBtn = within(teamRow!).getByRole('button', { name: /more team/i });
            await userEvent.click(menuBtn);

            const updateOption = screen.getByText(/update team/i);
            await userEvent.click(updateOption);

            const nameInput = screen.getByDisplayValue('Engineering');
            await userEvent.clear(nameInput);
            await userEvent.type(nameInput, 'Core Engineering');

            const saveBtn = screen.getByRole('button', { name: 'Update' });
            await userEvent.click(saveBtn);

            expect(mockTeamActions.updateTeam).toHaveBeenCalledWith(1, 101, 'Core Engineering', 'Core dev team');
        });

        it('should add a member to a team',
        {
            meta: {
                alias: 'add-team-member',
                behavior: 'Adding member links user to team entity',
                scenario: 'Manager adds an employee to Engineering team'
            }
        },
        async () => {
            const teamPanel = screen.getByTestId('team-list-panel');
            const teamRow = within(teamPanel).getByText('Engineering').closest('tr');
            const menuBtn = within(teamRow!).getByRole('button', { name: /more team/i });
            await userEvent.click(menuBtn);

            await userEvent.click(screen.getByText(/add member/i));

            // Interact with the Select component
            const selectTrigger = screen.getByRole('combobox');
            await userEvent.click(selectTrigger);
            
            // Select user 'Jane Doe' from the list
            const userOption = await screen.findByText('Jane Doe');
            await userEvent.click(userOption);

            await userEvent.click(screen.getByRole('button', { name: 'Add' }));

            expect(mockTeamActions.addTeamMember).toHaveBeenCalledWith(1, 101, 'user_2');
        });

        it('should remove a member from a team',
        {
            meta: {
                alias: 'remove-team-member',
                behavior: 'Removing member unlinks user from team but keeps them in org',
                scenario: 'Manager removes user from Engineering team'
            }
        },
        async () => {
            const teamPanel = screen.getByTestId('team-list-panel');
            const teamRow = within(teamPanel).getByText('Engineering').closest('tr');
            const menuBtn = within(teamRow!).getByRole('button', { name: /more team/i });
            await userEvent.click(menuBtn);

            await userEvent.click(screen.getByText(/remove member/i));

            const selectTrigger = screen.getByRole('combobox');
            await userEvent.click(selectTrigger);
            
            // Select the user to remove. Engineering has mockUser (id: user_1) and user_2
            // We search for "Test User" which matches mockUser
            const userOption = await screen.findByText(/Test User/i);
            await userEvent.click(userOption);

            await userEvent.click(screen.getByRole('button', { name: 'Remove' }));

            expect(mockTeamActions.removeTeamMember).toHaveBeenCalledWith(1, 101, 'user_1');
        });
    });

    describe('Role & Permission Management', () => {
        beforeEach(async () => {
            renderMain();
            await waitForDataLoad();
            const roleToggle = screen.getByRole('button', { name: /manage roles/i });
            await userEvent.click(roleToggle);
        });

        it('should create a custom role with specific permissions',
        {
            meta: {
                alias: 'create-role',
                behavior: 'Custom role creation includes selected permissions',
                scenario: 'Creating a "Viewer" role with read-only permissions'
            }
        },
        async () => {
            const createRoleBtn = screen.getByRole('button', { name: /create new role/i });
            await userEvent.click(createRoleBtn);

            const nameInput = screen.getByPlaceholderText(/role name/i);
            await userEvent.type(nameInput, 'Viewer');

            // Select "View Org" permission (ID 1 in mocks)
            const viewPermCheckbox = screen.getByLabelText(/view org/i);
            await userEvent.click(viewPermCheckbox);

            const submitBtn = screen.getByRole('button', { name: 'Create' });
            await userEvent.click(submitBtn);

            expect(mockRoleActions.createRole).toHaveBeenCalledWith(1, 'Viewer', '', expect.arrayContaining([1]));
        });

        it('should add a permission to an existing custom role',
        {
            meta: {
                alias: 'add-permission',
                behavior: 'Adding permission updates the role capability set',
                scenario: 'Adding "Edit Org" permission to "Custom Manager" role'
            }
        },
        async () => {
            const rolePanel = screen.getByTestId('role-list-panel');
            const roleRow = within(rolePanel).getByText('Custom Manager').closest('tr');
            const menuBtn = within(roleRow!).getByRole('button', { name: /more role/i });
            await userEvent.click(menuBtn);

            await userEvent.click(screen.getByText(/manage permissions/i));

            // Open permission selector
            const selectTrigger = screen.getByRole('combobox');
            await userEvent.click(selectTrigger);
            
            // Select a permission not currently in Custom Manager (e.g., Delete Org)
            const permOption = await screen.findByText(/delete org/i);
            await userEvent.click(permOption);

            const addBtn = screen.getByRole('button', { name: 'Add' });
            await userEvent.click(addBtn);

            // Custom Manager is ID 3, adding permission ID 3 (Delete Org)
            expect(mockRoleActions.addPermissionsToRole).toHaveBeenCalledWith(1, 3, [3]);
        });

        it('should delete a custom role',
        {
            meta: {
                alias: 'delete-role',
                behavior: 'Deleting a custom role removes it from the organization',
                scenario: 'Cleanup of unused "Custom Manager" role'
            }
        },
        async () => {
            const rolePanel = screen.getByTestId('role-list-panel');
            const roleRow = within(rolePanel).getByText('Custom Manager').closest('tr');
            const menuBtn = within(roleRow!).getByRole('button', { name: /more role/i });
            await userEvent.click(menuBtn);

            await userEvent.click(screen.getByText(/delete role/i));

            expect(mockRoleActions.deleteRole).toHaveBeenCalledWith(1, 3);
        });

        it('should prevent modification of system roles',
        {
            meta: {
                alias: 'system-role-protection',
                behavior: 'System roles should not expose edit/delete options',
                scenario: 'User tries to modify the "Owner" system role'
            }
        },
        async () => {
            const rolePanel = screen.getByTestId('role-list-panel');
            const roleRow = within(rolePanel).getByText('Owner').closest('tr');
            const menuBtn = within(roleRow!).getByRole('button', { name: /more role/i });
            await userEvent.click(menuBtn);

            // Expect strict absence of modification actions
            expect(screen.queryByText(/delete role/i)).not.toBeInTheDocument();
            expect(screen.queryByText(/edit role/i)).not.toBeInTheDocument();
            expect(screen.getByText(/view permissions/i)).toBeInTheDocument();
        });
    });
});