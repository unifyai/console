import { ResponseProps } from './common';

export const ADMIN_TABLE_PAGE_SIZE = 30;

export interface UserApprovalEntry {
  id: string;
  email: string;
  name?: string | null;
  assistantHiringApproval?: string | null;
  createdAt: string; // ISO date string
  hasClaimedApprovalLink?: boolean;
}

export interface OneTimeLinkResponse {
  // Used for generation response
  id: string;
  token: string;
  expiresAt: string; // ISO date string
  claimedAt?: string | null; // ISO date string
  userId?: string | null;
}

export interface OneTimeLinkEntry {
  // Used for listing links
  id: string;
  token: string;
  expiresAt: string; // ISO date string
  claimedAt?: string | null;
  userId?: string | null;
  claimedByEmail?: string | null; // Added for displaying email
}

export const ASSISTANT_HIRING_APPROVAL_ACTIONS = {
  APPROVE: 'approved',
  REJECT: 'rejected',
  PENDING: 'pending',
  REVOKE: 'revoked',
} as const;

export type AssistantHiringApprovalAction =
  (typeof ASSISTANT_HIRING_APPROVAL_ACTIONS)[keyof typeof ASSISTANT_HIRING_APPROVAL_ACTIONS];

export const ASSISTANT_HIRING_APPROVAL_DISPLAY: Record<
  AssistantHiringApprovalAction | 'none' | 'all',
  string
> = {
  [ASSISTANT_HIRING_APPROVAL_ACTIONS.APPROVE]: 'Approved',
  [ASSISTANT_HIRING_APPROVAL_ACTIONS.REJECT]: 'Rejected',
  [ASSISTANT_HIRING_APPROVAL_ACTIONS.PENDING]: 'Pending',
  [ASSISTANT_HIRING_APPROVAL_ACTIONS.REVOKE]: 'Revoked',
  none: 'None (Not Set)',
  all: 'All Statuses',
};

export interface AdminApprovalActions {
  listUsers: (
    statusFilter: string | null,
    limit: number,
    offset: number
  ) => Promise<UserApprovalEntry[] | ResponseProps>;
  updateUserStatus: (userId: string, status: string) => Promise<ResponseProps>;

  generateOneTimeLink: (expiresInDays?: number) => Promise<OneTimeLinkResponse | ResponseProps>;
  listOneTimeLinks: (limit: number, offset: number) => Promise<OneTimeLinkEntry[] | ResponseProps>;
  deleteOneTimeLink: (linkId: string) => Promise<ResponseProps>;
}
