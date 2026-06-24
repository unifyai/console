'use client';

import { useState } from 'react';
import { Plus } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent } from '../../UI/card';
import { Input } from '../../UI/input';
import { Button } from '../../UI/button';
import { Loader } from '@/components/Common/Loader';
import { isBillingError, type BillingActions } from '@/types/billing';

// =============================================================================
// Props
// =============================================================================

export interface TopUpSectionProps {
  /** Bound `topUp` server action. */
  topUp: BillingActions['topUp'];
  /** Refresh the balance after a successful top-up. */
  onToppedUp: () => void | Promise<void>;
  /** Whether the active workspace may mutate billing (org non-admins can't). */
  canEdit?: boolean;
}

const QUICK_AMOUNTS = [10, 25, 50, 100];

// =============================================================================
// Component
// =============================================================================

/**
 * Self-serve, no-charge credit top-up for manual-top-up deployments (staging).
 *
 * Credits meter and gate work exactly as in production, but there is no Stripe
 * checkout or card — developers replenish the wallet for free with a deliberate
 * "how much do I need" amount, so runaway spend is impossible.
 */
export const TopUpSection = ({ topUp, onToppedUp, canEdit = true }: TopUpSectionProps) => {
  const [amount, setAmount] = useState('25');
  const [submitting, setSubmitting] = useState(false);

  const parsed = Number(amount);
  const isValid = Number.isFinite(parsed) && parsed > 0;

  const handleTopUp = async () => {
    if (!isValid || submitting) return;
    setSubmitting(true);
    try {
      const result = await topUp(parsed);
      if (isBillingError(result)) {
        console.error('Failed to top up credits:', result.detail);
        toast.error('Could not top up credits. Please try again.');
        return;
      }
      toast.success(`Topped up ${result.added} credits.`);
      await onToppedUp();
    } catch (error) {
      console.error('Failed to top up credits:', error);
      toast.error('Could not top up credits. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="space-y-4" data-testid="topup-section">
      <div>
        <h2 className="text-h3 flex items-center gap-2">
          <Plus className="h-5 w-5" />
          Top up credits
        </h2>
        <p className="text-body-muted mt-1">
          Staging meters credits like production, but you replenish them for free here — no card and
          no charge. Top up an amount that feels sensible so you notice when it runs out.
        </p>
      </div>

      <Card>
        <CardContent className="space-y-4 pt-6">
          <div className="flex flex-wrap gap-2">
            {QUICK_AMOUNTS.map((value) => (
              <Button
                key={value}
                type="button"
                variant="outline"
                size="sm"
                disabled={!canEdit || submitting}
                onClick={() => setAmount(String(value))}
                data-testid={`topup-quick-${value}`}
              >
                {value}
              </Button>
            ))}
          </div>

          <div className="flex items-end gap-3">
            <div className="flex-1 space-y-1">
              <label htmlFor="topup-amount" className="text-caption text-muted-foreground">
                Credits
              </label>
              <Input
                id="topup-amount"
                type="number"
                min={1}
                step={1}
                value={amount}
                disabled={!canEdit || submitting}
                onChange={(e) => setAmount(e.target.value)}
                data-testid="topup-amount-input"
              />
            </div>
            <Button
              type="button"
              onClick={handleTopUp}
              disabled={!canEdit || !isValid || submitting}
              data-testid="topup-submit"
            >
              {submitting ? <Loader size={16} /> : 'Top up'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </section>
  );
};
