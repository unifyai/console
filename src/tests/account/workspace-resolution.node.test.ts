import { describe, expect, it } from 'vitest';
import type { User, UserOrganization } from '@/types/user';
import { getActiveOrganization, resolveWorkspaceContext } from '@/lib/user/workspace';

type WorkspaceUser = Pick<User, 'apiKey' | 'organizations' | 'name'>;

function makeOrganization(
  overrides: Partial<UserOrganization> & Pick<UserOrganization, 'id' | 'name'>
) {
  return {
    ownerId: `owner-${overrides.id}`,
    roleId: 1,
    roleName: 'Member',
    apiKey: `org-key-${overrides.id}`,
    image: null,
    timezone: null,
    freeTrial: false,
    ...overrides,
  } satisfies UserOrganization;
}

function makeUser(overrides: Partial<WorkspaceUser> = {}): WorkspaceUser {
  return {
    name: 'Personal Workspace',
    apiKey: 'personal-key',
    organizations: [],
    ...overrides,
  };
}

describe('workspace resolution', () => {
  it('returns the organization whose API key matches the resolved user key', () => {
    const firstOrg = makeOrganization({ id: 1, name: 'First Org' });
    const secondOrg = makeOrganization({ id: 2, name: 'Second Org', apiKey: 'active-org-key' });
    const user = makeUser({
      apiKey: 'active-org-key',
      organizations: [firstOrg, secondOrg],
    });

    const context = resolveWorkspaceContext(user);

    expect(context.activeOrganization).toEqual(secondOrg);
    expect(context.activeWorkspace).toEqual({
      id: '2',
      name: 'Second Org',
      type: 'organization',
    });
  });

  it('falls back to personal workspace when no org key matches', () => {
    const user = makeUser({
      name: 'Ada Lovelace',
      organizations: [makeOrganization({ id: 1, name: 'Example Org' })],
    });

    const context = resolveWorkspaceContext(user);

    expect(context.activeOrganization).toBeNull();
    expect(context.activeWorkspace).toEqual({
      id: 'personal',
      name: 'Ada Lovelace',
      type: 'personal',
    });
  });

  it('marks workspace switching as available only for Unify members', () => {
    const unifyMember = makeUser({
      organizations: [makeOrganization({ id: 1, name: 'Unify' })],
    });
    const nonUnifyMember = makeUser({
      organizations: [makeOrganization({ id: 2, name: 'Customer Org' })],
    });

    expect(resolveWorkspaceContext(unifyMember).isWorkspaceSwitchable).toBe(true);
    expect(resolveWorkspaceContext(nonUnifyMember).isWorkspaceSwitchable).toBe(false);
  });

  it('returns null workspace details for missing user state', () => {
    const context = resolveWorkspaceContext(null);

    expect(context.activeOrganization).toBeNull();
    expect(context.activeWorkspace).toBeNull();
    expect(context.isUnifyMember).toBe(false);
    expect(context.isWorkspaceSwitchable).toBe(false);
  });

  it('exposes the active organization helper for server pages', () => {
    const organization = makeOrganization({ id: 7, name: 'ClientDelta Healthcare' });
    const user = makeUser({
      apiKey: organization.apiKey,
      organizations: [organization],
    });

    expect(getActiveOrganization(user)).toEqual(organization);
    expect(getActiveOrganization(makeUser())).toBeNull();
  });
});
