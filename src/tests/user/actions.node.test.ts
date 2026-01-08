// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as OrganizationActions from '@/lib/user/organization';
import * as TeamActions from '@/lib/user/team';
import * as RoleActions from '@/lib/user/role';
import { Permission } from '@/types/role';
import { OrganizationPermission } from '@/types/organization';

/**
 * Organization, Team, and Role Server Actions.
 *
 * Requirements:
 * 1. process.env.VITE_TEST_API_KEY must be set in .env.test
 * 2. The API Key must belong to a user capable of creating organizations.
 *
 * Flow:
 * 1. Create a temporary "Integration Test" Organization.
 * 2. Perform Role operations (Create, Update, Add/Remove Perms, Delete) within that Org.
 * 3. Perform Team operations (Create, Update, Add/Remove Member, Delete) within that Org.
 * 4. Perform Organization operations (Update, Invite, Cancel Invite).
 * 5. Delete the temporary Organization.
 */

const API_KEY = process.env.VITE_TEST_API_KEY;

// Helper to check for error responses
const isError = (res: any): res is { detail: string } => {
  return res && typeof res === 'object' && 'detail' in res && typeof res.detail === 'string';
};

// Global state to share ID between steps
let testOrgId: number | null = null;
let testRoleId: number | null = null;
let testTeamId: number | null = null;
let availablePermissions: Permission[] = [];
let createdInviteId: string | null = null;

describe(
  'Organization, Role & Team Server Actions (Integration)',
  { meta: { mock: false } },
  () => {
    if (!API_KEY) {
      it.skip('Skipping integration tests: VITE_TEST_API_KEY is missing.', () => {});
      return;
    }

    // --- 1. ORGANIZATION SETUP ---

    describe('Organization Lifecycle: Setup', () => {
      it('createOrganization: should create a new organization', async () => {
        const action = await OrganizationActions.createOrganizationAction(API_KEY);
        const orgName = `Integration Test Org ${Date.now()}`;
        const res = await action(orgName);

        expect(isError(res)).toBe(false);
        if (!isError(res)) {
          expect(res).toHaveProperty('id');
          expect(res.name).toBe(orgName);
          testOrgId = res.id;
          console.log(`Created Test Org ID: ${testOrgId}`);
        }
      }, 30000);
    });

    // --- 2. ROLE OPERATIONS ---

    describe('Role Actions', () => {
      it('getAllPermissions: should fetch available permissions', async () => {
        const action = await RoleActions.getAllPermissionsAction(API_KEY);
        const res = await action();

        expect(isError(res)).toBe(false);
        expect(Array.isArray(res)).toBe(true);
        if (Array.isArray(res) && res.length > 0) {
          availablePermissions = res;
        }

        console.log('========== TEST RESULT ==========');
        console.log(res);
      });

      it('createRole: should create a custom role in the org', async () => {
        if (!testOrgId || availablePermissions.length === 0)
          throw new Error('Org Setup or Permissions fetch failed');

        // Pick first 2 permissions
        const permIds = availablePermissions.slice(0, 2).map((p) => p.id);

        const action = await RoleActions.createRoleAction(API_KEY);
        const res = await action(testOrgId, 'Test Role', 'Integration Test Description', permIds);

        expect(isError(res)).toBe(false);
        if (!isError(res)) {
          expect(res.name).toBe('Test Role');
          expect(res.permissions).toHaveLength(permIds.length);
          testRoleId = res.id;
        }

        console.log('========== TEST RESULT ==========');
        console.log(res);
      });

      it('updateRole: should update name and description', async () => {
        if (!testOrgId || !testRoleId) throw new Error('Role setup failed');

        const action = await RoleActions.updateRoleAction(API_KEY);
        const res = await action(testOrgId, testRoleId, 'Updated Role Name', 'Updated Description');

        expect(isError(res)).toBe(false);
        if (!isError(res)) {
          expect(res.name).toBe('Updated Role Name');
          expect(res.description).toBe('Updated Description');
        }

        console.log('========== TEST RESULT ==========');
        console.log(res);
      });

      it('addPermissionsToRole: should add a new permission', async () => {
        if (!testOrgId || !testRoleId || availablePermissions.length < 3) return; // Skip if not enough perms

        const newPermId = availablePermissions[2].id;
        const action = await RoleActions.addPermissionsToRoleAction(API_KEY);
        const res = await action(testOrgId, testRoleId, [newPermId]);

        expect(isError(res)).toBe(false);
        if (!isError(res)) {
          // We added 1 to the existing 2
          expect(res.permissions.length).toBeGreaterThanOrEqual(3);
        }

        console.log('========== TEST RESULT ==========');
        console.log(res);
      });

      it('removePermissionFromRole: should remove a permission', async () => {
        if (!testOrgId || !testRoleId || availablePermissions.length === 0) return;

        const permIdToRemove = availablePermissions[0].id;
        const action = await RoleActions.removePermissionFromRoleAction(API_KEY);
        const res = await action(testOrgId, testRoleId, permIdToRemove);

        expect(isError(res)).toBe(false);
        if (!isError(res)) {
          const hasPerm = (res.permissions as OrganizationPermission[]).some(
            (p) => p.id === permIdToRemove
          );
          expect(hasPerm).toBe(false);
        }

        console.log('========== TEST RESULT ==========');
        console.log(res);
      });

      it('getRoles: should list roles including the custom one', async () => {
        if (!testOrgId) throw new Error('Org setup failed');

        const action = await RoleActions.getRolesAction(API_KEY);
        const res = await action(testOrgId);

        expect(isError(res)).toBe(false);
        expect(Array.isArray(res)).toBe(true);
        if (Array.isArray(res)) {
          const found = res.find((r) => r.id === testRoleId);
          expect(found).toBeDefined();
        }

        console.log('========== TEST RESULT ==========');
        console.log(res);
      });

      it('deleteRole: should delete the custom role', async () => {
        if (!testOrgId || !testRoleId) throw new Error('Role setup failed');

        const action = await RoleActions.deleteRoleAction(API_KEY);
        const res = await action(testOrgId, testRoleId);

        expect(isError(res)).toBe(false);
        testRoleId = null;

        console.log('========== TEST RESULT ==========');
        console.log(res);
      });
    });

    // --- 3. TEAM OPERATIONS ---

    describe('Team Actions', () => {
      it('createTeam: should create a team', async () => {
        if (!testOrgId) throw new Error('Org Setup failed');

        const action = await TeamActions.createTeamAction(API_KEY);
        const res = await action(testOrgId, 'Dev Team', 'Developers');

        expect(isError(res)).toBe(false);
        if (!isError(res)) {
          expect(res.name).toBe('Dev Team');
          testTeamId = res.id;
        }

        console.log('========== TEST RESULT ==========');
        console.log(res);
      });

      it('updateTeam: should update team details', async () => {
        if (!testOrgId || !testTeamId) throw new Error('Team Setup failed');

        const action = await TeamActions.updateTeamAction(API_KEY);
        const res = await action(testOrgId, testTeamId, 'DevOps Team', 'Updated Desc');

        expect(isError(res)).toBe(false);
        if (!isError(res)) {
          expect(res.name).toBe('DevOps Team');
        }

        console.log('========== TEST RESULT ==========');
        console.log(res);
      });

      it('getTeams: should list the created team', async () => {
        if (!testOrgId || !testTeamId) throw new Error('Team Setup failed');

        const action = await TeamActions.getTeamsAction(API_KEY);
        const res = await action(testOrgId);

        expect(isError(res)).toBe(false);
        expect(Array.isArray(res)).toBe(true);
        if (Array.isArray(res)) {
          const found = res.find((t) => t.id === testTeamId);
          expect(found).toBeDefined();
        }

        console.log('========== TEST RESULT ==========');
        console.log(res);
      });

      it('getTeamDetails: should fetch specific team', async () => {
        if (!testOrgId || !testTeamId) throw new Error('Team Setup failed');

        const action = await TeamActions.getTeamDetailsAction(API_KEY);
        const res = await action(testOrgId, testTeamId);

        expect(isError(res)).toBe(false);
        if (!isError(res)) {
          expect(res.id).toBe(testTeamId);
        }

        console.log('========== TEST RESULT ==========');
        console.log(res);
      });

      it('deleteTeam: should delete the team', async () => {
        if (!testOrgId || !testTeamId) throw new Error('Team Setup failed');

        const action = await TeamActions.deleteTeamAction(API_KEY);
        const res = await action(testOrgId, testTeamId);

        expect(isError(res)).toBe(false);
        testTeamId = null;

        console.log('========== TEST RESULT ==========');
        console.log(res);
      });
    });

    // --- 4. MEMBER & INVITE OPERATIONS ---

    describe('Member & Invite Actions', () => {
      it('inviteMember: should send an invite', async () => {
        if (!testOrgId) throw new Error('Org Setup failed');

        const inviteEmail = `test.invite.${Date.now()}@example.com`;
        const action = await OrganizationActions.inviteMemberAction(API_KEY);
        // Inviting with default role (usually Member)
        const res = await action(testOrgId, inviteEmail);

        expect(isError(res)).toBe(false);

        console.log('========== TEST RESULT ==========');
        console.log(res);
      });

      it('getInvites: should list the pending invite', async () => {
        if (!testOrgId) throw new Error('Org Setup failed');

        const action = await OrganizationActions.getInvitesAction(API_KEY);
        const res = await action(testOrgId);

        expect(isError(res)).toBe(false);
        if (!isError(res) && 'invites' in res) {
          expect(res.invites.length).toBeGreaterThan(0);
          createdInviteId = res.invites[0].id;
        }

        console.log('========== TEST RESULT ==========');
        console.log(res);
      });

      it('cancelInvite: should revoke the invite', async () => {
        if (!testOrgId || !createdInviteId) throw new Error('Invite Setup failed');

        const action = await OrganizationActions.cancelInviteAction(API_KEY);
        const res = await action(testOrgId, createdInviteId);

        expect(isError(res)).toBe(false);

        console.log('========== TEST RESULT ==========');
        console.log(res);
      });

      it('getMembers: should list current members (creator)', async () => {
        if (!testOrgId) throw new Error('Org Setup failed');

        const action = await OrganizationActions.getMembersAction(API_KEY);
        const res = await action(testOrgId);

        expect(isError(res)).toBe(false);
        expect(Array.isArray(res)).toBe(true);
        if (Array.isArray(res)) {
          expect(res.length).toBeGreaterThanOrEqual(1); // At least the creator
        }

        console.log('========== TEST RESULT ==========');
        console.log(res);
      });
    });

    // --- 5. CLEANUP ---

    describe('Organization Lifecycle: Cleanup', () => {
      it('updateOrganization: should update org name', async () => {
        if (!testOrgId) throw new Error('Org Setup failed');

        const action = await OrganizationActions.updateOrganizationAction(API_KEY);
        const res = await action(testOrgId, 'Final Name Before Delete');

        expect(isError(res)).toBe(false);
        if (!isError(res)) {
          expect(res.name).toBe('Final Name Before Delete');
        }

        console.log('========== TEST RESULT ==========');
        console.log(res);
      });

      it('deleteOrganization: should delete the temporary org', async () => {
        if (!testOrgId) throw new Error('Org Setup failed');

        const action = await OrganizationActions.deleteOrganizationAction(API_KEY);
        const res = await action(testOrgId);

        expect(isError(res)).toBe(false);

        console.log('========== TEST RESULT ==========');
        console.log(res);
      });
    });
  }
);
