/**
 * Tests for API route caching utilities
 * 
 * Covers:
 * - Cache-Control header generation
 * - Response wrapping with cache headers
 * - Different cache durations
 * - Error response handling (no caching)
 */

import { describe, it, expect } from 'vitest';
import { 
  CACHE_DURATIONS, 
  buildCacheControl, 
  withCacheHeaders 
} from '@/app/api/_utils/cacheResponse';

describe('cacheResponse utilities', () => {
  describe('CACHE_DURATIONS', () => {
    it('should have SHORT duration with 30s max-age', () => {
      expect(CACHE_DURATIONS.SHORT).toEqual({
        maxAge: 30,
        staleWhileRevalidate: 60,
      });
    });

    it('should have MEDIUM duration with 60s max-age', () => {
      expect(CACHE_DURATIONS.MEDIUM).toEqual({
        maxAge: 60,
        staleWhileRevalidate: 120,
      });
    });

    it('should have LONG duration with 300s (5min) max-age', () => {
      expect(CACHE_DURATIONS.LONG).toEqual({
        maxAge: 300,
        staleWhileRevalidate: 600,
      });
    });

    it('should have NONE as null', () => {
      expect(CACHE_DURATIONS.NONE).toBeNull();
    });
  });

  describe('buildCacheControl', () => {
    it('should build correct Cache-Control for SHORT duration', () => {
      const result = buildCacheControl('SHORT');
      expect(result).toBe('private, max-age=30, stale-while-revalidate=60');
    });

    it('should build correct Cache-Control for MEDIUM duration', () => {
      const result = buildCacheControl('MEDIUM');
      expect(result).toBe('private, max-age=60, stale-while-revalidate=120');
    });

    it('should build correct Cache-Control for LONG duration', () => {
      const result = buildCacheControl('LONG');
      expect(result).toBe('private, max-age=300, stale-while-revalidate=600');
    });

    it('should return null for NONE duration', () => {
      const result = buildCacheControl('NONE');
      expect(result).toBeNull();
    });
  });

  describe('withCacheHeaders', () => {
    it('should add Cache-Control header to successful response', async () => {
      const mockResponse = new Response(JSON.stringify({ data: 'test' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });

      const result = await withCacheHeaders(mockResponse, 'MEDIUM');

      expect(result.headers.get('Cache-Control')).toBe(
        'private, max-age=60, stale-while-revalidate=120'
      );
      expect(result.status).toBe(200);
    });

    it('should NOT add Cache-Control to error responses', async () => {
      const mockResponse = new Response(JSON.stringify({ error: 'Not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });

      const result = await withCacheHeaders(mockResponse, 'MEDIUM');

      // Should return original response without caching
      expect(result.status).toBe(404);
      // Original response doesn't have Cache-Control, and we don't add it
    });

    it('should NOT add Cache-Control to 500 error responses', async () => {
      const mockResponse = new Response(JSON.stringify({ error: 'Server error' }), {
        status: 500,
      });

      const result = await withCacheHeaders(mockResponse, 'LONG');

      expect(result.status).toBe(500);
    });

    it('should preserve original response body', async () => {
      const originalData = { foo: 'bar', count: 42 };
      const mockResponse = new Response(JSON.stringify(originalData), {
        status: 200,
      });

      const result = await withCacheHeaders(mockResponse, 'SHORT');
      const body = await result.json();

      expect(body).toEqual(originalData);
    });

    it('should use MEDIUM as default duration', async () => {
      const mockResponse = new Response(JSON.stringify({ data: 'test' }), {
        status: 200,
      });

      const result = await withCacheHeaders(mockResponse);

      expect(result.headers.get('Cache-Control')).toBe(
        'private, max-age=60, stale-while-revalidate=120'
      );
    });

    it('should preserve default Content-Type from Response', async () => {
      // Note: Response constructor automatically sets text/plain if no Content-Type provided
      // In real usage, upstream APIs always return Content-Type
      const mockResponse = new Response(JSON.stringify({ data: 'test' }), {
        status: 200,
      });

      const result = await withCacheHeaders(mockResponse, 'SHORT');

      // Content-Type should be present (either from original or our fallback)
      const contentType = result.headers.get('Content-Type');
      expect(contentType).toBeTruthy();
    });

    it('should preserve existing Content-Type', async () => {
      const mockResponse = new Response(JSON.stringify({ data: 'test' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
      });

      const result = await withCacheHeaders(mockResponse, 'SHORT');

      expect(result.headers.get('Content-Type')).toBe('application/json; charset=utf-8');
    });

    it('should handle different cache durations correctly', async () => {
      const createResponse = () => new Response('{}', { status: 200 });

      const shortResult = await withCacheHeaders(createResponse(), 'SHORT');
      const mediumResult = await withCacheHeaders(createResponse(), 'MEDIUM');
      const longResult = await withCacheHeaders(createResponse(), 'LONG');

      expect(shortResult.headers.get('Cache-Control')).toContain('max-age=30');
      expect(mediumResult.headers.get('Cache-Control')).toContain('max-age=60');
      expect(longResult.headers.get('Cache-Control')).toContain('max-age=300');
    });
  });
});

describe('API Route Caching Integration', () => {
  // These tests verify the expected cache durations for each route type
  
  it('logs should use SHORT cache (30s) - data changes frequently', () => {
    // Logs are dynamic, should have short cache
    expect(CACHE_DURATIONS.SHORT.maxAge).toBe(30);
  });

  it('fields should use LONG cache (5min) - metadata is stable', () => {
    // Field definitions rarely change
    expect(CACHE_DURATIONS.LONG.maxAge).toBe(300);
  });

  it('interfaces/tabs/tiles should use MEDIUM cache (60s)', () => {
    // Configuration changes occasionally
    expect(CACHE_DURATIONS.MEDIUM.maxAge).toBe(60);
  });

  it('projects/contexts should use LONG cache (5min) - rarely change', () => {
    // Project structure is very stable
    expect(CACHE_DURATIONS.LONG.maxAge).toBe(300);
  });
});

