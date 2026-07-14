/**
 * Client-side API functions for spending endpoints.
 *
 * Covers user, organization, member, and assistant spending + limits.
 * Members page uses these (not server actions) so N parallel GETs do not
 * serialize through Next.js' per-page server-action channel.
 */

import { UserSpend, UserSpendingLimitResponse } from '@/types/user/spending';
import {
  MemberSpend,
  MemberSpendingLimitRequest,
  MemberSpendingLimitResponse,
  OrgSpend,
  OrgSpendingLimitResponse,
} from '@/types/organization';
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
    return {
      detail: error instanceof Error ? error.message : 'Failed to fetch user spending limit',
    };
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
    return {
      detail: error instanceof Error ? error.message : 'Failed to fetch org spending limit',
    };
  }
}

// ---------------------------------------------------------------------------
// Organization member spending
// ---------------------------------------------------------------------------

export async function fetchMemberSpend(
  orgId: number,
  userId: string,
  month?: string
): Promise<MemberSpend | ResponseProps> {
  try {
    const params = new URLSearchParams();
    if (month) params.set('month', month);

    const res = await fetch(
      `/api/organizations/${orgId}/members/${encodeURIComponent(userId)}/spending?${params}`
    );
    const data = await res.json();
    if (!res.ok) return { detail: data?.detail || 'Failed to fetch member spending' };
    return data;
  } catch (error) {
    return {
      detail: error instanceof Error ? error.message : 'Failed to fetch member spending',
    };
  }
}

export async function fetchMemberSpendingLimit(
  orgId: number,
  userId: string
): Promise<MemberSpendingLimitResponse | ResponseProps> {
  try {
    const res = await fetch(
      `/api/organizations/${orgId}/members/${encodeURIComponent(userId)}/spending-limit`
    );
    const data = await res.json();
    if (!res.ok) return { detail: data?.detail || 'Failed to fetch member spending limit' };
    return data;
  } catch (error) {
    return {
      detail: error instanceof Error ? error.message : 'Failed to fetch member spending limit',
    };
  }
}

export async function updateMemberSpendingLimit(
  orgId: number,
  userId: string,
  payload: MemberSpendingLimitRequest
): Promise<(MemberSpendingLimitResponse & ResponseProps) | ResponseProps> {
  try {
    const res = await fetch(
      `/api/organizations/${orgId}/members/${encodeURIComponent(userId)}/spending-limit`,
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }
    );
    const data = await res.json();
    if (!res.ok) return { detail: data?.detail || 'Failed to update member spending limit' };
    return data;
  } catch (error) {
    return {
      detail: error instanceof Error ? error.message : 'Failed to update member spending limit',
    };
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
    return {
      detail: error instanceof Error ? error.message : 'Failed to fetch assistant spending',
    };
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
    return {
      detail: error instanceof Error ? error.message : 'Failed to fetch assistant spending limit',
    };
  }
}
