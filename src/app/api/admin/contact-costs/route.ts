import { NextRequest, NextResponse } from 'next/server';
import { AxiosError } from 'axios';
import { OrchestraAdminClient } from '@/lib/orchestra/orchestra-client';

/**
 * GET /api/admin/contact-costs
 *
 * Proxies to: GET /v0/admin/billing/contact-costs
 *
 * Returns every row from the `contact_type_costs` table so the frontend
 * can display accurate monthly/one-time costs in the contact creation UI.
 *
 * Uses OrchestraAdminClient which automatically handles:
 *   - Authentication via ORCHESTRA_ADMIN_KEY
 *   - snake_case ↔ camelCase transformation
 */
export async function GET(_request: NextRequest) {
  try {
    const response = await OrchestraAdminClient.get('/billing/contact-costs');

    // Response data is already transformed to camelCase by the client interceptor
    return NextResponse.json(response.data, { status: response.status });
  } catch (error) {
    if (error instanceof AxiosError) {
      if (error.response) {
        console.warn(
          `[API admin/contact-costs] Backend error ${error.response.status}:`,
          error.response.data
        );
        return NextResponse.json(error.response.data, { status: error.response.status });
      }
      console.error('[API admin/contact-costs] Network error:', error.message);
    } else {
      console.error('[API admin/contact-costs] Error:', error);
    }
    return NextResponse.json(
      { detail: 'Failed to connect to backend service' },
      { status: 500 }
    );
  }
}
