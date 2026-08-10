import { isUnifyStaffMember } from '@/lib/auth/unify-staff';
import type { User, UserOrganization, UserWorkspace } from '@/types/user';

type WorkspaceResolvedUser =
  | (Pick<User, 'apiKey' | 'email' | 'organizations' | 'name' | 'personalWorkspaceDisabled'> &
      Partial<Pick<User, 'image'>>)
  | null
  | undefined;

export interface ResolvedWorkspaceContext {
  activeOrganization: UserOrganization | null;
  activeWorkspace: UserWorkspace | null;
  isUnifyMember: boolean;
  isWorkspaceSwitchable: boolean;
}

/**
 * Resolve the effective workspace from the already-resolved user object.
 *
 * `getCurrentUser()` may override the raw workspace cookie (for example, when
 * non-Unify members are locked into their organization workspace). Downstream
 * pages should consume that effective state instead of re-reading the cookie
 * and risking a split-brain UI.
 */
export function resolveWorkspaceContext(user: WorkspaceResolvedUser): ResolvedWorkspaceContext {
  if (!user) {
    return {
      activeOrganization: null,
      activeWorkspace: null,
      isUnifyMember: false,
      isWorkspaceSwitchable: false,
    };
  }

  const organizations = user.organizations ?? [];
  const activeOrganization =
    organizations.find((organization) => organization.apiKey === user.apiKey) ?? null;
  const isUnifyMember = isUnifyStaffMember(user.email, organizations);
  const personalWorkspaceDisabled = user.personalWorkspaceDisabled === true;
  const activeWorkspace: UserWorkspace | null = activeOrganization
    ? {
        id: activeOrganization.id.toString(),
        name: activeOrganization.name,
        type: 'organization',
        ...(activeOrganization.image ? { image: activeOrganization.image } : {}),
      }
    : personalWorkspaceDisabled
      ? null
      : {
          id: 'personal',
          name: user.name ?? 'Personal',
          type: 'personal',
          ...(user.image ? { image: user.image } : {}),
        };

  return {
    activeOrganization,
    activeWorkspace,
    isUnifyMember,
    isWorkspaceSwitchable: isUnifyMember,
  };
}

export function getActiveOrganization(user: WorkspaceResolvedUser): UserOrganization | null {
  return resolveWorkspaceContext(user).activeOrganization;
}
