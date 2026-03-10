/**
 * Orchestra API - Direct Backend Calls
 *
 * This directory consolidates ALL direct Orchestra API calls.
 * Everything here bypasses Next.js API routes and calls Orchestra directly.
 *
 * Structure:
 * - user.ts         - User account, onboarding, business status, tax (typed client)
 * - organization.ts - Orgs, roles, teams, resource access (typed client)
 * - endpoints.ts    - Providers, models, endpoints (typed client)
 * - favourites.ts   - User favourites (typed client)
 * - logging.ts      - Metrics, queries, tags (user client - not in OpenAPI)
 * - admin.ts        - User CRUD, API key regeneration (admin client - not in OpenAPI)
 */

// Typed client exports (using OpenAPI generated types)
export * from './user';
export * from './endpoints';
export * from './favourites';
export * from './organization';

// Admin/legacy client exports (not in public OpenAPI spec)
export * from './logging';
export * from './admin';
