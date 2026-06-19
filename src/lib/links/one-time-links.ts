'use server';

import { AxiosError } from 'axios';
import { ResponseProps } from '@/types/common';
import { OneTimeLinkResponse, OneTimeLinkEntry, ADMIN_TABLE_PAGE_SIZE } from '@/types/admin';
import { OrchestraAdminClient } from '@/lib/orchestra/orchestra-client';
import { requireUnifyAdmin } from '@/lib/admin/_guard';

export async function generateOneTimeCreditGrantLink(
  expiresInDays: number = 7,
  creditAmount: number | null = null,
  maxClaims: number | null = 1,
  name: string | null = null
): Promise<OneTimeLinkResponse | ResponseProps> {
  const denied = await requireUnifyAdmin();
  if (denied) return denied;

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
}
export async function listOneTimeCreditGrantLinks(
  limit: number = ADMIN_TABLE_PAGE_SIZE,
  offset: number = 0
): Promise<OneTimeLinkEntry[] | ResponseProps> {
  const denied = await requireUnifyAdmin();
  if (denied) return denied;
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
      detail: error instanceof Error ? error.message : 'Unknown error listing credit grant links.',
    };
  }
}
export async function deleteOneTimeCreditGrantLink(linkId: string): Promise<ResponseProps> {
  const denied = await requireUnifyAdmin();
  if (denied) return denied;
  try {
    await OrchestraAdminClient.delete(`/credit-grant-link/${linkId}`);
    return { info: 'Link deleted successfully.' };
  } catch (error) {
    if (error instanceof AxiosError && error.response?.data?.detail) {
      return { detail: error.response.data.detail };
    }
    return { detail: error instanceof Error ? error.message : 'Unknown error deleting link.' };
  }
}
