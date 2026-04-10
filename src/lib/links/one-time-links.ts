import { AxiosError } from 'axios';
import { ResponseProps } from '@/types/common';
import { OneTimeLinkResponse, OneTimeLinkEntry, ADMIN_TABLE_PAGE_SIZE } from '@/types/admin';
import { OrchestraAdminClient } from '@/lib/orchestra/orchestra-client';

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
      if (creditAmount != null) body.creditAmount = creditAmount;
      if (name) body.name = name;

      const response = await OrchestraAdminClient.post('/credit-grant-link', body);
      return response.data as OneTimeLinkResponse;
    } catch (error) {
      if (error instanceof AxiosError && error.response?.data?.detail) {
        return { detail: error.response.data.detail };
      }
      return { detail: error instanceof Error ? error.message : 'Unknown error generating link.' };
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
      const response = await OrchestraAdminClient.get('/credit-grant-link', {
        params: { limit, offset },
      });
      return response.data as OneTimeLinkEntry[];
    } catch (error) {
      if (error instanceof AxiosError && error.response?.data?.detail) {
        return { detail: error.response.data.detail };
      }
      return {
        detail:
          error instanceof Error ? error.message : 'Unknown error listing credit grant links.',
      };
    }
  };
};

export const deleteOneTimeCreditGrantLink = async () => {
  return async (linkId: string): Promise<ResponseProps> => {
    'use server';
    try {
      await OrchestraAdminClient.delete(`/credit-grant-link/${linkId}`);
      return { info: 'Link deleted successfully.' };
    } catch (error) {
      if (error instanceof AxiosError && error.response?.data?.detail) {
        return { detail: error.response.data.detail };
      }
      return { detail: error instanceof Error ? error.message : 'Unknown error deleting link.' };
    }
  };
};
