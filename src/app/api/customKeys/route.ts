/**
 * ⚠️ DEPRECATED: Orchestra removed custom API keys endpoints
 * - Orchestra commit 52d29237 (Jan 7, 2026): "removed custom endpoints and api keys"
 * - Deleted Orchestra endpoint: /v0/custom_api_key
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

  const res = await fetch(`${baseUrl}/custom_api_key${snakeQuery}`, {
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

export async function GET(request: NextRequest) {
  const apiKey = await getApiKeyFromRequest(request);
  if (!apiKey) {
    return unauthorized();
  }

  const url = new URL(request.url);
  const snakeQuery = transformQueryParams(url);

  const res = await fetch(`${baseUrl}/custom_api_key${snakeQuery}`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
  });

  // Parse and transform response from snake_case to camelCase
  const responseData = await res.json();
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

  const res = await fetch(`${baseUrl}/custom_api_key${snakeQuery}`, {
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
