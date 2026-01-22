/**
 * oEmbed API Endpoint
 *
 * Provides oEmbed discovery for table and plot views.
 * This allows platforms like Slack, Discord, and others to
 * fetch rich embed information for our URLs.
 *
 * Uses shared data fetching functions (no HTTP roundtrip).
 *
 * Spec: https://oembed.com/
 */

import { NextRequest, NextResponse } from 'next/server';
import { fetchTableData } from '@/lib/tableData';
import { fetchPlotData } from '@/lib/plotData';

interface OEmbedResponse {
  type: 'rich' | 'photo' | 'video' | 'link';
  version: '1.0';
  title?: string;
  author_name?: string;
  author_url?: string;
  provider_name: string;
  provider_url: string;
  cache_age?: number;
  thumbnail_url?: string;
  thumbnail_width?: number;
  thumbnail_height?: number;
  // Rich type specific
  html?: string;
  width?: number;
  height?: number;
}

/**
 * Parse URL to extract type and token
 */
function parseUrl(url: string): { type: 'table' | 'plot'; token: string } | null {
  try {
    const urlObj = new URL(url);
    const pathname = urlObj.pathname;

    // Match /table/view/{token}
    const tableMatch = pathname.match(/^\/table\/view\/([a-zA-Z0-9_-]+)$/);
    if (tableMatch) {
      return { type: 'table', token: tableMatch[1] };
    }

    // Match /plot/view/{token}
    const plotMatch = pathname.match(/^\/plot\/view\/([a-zA-Z0-9_-]+)$/);
    if (plotMatch) {
      return { type: 'plot', token: plotMatch[1] };
    }

    return null;
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const url = searchParams.get('url');
  const format = searchParams.get('format') || 'json';
  const maxWidth = parseInt(searchParams.get('maxwidth') || '800', 10);
  const maxHeight = parseInt(searchParams.get('maxheight') || '600', 10);

  // Validate format
  if (format !== 'json' && format !== 'xml') {
    return NextResponse.json({ error: 'Invalid format' }, { status: 400 });
  }

  // Validate URL
  if (!url) {
    return NextResponse.json({ error: 'Missing url parameter' }, { status: 400 });
  }

  const parsed = parseUrl(url);
  if (!parsed) {
    return NextResponse.json({ error: 'URL not supported' }, { status: 404 });
  }

  // Derive baseUrl from the incoming request for thumbnail URLs
  const host = request.headers.get('host') || request.headers.get('x-forwarded-host');
  const protocol = request.headers.get('x-forwarded-proto') || 'https';
  const baseUrl = host
    ? `${protocol}://${host}`
    : process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || 'https://console.unify.ai';

  // Fetch metadata based on type using shared functions (no HTTP roundtrip)
  let title: string;

  if (parsed.type === 'table') {
    const result = await fetchTableData(parsed.token, { page: 1, pageSize: 1 });
    if (!result.success) {
      return NextResponse.json({ error: 'Table not found' }, { status: 404 });
    }
    title = result.data.metadata?.title || 'Table View';
  } else {
    const result = await fetchPlotData(parsed.token);
    if (!result.success) {
      return NextResponse.json({ error: 'Plot not found' }, { status: 404 });
    }
    title = result.data.metadata?.title || result.data.config?.title || 'Plot View';
  }

  // Calculate dimensions (maintain 16:9 aspect ratio)
  const width = Math.min(maxWidth, 800);
  const height = Math.min(maxHeight, Math.round((width * 9) / 16));

  // Build oEmbed response
  const response: OEmbedResponse = {
    type: 'rich',
    version: '1.0',
    title,
    provider_name: 'Unify Console',
    provider_url: baseUrl,
    cache_age: 3600, // 1 hour
    thumbnail_url: `${baseUrl}/api/og/${parsed.type}/${parsed.token}.png`,
    thumbnail_width: 1200,
    thumbnail_height: 630,
    width,
    height,
    html: `<iframe src="${url}" width="${width}" height="${height}" frameborder="0" allowfullscreen sandbox="allow-scripts allow-same-origin allow-popups" title="${title}"></iframe>`,
  };

  // Return JSON (XML support can be added if needed)
  if (format === 'xml') {
    // Basic XML response
    const xml = `<?xml version="1.0" encoding="utf-8"?>
<oembed>
  <type>${response.type}</type>
  <version>${response.version}</version>
  <title>${escapeXml(response.title || '')}</title>
  <provider_name>${escapeXml(response.provider_name)}</provider_name>
  <provider_url>${escapeXml(response.provider_url)}</provider_url>
  <cache_age>${response.cache_age}</cache_age>
  <thumbnail_url>${escapeXml(response.thumbnail_url || '')}</thumbnail_url>
  <thumbnail_width>${response.thumbnail_width}</thumbnail_width>
  <thumbnail_height>${response.thumbnail_height}</thumbnail_height>
  <width>${response.width}</width>
  <height>${response.height}</height>
  <html>${escapeXml(response.html || '')}</html>
</oembed>`;

    return new NextResponse(xml, {
      headers: {
        'Content-Type': 'text/xml; charset=utf-8',
      },
    });
  }

  return NextResponse.json(response);
}

/**
 * Escape special characters for XML
 */
function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
