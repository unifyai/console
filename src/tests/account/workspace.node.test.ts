import { describe, expect, it } from 'vitest';
import { resolveWorkspaceContext } from '@/lib/user/workspace';

describe('resolveWorkspaceContext', () => {
  it('does not resolve a personal workspace when it is disabled', () => {
    const user = {
      name: 'Tony',
      apiKey: 'personal-key',
      personalWorkspaceDisabled: true,
      email: 'tony@clientbeta.example.com',
      organizations: [
        {
          id: 7,
          name: 'Client Beta',
          ownerId: 'owner',
          roleId: 2,
          roleName: 'Member',
          apiKey: 'org-key',
        },
      ],
    };

    const resolved = resolveWorkspaceContext(user);

    expect(resolved.activeOrganization).toBeNull();
    expect(resolved.activeWorkspace).toBeNull();
    expect(resolved.isWorkspaceSwitchable).toBe(false);
  });

  it('resolves the active organization for disabled customer org members', () => {
    const user = {
      name: 'Tony',
      apiKey: 'org-key',
      personalWorkspaceDisabled: true,
      email: 'tony@clientbeta.example.com',
      organizations: [
        {
          id: 7,
          name: 'Client Beta',
          ownerId: 'owner',
          roleId: 2,
          roleName: 'Member',
          apiKey: 'org-key',
        },
      ],
    };

    const resolved = resolveWorkspaceContext(user);

    expect(resolved.activeOrganization?.name).toBe('Client Beta');
    expect(resolved.activeWorkspace).toEqual({
      id: '7',
      name: 'Client Beta',
      type: 'organization',
    });
  });
});
