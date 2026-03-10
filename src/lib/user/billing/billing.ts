/**
 * @deprecated Import from '@/lib/orchestra/api/billing' instead
 * This file re-exports from the consolidated location for backward compatibility.
 */

export {
  getBillingAccountInfo,
  enableAutoRecharge,
  setAutoRechargeThreshold,
  setAutoRechargeQty,
  getAutoRechargeEligibility,
} from '@/lib/orchestra/api/billing';

// Re-export types
export type {
  BillingAccountInfo,
  AutoRechargeEligibility,
} from '@/lib/orchestra/api/billing';
