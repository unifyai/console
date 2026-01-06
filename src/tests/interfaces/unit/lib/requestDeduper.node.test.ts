/**
 * Tests for request deduplication utility (dedupedJson)
 * 
 * Covers:
 * - Concurrent requests for same URL are coalesced into single fetch
 * - Different URLs are fetched independently
 * - Different HTTP methods are not coalesced
 * - Error responses are handled correctly
 * - In-flight request cleanup after completion
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { dedupedJson } from '@/lib/requestDeduper';

describe('dedupedJson - request coalescing', () => {
  const mockFetch = vi.fn();

  beforeEach(() => {
    mockFetch.mockReset();
    vi.stubGlobal('fetch', mockFetch);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('coalesces concurrent identical requests into a single fetch', async () => {
    const responseData = { fields: ['field1', 'field2'] };
    
    // Slow response to ensure requests overlap
    mockFetch.mockImplementation(async () => {
      await new Promise(resolve => setTimeout(resolve, 50));
      return new Response(JSON.stringify(responseData), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    });

    const url = '/api/logs/fields?project_name=test&context=ctx';
    
    // Fire 3 concurrent requests for same URL
    const [result1, result2, result3] = await Promise.all([
      dedupedJson(url),
      dedupedJson(url),
      dedupedJson(url),
    ]);

    // All should get same result
    expect(result1.json).toEqual(responseData);
    expect(result2.json).toEqual(responseData);
    expect(result3.json).toEqual(responseData);
    expect(result1.ok).toBe(true);
    expect(result1.status).toBe(200);

    // But fetch should only be called ONCE
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(mockFetch).toHaveBeenCalledWith(url, undefined);
  });

  it('does NOT coalesce requests for different URLs', async () => {
    mockFetch.mockImplementation(async (url: string) => {
      await new Promise(resolve => setTimeout(resolve, 20));
      const data = url.includes('ctx1') ? { context: 'ctx1' } : { context: 'ctx2' };
      return new Response(JSON.stringify(data), { status: 200 });
    });

    const url1 = '/api/logs/fields?project_name=test&context=ctx1';
    const url2 = '/api/logs/fields?project_name=test&context=ctx2';

    const [result1, result2] = await Promise.all([
      dedupedJson(url1),
      dedupedJson(url2),
    ]);

    expect(result1.json).toEqual({ context: 'ctx1' });
    expect(result2.json).toEqual({ context: 'ctx2' });

    // Should have 2 separate fetch calls
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('does NOT coalesce requests with different HTTP methods', async () => {
    mockFetch.mockImplementation(async () => {
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    });

    const url = '/api/logs/fields?project_name=test';

    const [getResult, postResult] = await Promise.all([
      dedupedJson(url, { method: 'GET' }),
      dedupedJson(url, { method: 'POST' }),
    ]);

    expect(getResult.ok).toBe(true);
    expect(postResult.ok).toBe(true);

    // Should have 2 separate fetch calls (GET and POST)
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('handles 404 responses correctly', async () => {
    mockFetch.mockResolvedValue(
      new Response(JSON.stringify({ detail: 'Not found' }), { status: 404 })
    );

    const result = await dedupedJson('/api/logs/fields?project_name=test&context=missing');

    expect(result.ok).toBe(false);
    expect(result.status).toBe(404);
    expect(result.json).toEqual({ detail: 'Not found' });
  });

  it('handles 500 error responses correctly', async () => {
    mockFetch.mockResolvedValue(
      new Response(JSON.stringify({ error: 'Server error' }), { status: 500 })
    );

    const result = await dedupedJson('/api/logs/fields?project_name=test');

    expect(result.ok).toBe(false);
    expect(result.status).toBe(500);
    expect(result.json).toEqual({ error: 'Server error' });
  });

  it('captures ETag and Last-Modified headers when present', async () => {
    mockFetch.mockResolvedValue(
      new Response(JSON.stringify({ data: 'test' }), {
        status: 200,
        headers: {
          'ETag': '"abc123"',
          'Last-Modified': 'Wed, 21 Oct 2024 07:28:00 GMT',
        },
      })
    );

    const result = await dedupedJson('/api/logs/fields?project_name=test');

    expect(result.headers['etag']).toBe('"abc123"');
    expect(result.headers['last-modified']).toBe('Wed, 21 Oct 2024 07:28:00 GMT');
  });

  it('cleans up in-flight request after completion (allows re-fetch)', async () => {
    let callCount = 0;
    mockFetch.mockImplementation(async () => {
      callCount++;
      return new Response(JSON.stringify({ call: callCount }), { status: 200 });
    });

    const url = '/api/logs/fields?project_name=test';

    // First request
    const result1 = await dedupedJson(url);
    expect(result1.json).toEqual({ call: 1 });

    // Second request (after first completes) should trigger new fetch
    const result2 = await dedupedJson(url);
    expect(result2.json).toEqual({ call: 2 });

    // Should have 2 separate fetch calls (not coalesced because sequential)
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('cleans up in-flight request even when fetch fails', async () => {
    let callCount = 0;
    mockFetch.mockImplementation(async () => {
      callCount++;
      if (callCount === 1) {
        throw new Error('Network error');
      }
      return new Response(JSON.stringify({ success: true }), { status: 200 });
    });

    const url = '/api/logs/fields?project_name=test';

    // First request fails
    await expect(dedupedJson(url)).rejects.toThrow('Network error');

    // Second request should work (in-flight was cleaned up)
    const result = await dedupedJson(url);
    expect(result.ok).toBe(true);
    expect(result.json).toEqual({ success: true });

    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('handles 304 Not Modified (no body parsing)', async () => {
    mockFetch.mockResolvedValue(
      new Response(null, { status: 304 })
    );

    const result = await dedupedJson('/api/logs/fields?project_name=test');

    expect(result.status).toBe(304);
    expect(result.json).toBeNull();
  });

  it('handles malformed JSON gracefully', async () => {
    mockFetch.mockResolvedValue(
      new Response('not valid json', { status: 200 })
    );

    const result = await dedupedJson('/api/logs/fields?project_name=test');

    expect(result.status).toBe(200);
    expect(result.ok).toBe(true);
    expect(result.json).toBeNull();
  });
});

describe('dedupedJson - real-world scenarios', () => {
  const mockFetch = vi.fn();

  beforeEach(() => {
    mockFetch.mockReset();
    vi.stubGlobal('fetch', mockFetch);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('simulates multiple tiles requesting same context fields concurrently', async () => {
    const fieldsResponse = {
      input: { field_type: 'entry', index: 0 },
      output: { field_type: 'entry', index: 1 },
      metadata: { field_type: 'entry', index: 2 },
    };

    mockFetch.mockImplementation(async () => {
      await new Promise(resolve => setTimeout(resolve, 30));
      return new Response(JSON.stringify(fieldsResponse), { status: 200 });
    });

    const url = '/api/logs/fields?project_name=Assistants&context=User%2FConversations';

    // Simulate 5 tiles all requesting the same context's fields at once
    const results = await Promise.all([
      dedupedJson(url), // Tile 0
      dedupedJson(url), // Tile 1
      dedupedJson(url), // Tile 2
      dedupedJson(url), // Tile 3
      dedupedJson(url), // Tile 4
    ]);

    // All tiles get the same data
    for (const result of results) {
      expect(result.json).toEqual(fieldsResponse);
      expect(result.ok).toBe(true);
    }

    // Only 1 network request was made!
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('simulates multiple tabs with different contexts - no coalescing', async () => {
    mockFetch.mockImplementation(async (url: string) => {
      await new Promise(resolve => setTimeout(resolve, 20));
      const context = url.includes('ctx1') ? 'ctx1' : url.includes('ctx2') ? 'ctx2' : 'ctx3';
      return new Response(JSON.stringify({ context }), { status: 200 });
    });

    // Different contexts = different requests
    const results = await Promise.all([
      dedupedJson('/api/logs/fields?project_name=P&context=ctx1'),
      dedupedJson('/api/logs/fields?project_name=P&context=ctx2'),
      dedupedJson('/api/logs/fields?project_name=P&context=ctx3'),
    ]);

    expect(results[0].json.context).toBe('ctx1');
    expect(results[1].json.context).toBe('ctx2');
    expect(results[2].json.context).toBe('ctx3');

    // 3 different requests
    expect(mockFetch).toHaveBeenCalledTimes(3);
  });
});

