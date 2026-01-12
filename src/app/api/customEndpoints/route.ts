/**
 * ⚠️ DEPRECATED: Orchestra removed custom endpoints functionality
 * - Orchestra commit 52d29237 (Jan 7, 2026): "removed custom endpoints and api keys"
 * - Deleted Orchestra endpoint: /v0/custom_endpoint
 * - These routes will return 404 from Orchestra until the functionality is restored
 */
import { NextRequest, NextResponse } from 'next/server';
import { transformQueryParams } from '../_utils/casingTransform';
import { getApiKeyFromRequest, unauthorized } from '../_utils/auth';
import { snakeToCamelObject } from '@/utils/casing';

const baseUrl = `${process.env.ORCHESTRA_URL}/v0`;

export async function POST(request: NextRequest) {
  const apiKey = await getApiKeyFromRequest(request);
  if (!apiKey) {
    return unauthorized();
  }

  const url = new URL(request.url);
  const snakeQuery = transformQueryParams(url);

  const res = await fetch(`${baseUrl}/custom_endpoint${snakeQuery}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
  });

  // Parse and transform response from snake_case to camelCase
  const text = await res.text();
  if (!text) {
    return NextResponse.json({ success: true }, { status: res.status });
  }
  const responseData = JSON.parse(text);
  const camelCaseData = snakeToCamelObject(responseData);

  return NextResponse.json(camelCaseData, { status: res.status });
}

export async function DELETE(request: NextRequest) {
  const apiKey = await getApiKeyFromRequest(request);
  if (!apiKey) {
    return unauthorized();
  }

  const url = new URL(request.url);
  const snakeQuery = transformQueryParams(url);

  const res = await fetch(`${baseUrl}/custom_endpoint${snakeQuery}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
  });

  // Parse and transform response from snake_case to camelCase
  const text = await res.text();
  if (!text) {
    return NextResponse.json({ success: true }, { status: res.status });
  }
  const responseData = JSON.parse(text);
  const camelCaseData = snakeToCamelObject(responseData);

  return NextResponse.json(camelCaseData, { status: res.status });
}
