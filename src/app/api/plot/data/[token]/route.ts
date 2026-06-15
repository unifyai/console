/**
 * Plot Data API Route
 *
 * Fetches plot data for a given token from Orchestra.
 * Uses shared fetchPlotData function for core logic.
 */

import { NextRequest, NextResponse } from 'next/server';
import { fetchPlotData } from '@/lib/plotData';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const result = await fetchPlotData(token);

  if (!result.success) {
    return NextResponse.json(
      { error: result.error.error, expired: result.error.expired },
      { status: result.error.status }
    );
  }

  return NextResponse.json(result.data);
}
