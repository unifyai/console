/**
 * Unit tests for src/hooks/Assistants/useAssistantPermissions.ts
 *
 * Tests the permission hook logic for different workspace contexts.
 * Uses React Testing Library's renderHook with mocked WorkspaceProvider.
 *
 * @group unit
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import React from 'react';
import { useAssistantPermissions } from '@/hooks/Assistants/useAssistantPermissions';
import { Assistant } from '@/types/assistants/assistant';

// Mock the WorkspaceProvider
const mockUseWorkspace = vi.fn();
vi.mock('@/components/Pages/Providers/WorkspaceProvider', () => ({
  useWorkspace: () => mockUseWorkspace(),
}));

// Factory for mock assistant
const createMockAssistant = (overrides: Partial<Assistant> = {}): Assistant => ({
  agentId: 'assistant-1',
  firstName: 'Jane',
  surname: 'Doe',
  userId: 'user-123',
  organizationId: null,
  age: 30,
  nationality: 'US',
  timezone: 'UTC',
  profilePhoto: null,
  profileVideo: null,
  about: null,
  voiceId: 'v1',
  voiceProvider: 'elevenlabs',
  voiceMode: 'tts',
  email: null,
  phone: null,
  phoneCountry: null,
  userPhone: null,
  userWhatsappNumber: null,
  assistantWhatsappNumber: null,
  weeklyLimit: 50,
  maxParallel: null,
  signedProfilePhotoUrl: undefined,
  signedProfileVideoUrl: undefined,
  userLocalDesktop: null,
  createdAt: '2024-01-01',
  updatedAt: '2024-01-01',
  ...overrides,
});

describe('useAssistantPermissions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Personal Workspace Context', () => {
    beforeEach(() => {
      mockUseWorkspace.mockReturnValue({
        activeWorkspace: { type: 'personal' },
        activeOrganization: null,
        currentUserId: 'user-123',
      });
    });

    it(
      'returns isOrgContext as false',
      {
        meta: {
          alias: 'Permissions-PersonalContext',
          scenario: 'User is in personal workspace',
          behavior: 'isOrgContext is false',
        },
      },
      () => {
        // Act
        const { result } = renderHook(() => useAssistantPermissions());

        // Assert
        expect(result.current.isOrgContext).toBe(false);
      }
    );

    it(
      'allows hiring in personal workspace',
      {
        meta: {
          alias: 'Permissions-PersonalCanHire',
          scenario: 'User is in personal workspace',
          behavior: 'canHire is true',
        },
      },
      () => {
        // Act
        const { result } = renderHook(() => useAssistantPermissions());

        // Assert
        expect(result.current.canHire).toBe(true);
      }
    );

    it(
      'allows writing any assistant in personal workspace',
      {
        meta: {
          alias: 'Permissions-PersonalCanWrite',
          scenario: 'User is in personal workspace',
          behavior: 'canWrite returns true for any assistant',
        },
      },
      () => {
        // Arrange
        const assistant = createMockAssistant({ userId: 'other-user' });

        // Act
        const { result } = renderHook(() => useAssistantPermissions());

        // Assert
        expect(result.current.canWrite(assistant)).toBe(true);
      }
    );

    it(
      'allows deleting any assistant in personal workspace',
      {
        meta: {
          alias: 'Permissions-PersonalCanDelete',
          scenario: 'User is in personal workspace',
          behavior: 'canDelete returns true for any assistant',
        },
      },
      () => {
        // Arrange
        const assistant = createMockAssistant({ userId: 'other-user' });

        // Act
        const { result } = renderHook(() => useAssistantPermissions());

        // Assert
        expect(result.current.canDelete(assistant)).toBe(true);
      }
    );
  });

  describe('Organization Context - Owner', () => {
    beforeEach(() => {
      mockUseWorkspace.mockReturnValue({
        activeWorkspace: { type: 'organization' },
        activeOrganization: { roleName: 'Owner' },
        currentUserId: 'owner-user',
      });
    });

    it(
      'returns isOrgContext as true',
      {
        meta: {
          alias: 'Permissions-OrgContext',
          scenario: 'User is in organization workspace',
          behavior: 'isOrgContext is true',
        },
      },
      () => {
        // Act
        const { result } = renderHook(() => useAssistantPermissions());

        // Assert
        expect(result.current.isOrgContext).toBe(true);
      }
    );

    it(
      'returns isOrgOwner as true for org owner',
      {
        meta: {
          alias: 'Permissions-IsOwner',
          scenario: 'User is org owner',
          behavior: 'isOrgOwner is true',
        },
      },
      () => {
        // Act
        const { result } = renderHook(() => useAssistantPermissions());

        // Assert
        expect(result.current.isOrgOwner).toBe(true);
      }
    );

    it(
      'allows hiring for org owner',
      {
        meta: {
          alias: 'Permissions-OwnerCanHire',
          scenario: 'User is org owner',
          behavior: 'canHire is true',
        },
      },
      () => {
        // Act
        const { result } = renderHook(() => useAssistantPermissions());

        // Assert
        expect(result.current.canHire).toBe(true);
      }
    );

    it(
      'allows owner to write their own assistant',
      {
        meta: {
          alias: 'Permissions-OwnerCanWriteOwn',
          scenario: 'Owner checking write permission on own assistant',
          behavior: 'canWrite returns true',
        },
      },
      () => {
        // Arrange
        const assistant = createMockAssistant({ userId: 'owner-user' });

        // Act
        const { result } = renderHook(() => useAssistantPermissions());

        // Assert
        expect(result.current.canWrite(assistant)).toBe(true);
      }
    );

    it(
      'denies owner from writing other users assistant (v0 behavior)',
      {
        meta: {
          alias: 'Permissions-OwnerCannotWriteOthers',
          scenario: 'Owner checking write permission on other user assistant',
          behavior: 'canWrite returns false (v0 behavior)',
        },
      },
      () => {
        // Arrange - In v0, even org owner cannot edit other users' assistants
        const assistant = createMockAssistant({ userId: 'other-user' });

        // Act
        const { result } = renderHook(() => useAssistantPermissions());

        // Assert
        expect(result.current.canWrite(assistant)).toBe(false);
      }
    );
  });

  describe('Organization Context - Member', () => {
    beforeEach(() => {
      mockUseWorkspace.mockReturnValue({
        activeWorkspace: { type: 'organization' },
        activeOrganization: { roleName: 'Member' },
        currentUserId: 'member-user',
      });
    });

    it(
      'returns isOrgOwner as false for member',
      {
        meta: {
          alias: 'Permissions-MemberNotOwner',
          scenario: 'User is org member',
          behavior: 'isOrgOwner is false',
        },
      },
      () => {
        // Act
        const { result } = renderHook(() => useAssistantPermissions());

        // Assert
        expect(result.current.isOrgOwner).toBe(false);
      }
    );

    it(
      'denies hiring for org member',
      {
        meta: {
          alias: 'Permissions-MemberCannotHire',
          scenario: 'User is org member (not owner)',
          behavior: 'canHire is false',
        },
      },
      () => {
        // Act
        const { result } = renderHook(() => useAssistantPermissions());

        // Assert
        expect(result.current.canHire).toBe(false);
      }
    );

    it(
      'allows member to write their own assistant',
      {
        meta: {
          alias: 'Permissions-MemberCanWriteOwn',
          scenario: 'Member checking write permission on own assistant',
          behavior: 'canWrite returns true',
        },
      },
      () => {
        // Arrange
        const assistant = createMockAssistant({ userId: 'member-user' });

        // Act
        const { result } = renderHook(() => useAssistantPermissions());

        // Assert
        expect(result.current.canWrite(assistant)).toBe(true);
      }
    );

    it(
      'denies member from writing other users assistant',
      {
        meta: {
          alias: 'Permissions-MemberCannotWriteOthers',
          scenario: 'Member checking write permission on other user assistant',
          behavior: 'canWrite returns false',
        },
      },
      () => {
        // Arrange
        const assistant = createMockAssistant({ userId: 'other-user' });

        // Act
        const { result } = renderHook(() => useAssistantPermissions());

        // Assert
        expect(result.current.canWrite(assistant)).toBe(false);
      }
    );

    it(
      'allows member to delete their own assistant',
      {
        meta: {
          alias: 'Permissions-MemberCanDeleteOwn',
          scenario: 'Member checking delete permission on own assistant',
          behavior: 'canDelete returns true',
        },
      },
      () => {
        // Arrange
        const assistant = createMockAssistant({ userId: 'member-user' });

        // Act
        const { result } = renderHook(() => useAssistantPermissions());

        // Assert
        expect(result.current.canDelete(assistant)).toBe(true);
      }
    );

    it(
      'denies member from deleting other users assistant',
      {
        meta: {
          alias: 'Permissions-MemberCannotDeleteOthers',
          scenario: 'Member checking delete permission on other user assistant',
          behavior: 'canDelete returns false',
        },
      },
      () => {
        // Arrange
        const assistant = createMockAssistant({ userId: 'other-user' });

        // Act
        const { result } = renderHook(() => useAssistantPermissions());

        // Assert
        expect(result.current.canDelete(assistant)).toBe(false);
      }
    );
  });

  describe('Organization Context - Admin', () => {
    beforeEach(() => {
      mockUseWorkspace.mockReturnValue({
        activeWorkspace: { type: 'organization' },
        activeOrganization: { roleName: 'Admin' },
        currentUserId: 'admin-user',
      });
    });

    it(
      'returns isOrgOwner as false for admin',
      {
        meta: {
          alias: 'Permissions-AdminNotOwner',
          scenario: 'User is org admin',
          behavior: 'isOrgOwner is false (admin != owner)',
        },
      },
      () => {
        // Act
        const { result } = renderHook(() => useAssistantPermissions());

        // Assert
        expect(result.current.isOrgOwner).toBe(false);
      }
    );

    it(
      'denies hiring for org admin (v0 behavior)',
      {
        meta: {
          alias: 'Permissions-AdminCannotHire',
          scenario: 'User is org admin (not owner)',
          behavior: 'canHire is false in v0',
        },
      },
      () => {
        // Act
        const { result } = renderHook(() => useAssistantPermissions());

        // Assert - In v0, only Owner can hire
        expect(result.current.canHire).toBe(false);
      }
    );
  });

  describe('Edge Cases', () => {
    it(
      'handles null activeWorkspace',
      {
        meta: {
          alias: 'Permissions-NullWorkspace',
          scenario: 'activeWorkspace is null',
          behavior: 'Treats as non-org context',
        },
      },
      () => {
        // Arrange
        mockUseWorkspace.mockReturnValue({
          activeWorkspace: null,
          activeOrganization: null,
          currentUserId: 'user-123',
        });

        // Act
        const { result } = renderHook(() => useAssistantPermissions());

        // Assert
        expect(result.current.isOrgContext).toBe(false);
        expect(result.current.canHire).toBe(true);
      }
    );

    it(
      'handles undefined currentUserId',
      {
        meta: {
          alias: 'Permissions-UndefinedUser',
          scenario: 'currentUserId is undefined',
          behavior: 'canWrite/canDelete check still works',
        },
      },
      () => {
        // Arrange
        mockUseWorkspace.mockReturnValue({
          activeWorkspace: { type: 'organization' },
          activeOrganization: { roleName: 'Member' },
          currentUserId: undefined,
        });
        const assistant = createMockAssistant({ userId: 'some-user' });

        // Act
        const { result } = renderHook(() => useAssistantPermissions());

        // Assert - undefined !== 'some-user', so should be false
        expect(result.current.canWrite(assistant)).toBe(false);
        expect(result.current.canDelete(assistant)).toBe(false);
      }
    );
  });
});
