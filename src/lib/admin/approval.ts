import { ResponseProps } from '@/types/common';
import {
  UserApprovalEntry,
  OneTimeLinkResponse,
  OneTimeLinkEntry,
  ADMIN_TABLE_PAGE_SIZE,
} from '@/types/admin';

export const listUsersForApproval = async () => {
  return async (
    statusFilter: string | null,
    limit: number = ADMIN_TABLE_PAGE_SIZE,
    offset: number = 0
  ): Promise<UserApprovalEntry[] | ResponseProps> => {
    'use server';

    try {
      let url = `/api/admin/user-approvals`;
      const queryParams = new URLSearchParams();
      if (statusFilter && statusFilter !== 'all') {
        queryParams.append('status_filter', statusFilter);
      }
      queryParams.append('limit', String(limit));
      queryParams.append('offset', String(offset));

      const queryString = queryParams.toString();
      if (queryString) {
        url += `?${queryString}`;
      }

      const response = await fetch(`${process.env.NEXTAUTH_URL}${url}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        cache: 'no-store',
      });

      const data = await response.json();
      if (!response.ok) {
        return { detail: data.detail || `Failed to list users: ${response.statusText}` };
      }
      return data as UserApprovalEntry[];
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unknown error listing users for approval.';
      return { detail: message };
    }
  };
};

export const updateUserApprovalStatus = async () => {
  return async (userId: string, status: string): Promise<ResponseProps> => {
    'use server';

    try {
      const response = await fetch(
        `${process.env.NEXTAUTH_URL}/api/admin/user-approvals/${userId}/${status}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
        }
      );

      if (!response.ok) {
        const data = await response
          .json()
          .catch(() => ({ detail: `Failed to update status: ${response.statusText}` }));
        return { detail: data.detail || `Failed to update status: ${response.statusText}` };
      }
      if (response.status === 204) {
        return { info: 'Status updated successfully.' };
      }
      const data = await response.json();
      return { info: data.message || 'Status updated successfully.' };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error updating status.';
      return { detail: message };
    }
  };
};

export const generateOneTimeApprovalLink = async () => {
  return async (expiresInDays: number = 1): Promise<OneTimeLinkResponse | ResponseProps> => {
    'use server';

    try {
      const response = await fetch(`${process.env.NEXTAUTH_URL}/api/admin/one-time-approval-link`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ expiresInDays: expiresInDays }),
      });
      const data = await response.json();
      if (!response.ok) {
        return { detail: data.detail || `Failed to generate link: ${response.statusText}` };
      }
      return data as OneTimeLinkResponse;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error generating link.';
      return { detail: message };
    }
  };
};

export const listOneTimeApprovalLinks = async () => {
  return async (
    limit: number = ADMIN_TABLE_PAGE_SIZE,
    offset: number = 0
  ): Promise<OneTimeLinkEntry[] | ResponseProps> => {
    'use server';
    try {
      const queryParams = new URLSearchParams({
        limit: String(limit),
        offset: String(offset),
      });
      const response = await fetch(
        `${process.env.NEXTAUTH_URL}/api/admin/one-time-approval-link?${queryParams.toString()}`,
        {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
          cache: 'no-store',
        }
      );
      const data = await response.json();
      if (!response.ok) {
        return { detail: data.detail || `Failed to list links: ${response.statusText}` };
      }
      return data as OneTimeLinkEntry[];
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unknown error listing one-time links.';
      return { detail: message };
    }
  };
};

export const deleteOneTimeApprovalLink = async () => {
  return async (linkId: string): Promise<ResponseProps> => {
    'use server';
    try {
      const response = await fetch(
        `${process.env.NEXTAUTH_URL}/api/admin/one-time-approval-link/${linkId}`,
        {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
        }
      );
      if (response.status === 204) {
        // No Content
        return { info: 'Link deleted successfully.' };
      }
      if (!response.ok) {
        const data = await response
          .json()
          .catch(() => ({ detail: `Failed to delete link: ${response.statusText}` }));
        return { detail: data.detail || `Failed to delete link: ${response.statusText}` };
      }
      const data = await response.json().catch(() => null);
      return { info: data?.message || 'Link deleted successfully.' };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error deleting link.';
      return { detail: message };
    }
  };
};
