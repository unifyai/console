import { ResponseProps } from "./common";

export interface UserApprovalEntry {
  id: string;
  email: string;
  name?: string | null;
  assistant_hiring_approval?: string | null;
  created_at: string; // ISO date string
  has_claimed_approval_link?: boolean;
}

export interface OneTimeLinkResponse { // Used for generation response
  id: string;
  token: string;
  expires_at: string; // ISO date string
  claimed_at?: string | null; // ISO date string
  user_id?: string | null;
}

export interface OneTimeLinkEntry { // Used for listing links
  id: string;
  token: string;
  expires_at: string; // ISO date string
  claimed_at?: string | null;
  user_id?: string | null;
  // Potentially add user_email if backend can provide it for claimed links
  claimed_by_email?: string | null; 
}


export const ASSISTANT_HIRING_APPROVAL_ACTIONS = {
    APPROVE: "approved",
    REJECT: "rejected",
    PENDING: "pending",
    REVOKE: "revoked",
} as const;

export type AssistantHiringApprovalAction = typeof ASSISTANT_HIRING_APPROVAL_ACTIONS[keyof typeof ASSISTANT_HIRING_APPROVAL_ACTIONS];

export const ASSISTANT_HIRING_APPROVAL_DISPLAY: Record<AssistantHiringApprovalAction | 'none' | 'all', string> = {
    [ASSISTANT_HIRING_APPROVAL_ACTIONS.APPROVE]: "Approved",
    [ASSISTANT_HIRING_APPROVAL_ACTIONS.REJECT]: "Rejected",
    [ASSISTANT_HIRING_APPROVAL_ACTIONS.PENDING]: "Pending",
    [ASSISTANT_HIRING_APPROVAL_ACTIONS.REVOKE]: "Revoked",
    "none": "None",
    "all": "All Statuses"
};

export interface AdminApprovalActions {
  listUsers: (statusFilter?: string | null) => Promise<UserApprovalEntry[] | ResponseProps>;
  updateUserStatus: (userId: string, status: string) => Promise<ResponseProps>;
  
  generateOneTimeLink: (expiresInDays?: number) => Promise<OneTimeLinkResponse | ResponseProps>;
  listOneTimeLinks: (limit?: number, offset?: number) => Promise<OneTimeLinkEntry[] | ResponseProps>;
  deleteOneTimeLink: (linkId: string) => Promise<ResponseProps>;
}