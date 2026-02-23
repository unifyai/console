/**
 * Table Data API Route
 *
 * Fetches table view data for a given token from Orchestra.
 * Uses shared fetchTableData function for core logic.
 */

import { NextRequest, NextResponse } from 'next/server';
import { fetchTableData } from '@/lib/tableData';

const DEFAULT_PAGE_SIZE = 100;
const MAX_PAGE_SIZE = 500;

export async function GET(request: NextRequest, { params }: { params: { token: string } }) {
  // Parse pagination parameters from query string
  const { searchParams } = new URL(request.url);
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
  const pageSize = Math.min(
    MAX_PAGE_SIZE,
    Math.max(1, parseInt(searchParams.get('pageSize') || String(DEFAULT_PAGE_SIZE), 10))
  );

  const result = await fetchTableData(params.token, { page, pageSize });

  if (!result.success) {
    return NextResponse.json(
      { error: result.error.error, expired: result.error.expired },
      { status: result.error.status }
    );
  }

  return NextResponse.json(result.data);
}
