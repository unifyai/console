import { NextResponse } from 'next/server';

// Voice cloning will be available soon
export async function POST() {
  return NextResponse.json(
    { detail: 'Voice cloning will be available soon.' },
    { status: 503 }
  );
}
