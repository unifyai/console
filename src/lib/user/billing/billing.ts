/**
 * @deprecated Import from '@/lib/orchestra/api/billing' instead
 * This file re-exports from the consolidated location for backward compatibility.
 */

export {
  getUserBillingDetails,
  enableAutoRecharge,
  setAutoRechargeThreshold,
  setAutoRechargeQty,
  createRecharge,
  getUserCards,
  storeUserCard,
  isDuplicateCard,
  getRecharges,
  getUserBillingEligibility,
} from '@/lib/orchestra/api/billing';

// Re-export types
export type {
  BillingDetails,
  RechargeModelRequest,
  BillingEligibility,
} from '@/lib/orchestra/api/billing';
