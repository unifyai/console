/**
 * Orchestra API - Direct Backend Calls
 *
 * This directory consolidates ALL direct Orchestra API calls.
 * Everything here bypasses Next.js API routes and calls Orchestra directly.
 *
 * Structure:
 * - user.ts       - User account, onboarding, business status (typed client)
 * - organization.ts - Orgs, roles, teams, resource access (typed client)
 * - endpoints.ts  - Providers, models, endpoints (typed client)
 * - favourites.ts - User favourites (typed client)
 * - billing.ts    - Billing, credits, stripe (admin client - not in OpenAPI)
 * - logging.ts    - Metrics, queries, tags (legacy client - not in OpenAPI)
 * - admin.ts      - Admin-only operations (admin client - not in OpenAPI)
 */

// Typed client exports (using OpenAPI generated types)
export * from './user';
export * from './endpoints';
export * from './favourites';
export * from './organization';

// Note: billing, logging, and admin will be added as we migrate them
