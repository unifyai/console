import { describe, it, expect, afterEach } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '@/tests/server';
import { NextRequest } from 'next/server';
import { GET } from '@/app/api/geo/country/route';

const IPAPI_URL = 'https://ipapi.co';

function makeRequest(forwardedFor?: string): NextRequest {
  const headers = new Headers();
  if (forwardedFor) headers.set('x-forwarded-for', forwardedFor);
  return new NextRequest('http://localhost:3000/api/geo/country', { headers });
}

describe('GET /api/geo/country', () => {
  afterEach(() => {
    server.resetHandlers();
  });

  it('returns country code for a valid public IP', async () => {
    server.use(
      http.get(`${IPAPI_URL}/203.0.113.1/country/`, () => {
        return new HttpResponse('GB', { status: 200 });
      })
    );

    const response = await GET(makeRequest('203.0.113.1'));
    const data = await response.json();
    expect(data).toEqual({ country: 'GB' });
  });

  it('returns null when no x-forwarded-for header is present', async () => {
    const response = await GET(makeRequest());
    const data = await response.json();
    expect(data).toEqual({ country: null });
  });

  it('returns null for localhost IP', async () => {
    const response = await GET(makeRequest('127.0.0.1'));
    const data = await response.json();
    expect(data).toEqual({ country: null });
  });

  it('returns null for IPv6 loopback', async () => {
    const response = await GET(makeRequest('::1'));
    const data = await response.json();
    expect(data).toEqual({ country: null });
  });

  it('uses the first IP from a comma-separated x-forwarded-for chain', async () => {
    server.use(
      http.get(`${IPAPI_URL}/198.51.100.42/country/`, () => {
        return new HttpResponse('DE', { status: 200 });
      })
    );

    const response = await GET(makeRequest('198.51.100.42, 10.0.0.1'));
    const data = await response.json();
    expect(data).toEqual({ country: 'DE' });
  });

  it('returns null when ipapi returns an error status', async () => {
    server.use(
      http.get(`${IPAPI_URL}/203.0.113.1/country/`, () => {
        return new HttpResponse(null, { status: 429 });
      })
    );

    const response = await GET(makeRequest('203.0.113.1'));
    const data = await response.json();
    expect(data).toEqual({ country: null });
  });

  it('returns null when ipapi returns an invalid body', async () => {
    server.use(
      http.get(`${IPAPI_URL}/203.0.113.1/country/`, () => {
        return new HttpResponse('Undefined', { status: 200 });
      })
    );

    const response = await GET(makeRequest('203.0.113.1'));
    const data = await response.json();
    expect(data).toEqual({ country: null });
  });
});
