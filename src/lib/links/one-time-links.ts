import { ResponseProps } from '@/types/common';
import {
  OneTimeLinkResponse,
  OneTimeLinkEntry,
  ADMIN_TABLE_PAGE_SIZE,
} from '@/types/admin';

export const generateOneTimeCreditGrantLink = async () => {
  return async (
    expiresInDays: number = 7,
    creditAmount: number | null = null,
    maxClaims: number | null = 1,
    name: string | null = null
  ): Promise<OneTimeLinkResponse | ResponseProps> => {
    'use server';

    try {
      const body: Record<string, unknown> = { expiresInDays, maxClaims };
      if (creditAmount != null) {
        body.creditAmount = creditAmount;
      }
      if (name) {
        body.name = name;
      }

      const response = await fetch(
        `${process.env.NEXTAUTH_URL}/api/admin/credit-grant-link`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        }
      );
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

export const listOneTimeCreditGrantLinks = async () => {
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
        `${process.env.NEXTAUTH_URL}/api/admin/credit-grant-link?${queryParams.toString()}`,
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
        error instanceof Error ? error.message : 'Unknown error listing credit grant links.';
      return { detail: message };
    }
  };
};

export const deleteOneTimeCreditGrantLink = async () => {
  return async (linkId: string): Promise<ResponseProps> => {
    'use server';
    try {
      const response = await fetch(
        `${process.env.NEXTAUTH_URL}/api/admin/credit-grant-link/${linkId}`,
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
