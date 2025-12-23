/**
 * Plot Token Store
 *
 * In-memory cache for storing plot configurations with TTL.
 * Used to generate shareable plot URLs without storing actual data.
 *
 * Note: For production with multiple instances, consider Redis or
 * storing tokens in the Orchestra database. For single-instance
 * deployments, NodeCache is sufficient.
 *
 * Uses a global singleton pattern to survive Next.js hot reloads in dev mode.
 */

import NodeCache from "node-cache";
import { v4 as uuid } from "uuid";
import { encryptApiKey, decryptApiKey, isEncryptedApiKey } from "./crypto";

// Default TTL: 24 hours
const DEFAULT_TTL_SECONDS = 60 * 60 * 24;

// Check for expired entries every hour
const CHECK_PERIOD_SECONDS = 60 * 60;

/**
 * Plot configuration structure
 */
export interface PlotConfig {
  type: string; // "scatter" | "bar" | "histogram" | "line"
  xAxis: string; // "table1.field_name"
  yAxis?: string;
  groupBy?: string;
  aggregate?: string;
  scaleX?: string;
  scaleY?: string;
  metric?: string;
  binCount?: number;
  showRegression?: boolean;
  dimensions?: { width: number; height: number };
  margins?: { top: number; right: number; bottom: number; left: number };
  primaryColor?: string;
  colors?: Record<string, string>;
}

/**
 * Project configuration for fetching logs
 * Supports full range of Orchestra logs API parameters
 */
export interface ProjectConfig {
  // Project identification
  project_name: string;

  // Context filtering
  context?: string;
  column_context?: string;

  // Log filtering
  filter_expr?: string;
  from_ids?: string;
  exclude_ids?: string;
  from_fields?: string;
  exclude_fields?: string;

  // Pagination
  limit?: number;
  offset?: number;

  // Grouping
  group_by?: string[];
  group_limit?: number;
  group_offset?: number;
  group_depth?: number;
  groups_only?: boolean;
  nested_groups?: boolean;

  // Sorting
  sorting?: string; // JSON-encoded
  group_sorting?: string; // JSON-encoded

  // Other options
  value_limit?: number;
  randomize?: boolean;
  seed?: string;
}

/**
 * Complete token data stored in cache
 */
export interface PlotTokenData {
  plot_config: PlotConfig;
  project_config: ProjectConfig;
  created_at: string;
  expires_at: string;
  title?: string;
  /** User's API key for fetching logs (encrypted, stored server-side only) */
  api_key?: string;
}

/**
 * Extend globalThis to include our cache
 * This survives Next.js hot reloads in development
 */
const globalForCache = globalThis as unknown as {
  plotTokenCache: NodeCache | undefined;
};

/**
 * Get or create the singleton cache instance
 * Uses globalThis to survive Next.js hot reloads in development
 */
function getCache(): NodeCache {
  if (!globalForCache.plotTokenCache) {
    globalForCache.plotTokenCache = new NodeCache({
      stdTTL: DEFAULT_TTL_SECONDS,
      checkperiod: CHECK_PERIOD_SECONDS,
      useClones: false, // For performance - we don't mutate cached objects
    });
    console.log("[PlotTokenStore] Created new cache instance");
  }
  return globalForCache.plotTokenCache;
}

/**
 * Generate a short, URL-friendly token
 */
function generateToken(): string {
  // Use first 12 chars of UUID for cleaner URLs
  return uuid().replace(/-/g, "").slice(0, 12);
}

/**
 * Store plot configuration and return a token
 *
 * @param plotConfig - Plot rendering configuration
 * @param projectConfig - Project/logs configuration
 * @param ttlSeconds - Time-to-live in seconds (default: 24 hours)
 * @param title - Optional title for the plot
 * @param apiKey - User's API key for fetching logs (will be encrypted)
 * @returns Token string for retrieval
 */
export function storePlotToken(
  plotConfig: PlotConfig,
  projectConfig: ProjectConfig,
  ttlSeconds: number = DEFAULT_TTL_SECONDS,
  title?: string,
  apiKey?: string
): string {
  const cache = getCache();
  const token = generateToken();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + ttlSeconds * 1000);

  const tokenData: PlotTokenData = {
    plot_config: plotConfig,
    project_config: projectConfig,
    created_at: now.toISOString(),
    expires_at: expiresAt.toISOString(),
    title,
    // Encrypt API key before storing
    api_key: apiKey ? encryptApiKey(apiKey) : undefined,
  };

  cache.set(token, tokenData, ttlSeconds);
  console.log(
    `[PlotTokenStore] Stored token: ${token}, cache size: ${cache.keys().length}`
  );

  return token;
}

/**
 * Retrieve plot configuration by token
 * Automatically decrypts the API key if present
 *
 * @param token - The token to look up
 * @returns Token data with decrypted API key, or null if not found/expired
 */
export function getPlotToken(token: string): PlotTokenData | null {
  const cache = getCache();
  const data = cache.get<PlotTokenData>(token);

  console.log(
    `[PlotTokenStore] Get token: ${token}, found: ${!!data}, cache size: ${cache.keys().length}`
  );

  if (!data) {
    return null;
  }

  // Decrypt API key if present and encrypted
  if (data.api_key) {
    try {
      // Check if already encrypted (new format) or plaintext (legacy)
      if (isEncryptedApiKey(data.api_key)) {
        return {
          ...data,
          api_key: decryptApiKey(data.api_key),
        };
      }
      // Legacy plaintext key - return as-is
      return data;
    } catch (error) {
      console.error("[PlotTokenStore] Failed to decrypt API key:", error);
      // Return without API key rather than failing completely
      return {
        ...data,
        api_key: undefined,
      };
    }
  }

  return data;
}

/**
 * Check if a token exists and is valid
 *
 * @param token - The token to check
 * @returns true if token exists and hasn't expired
 */
export function hasPlotToken(token: string): boolean {
  return getCache().has(token);
}

/**
 * Delete a token (for cleanup or invalidation)
 *
 * @param token - The token to delete
 * @returns true if token was deleted, false if it didn't exist
 */
export function deletePlotToken(token: string): boolean {
  return getCache().del(token) > 0;
}

/**
 * Get cache statistics (useful for monitoring)
 */
export function getPlotTokenStats(): NodeCache.Stats {
  return getCache().getStats();
}

/**
 * List all tokens (for debugging)
 */
export function listPlotTokens(): string[] {
  return getCache().keys();
}
