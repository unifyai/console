/**
 * SpendingLimitDialog - Dialog for editing assistant spending limits.
 *
 * Features:
 * - Set a specific dollar amount limit
 * - Remove limit (set to unlimited)
 * - Validation for non-negative values
 * - Shows current spend for context
 * - Loading state during save
 */

'use client';

import * as React from 'react';
import { Loader2, AlertCircle, Infinity } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/UI/dialog';
import { Button } from '@/components/UI/button';
import { Input } from '@/components/UI/input';
import { Label } from '@/components/UI/label';
import { cn } from '@/lib/utils';
import { formatSpendAmount } from '@/types/assistants/spending';

export interface SpendingLimitDialogProps {
  /** Whether the dialog is open */
  open: boolean;
  /** Callback when open state changes */
  onOpenChange: (open: boolean) => void;
  /** Current spending limit (null = unlimited) */
  currentLimit: number | null;
  /** Current spend amount for context */
  currentSpend: number;
  /** Callback to save the new limit */
  onSave: (newLimit: number | null) => Promise<{ success: boolean; error?: string }>;
}

export function SpendingLimitDialog({
  open,
  onOpenChange,
  currentLimit,
  currentSpend,
  onSave,
}: SpendingLimitDialogProps) {
  const [limitValue, setLimitValue] = React.useState<string>('');
  const [isUnlimited, setIsUnlimited] = React.useState(currentLimit === null);
  const [isSaving, setIsSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Reset state when dialog opens
  React.useEffect(() => {
    if (open) {
      setIsUnlimited(currentLimit === null);
      setLimitValue(currentLimit !== null ? currentLimit.toString() : '');
      setError(null);
    }
  }, [open, currentLimit]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    let newLimit: number | null = null;

    if (!isUnlimited) {
      const parsed = parseFloat(limitValue);
      if (isNaN(parsed)) {
        setError('Please enter a valid number');
        return;
      }
      if (parsed < 0) {
        setError('Limit must be a positive number');
        return;
      }
      newLimit = parsed;
    }

    setIsSaving(true);
    try {
      const result = await onSave(newLimit);
      if (!result.success) {
        // Show generic error to avoid exposing backend details
        setError('Unable to update spending limit. Please try again.');
      }
    } catch (err) {
      setError('Unable to update spending limit. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleUnlimitedToggle = () => {
    setIsUnlimited(!isUnlimited);
    setError(null);
  };

  // Check if new limit would be below current spend
  const parsedLimit = parseFloat(limitValue);
  const wouldBeOverLimit =
    !isUnlimited && !isNaN(parsedLimit) && parsedLimit > 0 && currentSpend >= parsedLimit;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit}>
          <div className="mt-4 space-y-4">
            {/* Current spend context */}
            <div className="rounded-md bg-muted p-3">
              <p className="text-sm">
                <span className="text-muted-foreground">Current spend this month: </span>
                <span className="font-medium">{formatSpendAmount(currentSpend)}</span>
              </p>
            </div>

            {/* Limit type toggle */}
            <div className="flex gap-2">
              <Button
                type="button"
                variant={!isUnlimited ? 'default' : 'outline'}
                size="sm"
                onClick={() => setIsUnlimited(false)}
                className="flex-1"
              >
                Set Limit
              </Button>
              <Button
                type="button"
                variant={isUnlimited ? 'default' : 'outline'}
                size="sm"
                onClick={handleUnlimitedToggle}
                className="flex-1 gap-1"
              >
                <Infinity className="h-4 w-4" />
                Unlimited
              </Button>
            </div>

            {/* Limit input */}
            {!isUnlimited && (
              <div className="space-y-2">
                <Label htmlFor="spending-limit">Monthly limit (credits)</Label>
                <div className="relative">
                  <Input
                    id="spending-limit"
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="100.00"
                    value={limitValue}
                    onChange={(e) => {
                      setLimitValue(e.target.value);
                      setError(null);
                    }}
                    className="pr-16"
                    disabled={isSaving}
                    autoFocus
                  />
                  <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                    credits
                  </span>
                </div>
              </div>
            )}

            {/* Warning if limit would be exceeded */}
            {wouldBeOverLimit && (
              <div className="text-body flex items-start gap-2 rounded-md bg-[color:var(--status-warning-bg)] p-3 text-[color:var(--status-warning)]">
                <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                <span>
                  This limit is at or below current spend. Billable activity will be blocked
                  immediately.
                </span>
              </div>
            )}

            {/* Error message */}
            {error && (
              <div className="bg-destructive/10 text-body text-error flex items-start gap-2 rounded-md p-3">
                <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}
          </div>

          <DialogFooter className="mt-6">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSaving}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSaving || (!isUnlimited && !limitValue)}
              className={cn(isSaving && 'cursor-wait')}
            >
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isSaving ? 'Saving...' : 'Save Limit'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
