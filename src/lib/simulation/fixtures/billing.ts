/**
 * Billing / usage / credit-ledger fixtures.
 */

import type { MockBillingState, MockProject, MockTransaction } from '../types';

export const healthyBilling: MockBillingState = {
  balance: 142.5,
  nextPayment: 50,
  minCutoff: 10,
  freeTrial: false,
  autoReloadEnabled: true,
};

export const lowBalanceBilling: MockBillingState = {
  balance: 3.2,
  nextPayment: 25,
  minCutoff: 10,
  freeTrial: false,
  autoReloadEnabled: false,
};

export const freeTrialBilling: MockBillingState = {
  balance: 25,
  nextPayment: null,
  minCutoff: 0,
  freeTrial: true,
  autoReloadEnabled: false,
};

export const transactions: MockTransaction[] = [
  {
    id: 'txn_0001',
    category: 'inference',
    amount: -2.41,
    description: 'LLM usage — chat',
    createdAt: '2026-01-14T18:20:00.000Z',
    assistantId: '1002',
  },
  {
    id: 'txn_0002',
    category: 'communication',
    amount: -0.18,
    description: 'Outbound SMS',
    createdAt: '2026-01-13T12:00:00.000Z',
    assistantId: '2002',
  },
  {
    id: 'txn_0003',
    category: 'top_up',
    amount: 50,
    description: 'Auto-reload',
    createdAt: '2026-01-12T08:00:00.000Z',
  },
];

export const projects: MockProject[] = [
  {
    name: 'Assistants',
    description: 'Default assistant project',
    createdAt: '2025-09-01T12:00:00.000Z',
  },
  { name: 'Growth', description: 'Marketing experiments', createdAt: '2025-11-02T12:00:00.000Z' },
  { name: 'Support', description: 'Customer support flows', createdAt: '2025-12-10T12:00:00.000Z' },
];
