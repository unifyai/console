/**
 * Permissions Matrix Tests
 *
 * Combinatorial testing for the useAssistantPermissions hook.
 * Tests all meaningful combinations of:
 * - Workspace type: Personal × Organization
 * - User role: Owner × Admin × Member
 * - Assistant ownership: Own × Other's
 * - Actions: Hire × Write × Delete
 *
 * Uses defineNodeMatrixTests for sharding support in CI.
 * Run with: MATRIX_SHARD=1/4 npm run test:node -- 'src/tests/assistants/integration/permissions.matrix.node.test.tsx'
 *
 * @group matrix
 * @group unit
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { defineNodeMatrixTests } from '@/tests/utils/matrixTestRunnerNode';
import { useAssistantPermissions } from '@/hooks/Assistants/useAssistantPermissions';
import { Assistant } from '@/types/assistants/assistant';

// =============================================================================
// MOCK SETUP
// =============================================================================

const mockUseWorkspace = vi.fn();
vi.mock('@/components/Pages/Providers/WorkspaceProvider', () => ({
  useWorkspace: () => mockUseWorkspace(),
}));

// =============================================================================
// CONSTANTS
// =============================================================================

const CURRENT_USER_ID = 'test-user-id';

// =============================================================================
// TEST DATA FACTORIES
// =============================================================================

const createMockAssistant = (userId: string): Assistant => ({
  agentId: 'assistant-1',
  firstName: 'Test',
  surname: 'Assistant',
  userId,
  organizationId: null,
  age: 30,
  nationality: 'US',
  timezone: 'UTC',
  profilePhoto: null,
  profileVideo: null,
  about: null,
  voiceId: 'v1',
  voiceProvider: 'elevenlabs',
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
  isUserDesktop: false,
  desktopMode: null,
  createdAt: '2024-01-01',
  updatedAt: '2024-01-01',
});

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================

type WorkspaceType = 'personal' | 'organization';
type OrgRole = 'Owner' | 'Admin' | 'Member';
type Ownership = 'own' | 'other';

interface PermissionScenario {
  id: string;
  description: string;
  workspace: WorkspaceType;
  role: OrgRole | null;
  ownership: Ownership;
  expected: {
    canHire: boolean;
    canWrite: boolean;
    canDelete: boolean;
  };
}

// Matrix test context passed to defineTests
interface PermissionTestContext {
  scenario: PermissionScenario;
  assistant: Assistant;
}

// =============================================================================
// PERMISSION MATRIX DEFINITION
// =============================================================================

/**
 * The complete permission matrix.
 *
 * Current Rules:
 * - Personal workspace: Full access for everything
 * - Org context + Owner: Can hire, can write/delete any assistant (own or other)
 * - Org context + Admin: Can hire, can write/delete any assistant (own or other)
 * - Org context + Member: Cannot hire, can only write/delete own assistants
 */
const PERMISSION_MATRIX: PermissionScenario[] = [
  // PERSONAL WORKSPACE (Always full access)
  {
    id: 'personal-own',
    description: 'Personal workspace, own assistant',
    workspace: 'personal',
    role: null,
    ownership: 'own',
    expected: { canHire: true, canWrite: true, canDelete: true },
  },
  {
    id: 'personal-other',
    description: 'Personal workspace, other user assistant',
    workspace: 'personal',
    role: null,
    ownership: 'other',
    expected: { canHire: true, canWrite: true, canDelete: true },
  },

  // ORGANIZATION - OWNER
  {
    id: 'org-owner-own',
    description: 'Org Owner, own assistant',
    workspace: 'organization',
    role: 'Owner',
    ownership: 'own',
    expected: { canHire: true, canWrite: true, canDelete: true },
  },
  {
    id: 'org-owner-other',
    description: 'Org Owner, other user assistant (full access)',
    workspace: 'organization',
    role: 'Owner',
    ownership: 'other',
    expected: { canHire: true, canWrite: true, canDelete: true },
  },

  // ORGANIZATION - ADMIN
  {
    id: 'org-admin-own',
    description: 'Org Admin, own assistant',
    workspace: 'organization',
    role: 'Admin',
    ownership: 'own',
    expected: { canHire: true, canWrite: true, canDelete: true },
  },
  {
    id: 'org-admin-other',
    description: 'Org Admin, other user assistant (full access)',
    workspace: 'organization',
    role: 'Admin',
    ownership: 'other',
    expected: { canHire: true, canWrite: true, canDelete: true },
  },

  // ORGANIZATION - MEMBER
  {
    id: 'org-member-own',
    description: 'Org Member, own assistant',
    workspace: 'organization',
    role: 'Member',
    ownership: 'own',
    expected: { canHire: false, canWrite: true, canDelete: true },
  },
  {
    id: 'org-member-other',
    description: 'Org Member, other user assistant',
    workspace: 'organization',
    role: 'Member',
    ownership: 'other',
    expected: { canHire: false, canWrite: false, canDelete: false },
  },
];

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function setupWorkspaceContext(
  workspace: WorkspaceType,
  role: OrgRole | null,
  currentUserId: string
) {
  if (workspace === 'personal') {
    mockUseWorkspace.mockReturnValue({
      activeWorkspace: { type: 'personal' },
      activeOrganization: null,
      currentUserId,
    });
  } else {
    mockUseWorkspace.mockReturnValue({
      activeWorkspace: { type: 'organization' },
      activeOrganization: { roleName: role },
      currentUserId,
    });
  }
}

function getAssistantForOwnership(ownership: Ownership, currentUserId: string): Assistant {
  const assistantUserId = ownership === 'own' ? currentUserId : 'other-user-id';
  return createMockAssistant(assistantUserId);
}

// =============================================================================
// MAIN MATRIX TESTS (using defineNodeMatrixTests)
// =============================================================================

defineNodeMatrixTests<PermissionTestContext>({
  name: 'Permissions Matrix - Core',
  concurrent: true,

  getMatrix: () =>
    PERMISSION_MATRIX.map((scenario) => ({
      scenario,
      assistant: getAssistantForOwnership(scenario.ownership, CURRENT_USER_ID),
    })),

  getConfigAlias: (ctx) => `[${ctx.scenario.id}] ${ctx.scenario.description}`,

  afterEach: () => {
    vi.clearAllMocks();
  },

  defineTests: (ctx, { it, expect }) => {
    const { scenario, assistant } = ctx;

    it(`canHire should be ${scenario.expected.canHire}`, () => {
      setupWorkspaceContext(scenario.workspace, scenario.role, CURRENT_USER_ID);
      const { result } = renderHook(() => useAssistantPermissions());
      expect(result.current.canHire).toBe(scenario.expected.canHire);
    });

    it(`canWrite should be ${scenario.expected.canWrite}`, () => {
      setupWorkspaceContext(scenario.workspace, scenario.role, CURRENT_USER_ID);
      const { result } = renderHook(() => useAssistantPermissions());
      expect(result.current.canWrite(assistant)).toBe(scenario.expected.canWrite);
    });

    it(`canDelete should be ${scenario.expected.canDelete}`, () => {
      setupWorkspaceContext(scenario.workspace, scenario.role, CURRENT_USER_ID);
      const { result } = renderHook(() => useAssistantPermissions());
      expect(result.current.canDelete(assistant)).toBe(scenario.expected.canDelete);
    });
  },
});

// =============================================================================
// EDGE CASE TESTS (separate describe block)
// =============================================================================

describe('Permissions Matrix - Edge Cases', () => {
  const EDGE_CASES = [
    {
      id: 'null-workspace',
      description: 'null activeWorkspace',
      setup: () => {
        mockUseWorkspace.mockReturnValue({
          activeWorkspace: null,
          activeOrganization: null,
          currentUserId: CURRENT_USER_ID,
        });
      },
      expected: { canHire: true, isOrgContext: false },
    },
    {
      id: 'undefined-user',
      description: 'undefined currentUserId in org context',
      setup: () => {
        mockUseWorkspace.mockReturnValue({
          activeWorkspace: { type: 'organization' },
          activeOrganization: { roleName: 'Member' },
          currentUserId: undefined,
        });
      },
      expected: { canHire: false, canWriteAny: false, canDeleteAny: false },
    },
    {
      id: 'null-org-in-org-workspace',
      description: 'org workspace but null activeOrganization',
      setup: () => {
        mockUseWorkspace.mockReturnValue({
          activeWorkspace: { type: 'organization' },
          activeOrganization: null,
          currentUserId: CURRENT_USER_ID,
        });
      },
      expected: { canHire: false, isOrgOwner: false },
    },
    {
      id: 'empty-role-name',
      description: 'org with empty roleName',
      setup: () => {
        mockUseWorkspace.mockReturnValue({
          activeWorkspace: { type: 'organization' },
          activeOrganization: { roleName: '' },
          currentUserId: CURRENT_USER_ID,
        });
      },
      expected: { canHire: false, isOrgOwner: false },
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  EDGE_CASES.forEach((edgeCase) => {
    describe(`[${edgeCase.id}] ${edgeCase.description}`, () => {
      beforeEach(() => {
        edgeCase.setup();
      });

      if ('canHire' in edgeCase.expected) {
        it(`canHire should be ${edgeCase.expected.canHire}`, () => {
          const { result } = renderHook(() => useAssistantPermissions());
          expect(result.current.canHire).toBe(edgeCase.expected.canHire);
        });
      }

      if ('isOrgContext' in edgeCase.expected) {
        it(`isOrgContext should be ${edgeCase.expected.isOrgContext}`, () => {
          const { result } = renderHook(() => useAssistantPermissions());
          expect(result.current.isOrgContext).toBe(edgeCase.expected.isOrgContext);
        });
      }

      if ('isOrgOwner' in edgeCase.expected) {
        it(`isOrgOwner should be ${edgeCase.expected.isOrgOwner}`, () => {
          const { result } = renderHook(() => useAssistantPermissions());
          expect(result.current.isOrgOwner).toBe(edgeCase.expected.isOrgOwner);
        });
      }

      if ('canWriteAny' in edgeCase.expected) {
        it(`canWrite for any assistant should be ${edgeCase.expected.canWriteAny}`, () => {
          const assistant = createMockAssistant('any-user');
          const { result } = renderHook(() => useAssistantPermissions());
          expect(result.current.canWrite(assistant)).toBe(edgeCase.expected.canWriteAny);
        });
      }

      if ('canDeleteAny' in edgeCase.expected) {
        it(`canDelete for any assistant should be ${edgeCase.expected.canDeleteAny}`, () => {
          const assistant = createMockAssistant('any-user');
          const { result } = renderHook(() => useAssistantPermissions());
          expect(result.current.canDelete(assistant)).toBe(edgeCase.expected.canDeleteAny);
        });
      }
    });
  });
});

// =============================================================================
// INVARIANT TESTS (separate describe block)
// =============================================================================

describe('Permissions Matrix - Invariants', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('canWrite and canDelete should always be consistent', () => {
    // v0 Rule: canWrite and canDelete have identical logic
    PERMISSION_MATRIX.forEach((scenario) => {
      setupWorkspaceContext(scenario.workspace, scenario.role, CURRENT_USER_ID);
      const assistant = getAssistantForOwnership(scenario.ownership, CURRENT_USER_ID);
      const { result } = renderHook(() => useAssistantPermissions());

      expect(result.current.canWrite(assistant)).toBe(result.current.canDelete(assistant));
    });
  });

  it('personal workspace always grants full access', () => {
    setupWorkspaceContext('personal', null, CURRENT_USER_ID);
    const ownAssistant = createMockAssistant(CURRENT_USER_ID);
    const otherAssistant = createMockAssistant('other-user');

    const { result } = renderHook(() => useAssistantPermissions());

    // Own assistant
    expect(result.current.canHire).toBe(true);
    expect(result.current.canWrite(ownAssistant)).toBe(true);
    expect(result.current.canDelete(ownAssistant)).toBe(true);

    // Other's assistant - still full access in personal workspace
    expect(result.current.canWrite(otherAssistant)).toBe(true);
    expect(result.current.canDelete(otherAssistant)).toBe(true);
  });

  it('org member can always access own assistant', () => {
    const roles: OrgRole[] = ['Owner', 'Admin', 'Member'];

    roles.forEach((role) => {
      setupWorkspaceContext('organization', role, CURRENT_USER_ID);
      const ownAssistant = createMockAssistant(CURRENT_USER_ID);

      const { result } = renderHook(() => useAssistantPermissions());

      expect(result.current.canWrite(ownAssistant)).toBe(true);
      expect(result.current.canDelete(ownAssistant)).toBe(true);
    });
  });

  it('only org Owner or Admin can hire in org context', () => {
    const testCases: Array<{ role: OrgRole; canHire: boolean }> = [
      { role: 'Owner', canHire: true },
      { role: 'Admin', canHire: true },
      { role: 'Member', canHire: false },
    ];

    testCases.forEach(({ role, canHire }) => {
      setupWorkspaceContext('organization', role, CURRENT_USER_ID);
      const { result } = renderHook(() => useAssistantPermissions());
      expect(result.current.canHire).toBe(canHire);
    });
  });

  it('should match the complete expected permission matrix', () => {
    const results: Array<{
      id: string;
      canHire: boolean;
      canWrite: boolean;
      canDelete: boolean;
    }> = [];

    PERMISSION_MATRIX.forEach((scenario) => {
      setupWorkspaceContext(scenario.workspace, scenario.role, CURRENT_USER_ID);
      const assistant = getAssistantForOwnership(scenario.ownership, CURRENT_USER_ID);
      const { result } = renderHook(() => useAssistantPermissions());

      const actual = {
        id: scenario.id,
        canHire: result.current.canHire,
        canWrite: result.current.canWrite(assistant),
        canDelete: result.current.canDelete(assistant),
      };

      results.push(actual);

      expect(actual.canHire).toBe(scenario.expected.canHire);
      expect(actual.canWrite).toBe(scenario.expected.canWrite);
      expect(actual.canDelete).toBe(scenario.expected.canDelete);
    });

    // Verify we tested all 8 scenarios
    expect(results.length).toBe(8);
  });
});
