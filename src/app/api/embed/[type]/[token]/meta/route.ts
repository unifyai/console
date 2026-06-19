import { NextRequest, NextResponse } from 'next/server';
import { getApiKeyFromRequest, unauthorized } from '@/app/api/_utils/auth';
import { fetchDashboardData } from '@/lib/dashboardData';
import { fetchTileData } from '@/lib/tileData';
import { fetchPlotData } from '@/lib/plotData';
import { fetchTableData } from '@/lib/tableData';

const VALID_TYPES = new Set(['table', 'plot', 'tile', 'dashboard']);

interface EmbedMeta {
  title: string | null;
  description: string | null;
}

async function resolveEmbedMeta(type: string, token: string): Promise<EmbedMeta | null> {
  switch (type) {
    case 'dashboard': {
      const res = await fetchDashboardData(token);
      if (!res.success) return null;
      return { title: res.data.title, description: res.data.description };
    }
    case 'tile': {
      const res = await fetchTileData(token);
      if (!res.success) return null;
      return { title: res.data.title, description: res.data.description };
    }
    case 'plot': {
      const res = await fetchPlotData(token);
      if (!res.success) return null;
      return { title: res.data.metadata?.title ?? null, description: null };
    }
    case 'table': {
      const res = await fetchTableData(token);
      if (!res.success) return null;
      return { title: res.data.metadata?.title ?? null, description: null };
    }
    default:
      return null;
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ type: string; token: string }> }
) {
  const { type, token } = await params;
  const apiKey = await getApiKeyFromRequest(request);
  if (!apiKey) return unauthorized();

  if (!VALID_TYPES.has(type)) {
    return NextResponse.json({ error: 'Invalid embed type' }, { status: 400 });
  }
  if (!token) {
    return NextResponse.json({ error: 'Missing token' }, { status: 400 });
  }

  const meta = await resolveEmbedMeta(type, token);
  if (!meta) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  return NextResponse.json(meta);
}
