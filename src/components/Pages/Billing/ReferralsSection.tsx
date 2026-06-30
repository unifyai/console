'use client';

import { useState } from 'react';
import { Gift, Copy, Check } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../../UI/button';
import { Badge } from '../../UI/badge';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '../../UI/sheet';
import { useReferrals } from '@/hooks/Billing/useReferrals';
import { formatCredits } from '@/lib/billing/currency';
import type { BillingOrgContext } from '@/types/billing';

export interface ReferralsSectionProps {
  orgContext?: BillingOrgContext | null;
}

// =============================================================================
// Helpers
// =============================================================================

const statusLabel: Record<string, string> = {
  pending: 'Signed up',
  rewarded: 'Earned',
  reversed: 'Reversed',
};

const statusVariant: Record<string, 'secondary' | 'primary' | 'destructive'> = {
  pending: 'secondary',
  rewarded: 'primary',
  reversed: 'destructive',
};

// =============================================================================
// Component
// =============================================================================

/**
 * "Refer & earn" section for the CREDITS billing page.
 *
 * Renders a compact header row with a trigger button; the shareable link,
 * headline reward terms, earnings stats, and the status of everyone the user
 * has referred live in a right-side slide-out panel (mirroring the
 * billing-profile / payment-methods surfaces). Rewards are granted
 * server-side when a referred friend makes their first qualifying payment, so
 * this surface is read-only apart from copying the link.
 */
export const ReferralsSection = ({ orgContext }: ReferralsSectionProps) => {
  const { summary, list } = useReferrals();
  const [copied, setCopied] = useState(false);
  const [open, setOpen] = useState(false);
  const earner = orgContext ? orgContext.orgName : 'you';
  const getVerb = orgContext ? 'gets' : 'get';

  const data = summary.data;
  const referrals = list.data?.referrals ?? [];

  const handleCopy = async () => {
    if (!data?.referral_url) return;
    try {
      await navigator.clipboard.writeText(data.referral_url);
      setCopied(true);
      toast.success('Referral link copied');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Could not copy link');
    }
  };

  // Reward headline: a flat referrer reward and a flat welcome bonus for the
  // friend (both framed as display credits), unlocked once the friend has
  // subscribed and spent their first `qualifying_spend` of real money.
  const rewardLabel = data ? formatCredits(data.reward_credits) : '—';
  const rewardMoney = data ? `$${data.reward_credits}` : '—';
  const spendMoney = data ? `$${data.qualifying_spend}` : '—';
  const bonusLabel = data ? formatCredits(data.referee_bonus_credits) : '—';
  const bonusMoney = data ? `$${data.referee_bonus_credits}` : '—';
  const earnedLabel = data ? formatCredits(data.total_credits_earned) : '—';

  return (
    <section className="space-y-4" data-testid="referrals-section">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-h3 flex items-center gap-2">
            <Gift className="h-5 w-5" />
            Refer &amp; earn
          </h2>
          <p className="text-body-muted mt-1">
            Share your link and earn credits when a friend signs up and subscribes.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setOpen(true)}
          className="gap-1.5"
          data-testid="referrals-open-button"
        >
          <Gift className="h-4 w-4" />
          Refer &amp; earn
        </Button>
      </div>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="flex w-full flex-col gap-0 overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <Gift className="h-5 w-5" />
              Refer &amp; earn
            </SheetTitle>
            <SheetDescription>
              When a friend signs up, {earner} {getVerb} a {rewardLabel} ({rewardMoney}) bonus
              following their first {spendMoney} real spend, and they get a {bonusLabel} (
              {bonusMoney}) welcome bonus.
            </SheetDescription>
          </SheetHeader>

          <div className="mt-6 space-y-5">
            {summary.isError ? (
              <p className="text-body-muted">Referral details are unavailable right now.</p>
            ) : (
              <>
                {/* Share link */}
                <div className="space-y-2">
                  <label className="text-caption text-muted-foreground">Your referral link</label>
                  <div className="flex items-center gap-2">
                    <input
                      readOnly
                      value={summary.isLoading ? 'Loading…' : (data?.referral_url ?? '')}
                      className="text-code-sm w-full truncate rounded-md border border-input bg-muted px-3 py-2"
                      onFocus={(e) => e.currentTarget.select()}
                      data-testid="referral-link-input"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleCopy}
                      disabled={!data?.referral_url}
                      data-testid="referral-copy-button"
                    >
                      {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                      {copied ? 'Copied' : 'Copy'}
                    </Button>
                  </div>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="rounded-lg border border-border p-3">
                    <p className="text-h3" data-testid="referrals-pending">
                      {summary.isLoading ? '…' : (data?.pending_count ?? 0)}
                    </p>
                    <p className="text-caption text-muted-foreground">Signed up</p>
                  </div>
                  <div className="rounded-lg border border-border p-3">
                    <p className="text-h3" data-testid="referrals-rewarded">
                      {summary.isLoading ? '…' : (data?.rewarded_count ?? 0)}
                    </p>
                    <p className="text-caption text-muted-foreground">Subscribed</p>
                  </div>
                  <div className="rounded-lg border border-border p-3">
                    <p className="text-h3" data-testid="referrals-earned">
                      {summary.isLoading ? '…' : earnedLabel}
                    </p>
                    <p className="text-caption text-muted-foreground">Credits earned</p>
                  </div>
                </div>

                {/* Referral list */}
                {referrals.length > 0 && (
                  <div className="space-y-2">
                    <label className="text-caption text-muted-foreground">Your referrals</label>
                    <div className="divide-y divide-border rounded-lg border border-border">
                      {referrals.map((r, i) => (
                        <div
                          key={`${r.created_at}-${i}`}
                          className="flex items-center justify-between px-3 py-2"
                        >
                          <span className="text-body-muted text-sm">
                            {new Date(r.created_at).toLocaleDateString()}
                          </span>
                          <div className="flex items-center gap-3">
                            {r.status === 'rewarded' && r.reward_amount != null && (
                              <span className="text-caption text-muted-foreground">
                                +{formatCredits(r.reward_amount)}
                              </span>
                            )}
                            <Badge variant={statusVariant[r.status] ?? 'secondary'}>
                              {statusLabel[r.status] ?? r.status}
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </section>
  );
};
