import { NextResponse } from 'next/server';

// Voice design preview will be available soon
export async function POST() {
  return NextResponse.json({ detail: 'Voice design will be available soon.' }, { status: 503 });
}
