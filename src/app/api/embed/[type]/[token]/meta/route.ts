import { NextRequest, NextResponse } from 'next/server';
import { getApiKeyFromRequest, unauthorized } from '@/app/api/_utils/auth';
import { authorizeCanvasRead } from '@/lib/canvas/canvasAccess';
import { fetchCanvasSummary } from '@/lib/canvas/canvasRecord';
import { fetchPlotData } from '@/lib/plotData';
import { fetchTableData } from '@/lib/tableData';

const VALID_TYPES = new Set(['table', 'plot', 'canvas']);

interface EmbedMeta {
  title: string | null;
  description: string | null;
}

async function resolveEmbedMeta(
  request: NextRequest,
  type: string,
  token: string
): Promise<EmbedMeta | null> {
  switch (type) {
    case 'canvas': {
      // A canvas caption goes through the canvas authorization path rather than
      // the session check above. Holding a token is not permission to read a
      // private canvas, and a title is exactly the sort of thing that would leak
      // if this reused the other types' token-is-access model.
      const access = await authorizeCanvasRead(request, token);
      if (!access.ok) return null;
      const summary = await fetchCanvasSummary(access.resolution, token);
      if (!summary.ok) return null;
      return { title: summary.summary.title, description: summary.summary.description };
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

  const meta = await resolveEmbedMeta(request, type, token);
  if (!meta) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  return NextResponse.json(meta);
}
