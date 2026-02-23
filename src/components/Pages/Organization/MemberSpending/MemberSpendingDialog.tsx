/**
 * MemberSpendingDialog - Dialog for viewing and editing member spending limits.
 *
 * Features:
 * - View current month's spending
 * - Set a specific dollar amount limit
 * - Remove limit (set to unlimited)
 * - Validation against org limit
 * - Shows spending progress bar
 * - Loading state during save
 */

'use client';

import * as React from 'react';
import { Loader2, AlertCircle, Infinity, DollarSign } from 'lucide-react';
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
import { SpendingDisplayProps } from '@/types/organization';

export interface MemberSpendingDialogProps {
  /** Whether the dialog is open */
  open: boolean;
  /** Callback when open state changes */
  onOpenChange: (open: boolean) => void;
  /** Member's name for display */
  memberName: string;
  /** Member's email for display */
  memberEmail?: string;
  /** Current spending limit (null = unlimited) */
  currentLimit: number | null;
  /** Current spend amount */
  currentSpend: number;
  /** Display props for spending visualization */
  display: SpendingDisplayProps | null;
  /** Organization's spending limit (for validation context) */
  orgLimit?: number | null;
  /** Callback to save the new limit */
  onSave: (newLimit: number | null) => Promise<{ success: boolean; error?: string }>;
  /** Whether editing is allowed */
  canEdit?: boolean;
}

export function MemberSpendingDialog({
  open,
  onOpenChange,
  memberName,
  memberEmail,
  currentLimit,
  currentSpend,
  display,
  orgLimit,
  onSave,
  canEdit = true,
}: MemberSpendingDialogProps) {
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
      // Validate against org limit
      if (orgLimit !== null && orgLimit !== undefined && parsed > orgLimit) {
        setError(`Member limit cannot exceed organization limit (${formatSpendAmount(orgLimit)})`);
        return;
      }
      newLimit = parsed;
    }

    setIsSaving(true);
    try {
      const result = await onSave(newLimit);
      if (result.success) {
        onOpenChange(false);
      } else {
        setError(result.error || 'Failed to save spending limit');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred');
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
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            {canEdit ? 'Edit Spending Limit' : 'Spending Details'}
          </DialogTitle>
          <DialogDescription>
            {memberName}
            {memberEmail && <span className="text-muted-foreground"> ({memberEmail})</span>}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="mt-4 space-y-4">
            {/* Current spend context */}
            <div className="rounded-md bg-muted p-3">
              <div className="flex items-center justify-between">
                <span className="text-body-muted">Current spend this month:</span>
                <span className="font-medium">{formatSpendAmount(currentSpend)}</span>
              </div>
              {display && !display.isUnlimited && (
                <div className="mt-2">
                  <div className="text-caption flex items-center justify-between">
                    <span>
                      {display.percentUsed.toFixed(0)}% of {formatSpendAmount(display.limit!)}
                    </span>
                  </div>
                  <div className="bg-muted-foreground/20 mt-1 h-2 w-full overflow-hidden rounded-full">
                    <div
                      className={cn(
                        'h-full rounded-full transition-all',
                        display.isOverLimit
                          ? 'bg-destructive'
                          : display.isNearLimit
                            ? 'bg-amber-500'
                            : 'bg-primary'
                      )}
                      style={{ width: `${Math.min(display.percentUsed, 100)}%` }}
                    />
                  </div>
                </div>
              )}
              {display?.isUnlimited && <div className="text-caption mt-1">No limit set</div>}
            </div>

            {/* Org limit context */}
            {orgLimit !== null && orgLimit !== undefined && (
              <div className="text-caption">Organization limit: {formatSpendAmount(orgLimit)}</div>
            )}

            {/* Only show editing controls if allowed */}
            {canEdit && (
              <>
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
                    <Label htmlFor="member-spending-limit">Monthly limit ($)</Label>
                    <div className="relative">
                      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                        $
                      </span>
                      <Input
                        id="member-spending-limit"
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="100.00"
                        value={limitValue}
                        onChange={(e) => {
                          setLimitValue(e.target.value);
                          setError(null);
                        }}
                        className="pl-7"
                        disabled={isSaving}
                        autoFocus
                      />
                    </div>
                  </div>
                )}

                {/* Warning if limit would be exceeded */}
                {wouldBeOverLimit && (
                  <div className="flex items-start gap-2 rounded-md bg-amber-500/10 p-3 text-sm text-amber-600 dark:text-amber-500">
                    <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                    <span>
                      This limit is at or below current spend. Billable activity will be blocked
                      immediately.
                    </span>
                  </div>
                )}
              </>
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
              {canEdit ? 'Cancel' : 'Close'}
            </Button>
            {canEdit && (
              <Button
                type="submit"
                disabled={isSaving || (!isUnlimited && !limitValue)}
                className={cn(isSaving && 'cursor-wait')}
              >
                {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isSaving ? 'Saving...' : 'Save Limit'}
              </Button>
            )}
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
