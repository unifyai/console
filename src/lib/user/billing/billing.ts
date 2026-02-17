/**
 * @deprecated Import from '@/lib/orchestra/api/billing' instead
 * This file re-exports from the consolidated location for backward compatibility.
 */

export {
  getUserBillingDetails,
  getBillingAccountInfo,
  enableAutoRecharge,
  setAutoRechargeThreshold,
  setAutoRechargeQty,
  createRecharge,
  getUserCards,
  storeUserCard,
  isDuplicateCard,
  getRecharges,
  getAutoRechargeEligibility,
} from '@/lib/orchestra/api/billing';

// Re-export types
export type {
  BillingDetails,
  BillingAccountInfo,
  RechargeModelRequest,
  AutoRechargeEligibility,
} from '@/lib/orchestra/api/billing';
