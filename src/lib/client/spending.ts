/**
 * Client-side API functions for spending endpoints.
 *
 * Covers user, organization, and assistant spending + limits.
 */

import { UserSpend, UserSpendingLimitResponse } from '@/types/user/spending';
import { OrgSpend, OrgSpendingLimitResponse } from '@/types/organization';
import { AssistantSpend, SpendingLimitResponse } from '@/types/assistants/spending';
import { ResponseProps } from '@/types/common';

// ---------------------------------------------------------------------------
// User spending
// ---------------------------------------------------------------------------

export async function fetchUserSpend(month?: string): Promise<UserSpend | ResponseProps> {
  try {
    const params = new URLSearchParams();
    if (month) params.set('month', month);

    const res = await fetch(`/api/user/spending?${params}`);
    const data = await res.json();
    if (!res.ok) return { detail: data?.detail || 'Failed to fetch user spending' };
    return data;
  } catch (error) {
    return { detail: error instanceof Error ? error.message : 'Failed to fetch user spending' };
  }
}

export async function fetchUserSpendingLimit(): Promise<UserSpendingLimitResponse | ResponseProps> {
  try {
    const res = await fetch('/api/user/spending-limit');
    const data = await res.json();
    if (!res.ok) return { detail: data?.detail || 'Failed to fetch user spending limit' };
    return data;
  } catch (error) {
    return { detail: error instanceof Error ? error.message : 'Failed to fetch user spending limit' };
  }
}

// ---------------------------------------------------------------------------
// Organization spending
// ---------------------------------------------------------------------------

export async function fetchOrgSpend(
  orgId: number,
  month?: string
): Promise<OrgSpend | ResponseProps> {
  try {
    const params = new URLSearchParams();
    if (month) params.set('month', month);

    const res = await fetch(`/api/organizations/${orgId}/spending?${params}`);
    const data = await res.json();
    if (!res.ok) return { detail: data?.detail || 'Failed to fetch org spending' };
    return data;
  } catch (error) {
    return { detail: error instanceof Error ? error.message : 'Failed to fetch org spending' };
  }
}

export async function fetchOrgSpendingLimit(
  orgId: number
): Promise<OrgSpendingLimitResponse | ResponseProps> {
  try {
    const res = await fetch(`/api/organizations/${orgId}/spending-limit`);
    const data = await res.json();
    if (!res.ok) return { detail: data?.detail || 'Failed to fetch org spending limit' };
    return data;
  } catch (error) {
    return { detail: error instanceof Error ? error.message : 'Failed to fetch org spending limit' };
  }
}

// ---------------------------------------------------------------------------
// Assistant spending
// ---------------------------------------------------------------------------

export async function fetchAssistantSpend(
  assistantId: string,
  month?: string
): Promise<AssistantSpend | ResponseProps> {
  try {
    const params = new URLSearchParams();
    if (month) params.set('month', month);

    const res = await fetch(`/api/assistant/${assistantId}/spending?${params}`);
    const data = await res.json();
    if (!res.ok) return { detail: data?.detail || 'Failed to fetch assistant spending' };
    return data;
  } catch (error) {
    return { detail: error instanceof Error ? error.message : 'Failed to fetch assistant spending' };
  }
}

export async function fetchAssistantSpendingLimit(
  assistantId: string
): Promise<SpendingLimitResponse | ResponseProps> {
  try {
    const res = await fetch(`/api/assistant/${assistantId}/spending-limit`);
    const data = await res.json();
    if (!res.ok) return { detail: data?.detail || 'Failed to fetch assistant spending limit' };
    return data;
  } catch (error) {
    return { detail: error instanceof Error ? error.message : 'Failed to fetch assistant spending limit' };
  }
}
