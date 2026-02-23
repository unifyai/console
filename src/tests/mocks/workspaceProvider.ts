import { vi } from 'vitest';

/**
 * WorkspaceProvider Mock Patterns
 *
 * Components using useWorkspace (directly or via hooks like useAssistantPermissions)
 * need WorkspaceProvider context. In tests, mock it with vi.mock.
 *
 * IMPORTANT: vi.mock is hoisted, so you can't import and use these directly.
 * Copy the pattern into your test file.
 *
 * ## Simple Usage (inline in test file):
 *
 * ```ts
 * vi.mock('@/components/Pages/Providers/WorkspaceProvider', () => ({
 *   useWorkspace: () => ({
 *     workspaces: [{ id: 'personal', name: 'Test User', type: 'personal' }],
 *     activeWorkspace: { id: 'personal', name: 'Test User', type: 'personal' },
 *     activeOrganization: null,
 *     currentUserId: 'test-user-001',
 *     switchWorkspace: vi.fn(),
 *   }),
 * }));
 * ```
 *
 * ## Dynamic State (using vi.hoisted):
 *
 * ```ts
 * const { mockSwitchWorkspace, activeWorkspaceRef } = vi.hoisted(() => ({
 *   mockSwitchWorkspace: vi.fn(),
 *   activeWorkspaceRef: { current: { type: 'personal', id: 'personal' } },
 * }));
 *
 * vi.mock('@/components/Pages/Providers/WorkspaceProvider', () => ({
 *   useWorkspace: () => ({
 *     get activeWorkspace() { return activeWorkspaceRef.current; },
 *     switchWorkspace: mockSwitchWorkspace,
 *   }),
 * }));
 *
 * // Then in tests:
 * activeWorkspaceRef.current = { type: 'organization', id: '1' };
 * ```
 *
 * See organization.browser.test.tsx for a full example of dynamic state.
 */

/**
 * Default mock values for WorkspaceProvider.
 * Copy these into your vi.mock factory.
 */
export const defaultWorkspaceValues = {
  workspaces: [{ id: 'personal', name: 'Test User', type: 'personal' }],
  activeWorkspace: { id: 'personal', name: 'Test User', type: 'personal' },
  activeOrganization: null,
  currentUserId: 'test-user-001',
};

/**
 * For node tests (not browser), you can use this helper with vi.hoisted.
 *
 * Usage in node tests:
 *   const mockWorkspace = vi.hoisted(() => createWorkspaceMock());
 *   vi.mock('@/components/Pages/Providers/WorkspaceProvider', () => mockWorkspace.provider);
 */
export function createWorkspaceMock(overrides: Partial<typeof defaultWorkspaceValues> = {}) {
  const switchWorkspace = vi.fn();
  const values = { ...defaultWorkspaceValues, ...overrides };

  return {
    switchWorkspace,
    provider: {
      useWorkspace: () => ({
        ...values,
        switchWorkspace,
      }),
    },
  };
}
