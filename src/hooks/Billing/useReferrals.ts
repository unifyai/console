'use client';

/**
 * useReferrals — fetches the caller's referral link/stats and their list of
 * referrals from the backend (via the Next.js proxy routes), plus a mutation
 * to mint additional referral codes.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

/* eslint-disable @typescript-eslint/naming-convention -- Orchestra wire format. */
export interface ReferralCode {
  code: string;
  label?: string | null;
  created_at: string;
  disabled: boolean;
}

export interface ReferralSummary {
  code: string;
  referral_url: string;
  codes: ReferralCode[];
  pending_count: number;
  rewarded_count: number;
  total_credits_earned: number;
  reward_pct: number;
  reward_max_credits: number;
  referee_bonus_credits: number;
}

export interface ReferralListItem {
  status: string; // pending | rewarded | reversed
  created_at: string;
  rewarded_at?: string | null;
  reward_amount?: number | null;
}
/* eslint-enable @typescript-eslint/naming-convention */

export const REFERRAL_SUMMARY_QUERY_KEY = ['referral-summary'];
export const REFERRAL_LIST_QUERY_KEY = ['referral-list'];

async function fetchSummary(): Promise<ReferralSummary> {
  const res = await fetch('/api/user/referral');
  if (!res.ok) {
    throw new Error('Failed to load referral summary');
  }
  return res.json();
}

async function fetchList(): Promise<{ referrals: ReferralListItem[] }> {
  const res = await fetch('/api/user/referrals');
  if (!res.ok) {
    throw new Error('Failed to load referrals');
  }
  return res.json();
}

export function useReferrals(enabled = true) {
  const queryClient = useQueryClient();

  const summary = useQuery({
    queryKey: REFERRAL_SUMMARY_QUERY_KEY,
    queryFn: fetchSummary,
    enabled,
    staleTime: 60_000,
  });

  const list = useQuery({
    queryKey: REFERRAL_LIST_QUERY_KEY,
    queryFn: fetchList,
    enabled,
    staleTime: 60_000,
  });

  const createCode = useMutation({
    mutationFn: async (label?: string) => {
      const res = await fetch('/api/user/referral', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label: label ?? null }),
      });
      if (!res.ok) {
        throw new Error('Failed to create referral code');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: REFERRAL_SUMMARY_QUERY_KEY });
    },
  });

  return { summary, list, createCode };
}
