/**
 * Re-exports of OpenAPI-generated types from Orchestra.
 *
 * These types are auto-generated from Orchestra's OpenAPI spec.
 * The OpenAPI types are in snake_case, but our middleware transforms
 * responses to camelCase. Use the CamelCase<T> utility for frontend types.
 *
 * Usage:
 *   // For API routes (snake_case, before transformation)
 *   import type { ApiOrganization } from '@/types/orchestra';
 *
 *   // For frontend (camelCase, after transformation)
 *   import type { Organization } from '@/types/orchestra';
 */

import type { components } from '@/lib/orchestra/schema';

// =============================================================================
// Utility Types for snake_case to camelCase conversion
// =============================================================================

/** Convert snake_case string to camelCase */
type SnakeToCamel<S extends string> = S extends `${infer T}_${infer U}`
  ? `${T}${Capitalize<SnakeToCamel<U>>}`
  : S;

/** Convert all keys in an object from snake_case to camelCase (shallow) */
type CamelCaseKeys<T> = {
  [K in keyof T as SnakeToCamel<K & string>]: T[K];
};

/**
 * Deep convert all keys from snake_case to camelCase.
 * Handles nested objects and arrays.
 */
export type CamelCase<T> = T extends (infer U)[]
  ? CamelCase<U>[]
  : T extends object
    ? {
        [K in keyof T as SnakeToCamel<K & string>]: CamelCase<T[K]>;
      }
    : T;

// =============================================================================
// API Types (snake_case - for use in API routes before transformation)
// =============================================================================

/** Organization from Orchestra API (snake_case) */
export type ApiOrganization = components['schemas']['OrganizationResponse'];

/** Organization member from Orchestra API (snake_case) */
export type ApiOrganizationMember = components['schemas']['OrganizationMemberResponse'];

/** Project from Orchestra API (snake_case) */
export type ApiProject = components['schemas']['ProjectOut'];

/** Project tree item from Orchestra API (snake_case) */
export type ApiProjectTreeItem = components['schemas']['ProjectTreeItem'];

/** Interface from Orchestra API (snake_case) */
export type ApiInterface = components['schemas']['InterfaceSchema'];

/** Tab from Orchestra API (snake_case) */
export type ApiTab = components['schemas']['TabSchema'];

/** Tile from Orchestra API (snake_case) */
export type ApiTile = components['schemas']['TileSchema'];

/** Assistant from Orchestra API (snake_case) */
export type ApiAssistant = components['schemas']['AssistantRead'];

// =============================================================================
// Frontend Types (camelCase - for use in components after transformation)
// =============================================================================

/** Organization (camelCase for frontend) */
export type Organization = CamelCase<components['schemas']['OrganizationResponse']>;

/** Organization member (camelCase for frontend) */
export type OrganizationMember = CamelCase<components['schemas']['OrganizationMemberResponse']>;

/** Project (camelCase for frontend) */
export type Project = CamelCase<components['schemas']['ProjectOut']>;

/** Project tree item (camelCase for frontend) */
export type ProjectTreeItem = CamelCase<components['schemas']['ProjectTreeItem']>;

/** Project config (camelCase for frontend) */
export type ProjectConfig = CamelCase<components['schemas']['ProjectConfig']>;

/** Interface schema (camelCase for frontend) */
export type InterfaceSchema = CamelCase<components['schemas']['InterfaceSchema']>;

/** Interface info (camelCase for frontend) */
export type InterfaceInfo = CamelCase<components['schemas']['InterfaceInfo']>;

/** Tab schema (camelCase for frontend) */
export type TabSchema = CamelCase<components['schemas']['TabSchema']>;

/** Tab info (camelCase for frontend) */
export type TabInfo = CamelCase<components['schemas']['TabInfo']>;

/** Tile schema (camelCase for frontend) */
export type TileSchema = CamelCase<components['schemas']['TileSchema']>;

/** Tile position (camelCase for frontend) */
export type TilePosition = CamelCase<components['schemas']['TilePosition']>;

/** Invite response (camelCase for frontend) */
export type InviteResponse = CamelCase<components['schemas']['InviteResponse']>;

/** Role response (camelCase for frontend) */
export type RoleResponse = CamelCase<components['schemas']['RoleResponse']>;

/** Assistant read (camelCase for frontend) */
export type AssistantRead = CamelCase<components['schemas']['AssistantRead']>;

/** Voice read (camelCase for frontend) */
export type VoiceRead = CamelCase<components['schemas']['VoiceRead']>;

// =============================================================================
// Request Types (camelCase - sent from frontend, transformed to snake_case)
// =============================================================================

/** Create interface request (camelCase from frontend) */
export type CreateInterfaceRequest = CamelCase<components['schemas']['CreateInterfaceRequest']>;

/** Create tab request (camelCase from frontend) */
export type CreateTabRequest = CamelCase<components['schemas']['CreateTabRequest']>;

/** Update tab request (camelCase from frontend) */
export type UpdateTabRequest = CamelCase<components['schemas']['UpdateTabRequest']>;

/** Create tile request (camelCase from frontend) */
export type CreateTileRequest = CamelCase<components['schemas']['CreateTileRequest']>;

/** Update tile request (camelCase from frontend) */
export type UpdateTileRequest = CamelCase<components['schemas']['UpdateTileRequest']>;

/** Project update request (camelCase from frontend) */
export type ProjectUpdateRequest = CamelCase<components['schemas']['ProjectUpdate']>;

/** Organization create request (camelCase from frontend) */
export type OrganizationCreateRequest = CamelCase<components['schemas']['OrganizationCreate']>;

/** Organization update request (camelCase from frontend) */
export type OrganizationUpdateRequest = CamelCase<components['schemas']['OrganizationUpdate']>;

/** Assistant create request (camelCase from frontend) */
export type AssistantCreateRequest = CamelCase<components['schemas']['AssistantCreate']>;

/** Assistant update request (camelCase from frontend) */
export type AssistantUpdateRequest = CamelCase<components['schemas']['AssistantUpdate']>;

// =============================================================================
// Context Types
// =============================================================================

/** Context create request */
export type ContextCreateRequest = CamelCase<components['schemas']['ContextCreateRequest']>;

/** Context commit */
export type ContextCommit = CamelCase<components['schemas']['ContextCommit']>;

/** Context commit history */
export type ContextCommitHistory = CamelCase<components['schemas']['ContextCommitHistory']>;

// =============================================================================
// User & Business Types
// =============================================================================

/** Business address (camelCase for frontend) */
export type BusinessAddress = CamelCase<components['schemas']['BusinessAddress']>;

/** Business info (camelCase for frontend) */
export type BusinessInfo = CamelCase<components['schemas']['BusinessInfo']>;

/** Onboarding status response */
export type OnboardingStatusResponse = CamelCase<components['schemas']['OnboardingStatusResponse']>;

// =============================================================================
// Generic Response Types
// =============================================================================

/** HTTP validation error */
export type HTTPValidationError = components['schemas']['HTTPValidationError'];

/** Info response wrapper for strings */
export type InfoResponseString = components['schemas']['InfoResponse_str_'];
