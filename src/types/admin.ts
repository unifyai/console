import { ResponseProps } from './common';

export const ADMIN_TABLE_PAGE_SIZE = 30;

export interface OneTimeLinkResponse {
  // Used for generation response
  id: string;
  token: string;
  expiresAt: string; // ISO date string
  claimedAt?: string | null; // ISO date string
  userId?: string | null;
  organizationId?: number | null;
  creditAmount?: number | null;
}

export interface OneTimeLinkEntry {
  // Used for listing links
  id: string;
  token: string;
  expiresAt: string; // ISO date string
  claimedAt?: string | null;
  userId?: string | null;
  organizationId?: number | null;
  claimedByEmail?: string | null; // Added for displaying email
  claimedForOrg?: string | null; // Org name if claimed for an org
  creditAmount?: number | null;
}

export interface AdminCreditGrantActions {
  generateOneTimeLink: (
    expiresInDays?: number,
    creditAmount?: number | null
  ) => Promise<OneTimeLinkResponse | ResponseProps>;
  listOneTimeLinks: (limit: number, offset: number) => Promise<OneTimeLinkEntry[] | ResponseProps>;
  deleteOneTimeLink: (linkId: string) => Promise<ResponseProps>;
}
