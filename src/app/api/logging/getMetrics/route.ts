import {
  CallsDataProps,
  TokensDataProps,
  LatencyDataProps,
  ThroughputDataProps,
} from '@/types/usage';
import { getQueryMetrics, MetricItem } from '@/lib/unify-api/logging/metric';
import { NextRequest, NextResponse } from 'next/server';
import { getApiKeyFromRequest, unauthorized } from '../../_utils/auth';

export async function GET(req: NextRequest): Promise<NextResponse> {
  const apiKey = await getApiKeyFromRequest(req);
  if (!apiKey) {
    return unauthorized();
  }

  try {
    const url = new URL(req.url);
    const startTime = url.searchParams.get('startTime') || undefined;
    const endTime = url.searchParams.get('endTime') || undefined;
    const models = url.searchParams.get('models') || undefined;
    const providers = url.searchParams.get('providers') || undefined;
    const interval = url.searchParams.get('interval') || '300';
    const secondaryUserId = url.searchParams.get('secondaryUserId') || undefined;

    const metrics = await getQueryMetrics(
      apiKey,
      startTime,
      endTime,
      models,
      providers,
      interval,
      secondaryUserId
    );

    const formattedMetrics = metrics.map((item: MetricItem) => ({
      tokenData: {
        ts: item.timeBin,
        totalCompletionTokens: item.totalCompletionTokens,
        totalPromptTokens: item.totalPromptTokens,
      } as TokensDataProps,
      callsData: {
        ts: item.timeBin,
        requestCount: item.requestCount,
      } as CallsDataProps,
      latencyData: {
        ts: item.timeBin,
        generationTimeP50: item.generationTimeP50,
        generationTimeP95: item.generationTimeP95,
      } as LatencyDataProps,
      throughputData: {
        ts: item.timeBin,
        tokensPerSecP50: item.tokensPerSecP50,
        tokensPerSecP95: item.tokensPerSecP95,
      } as ThroughputDataProps,
    }));

    const calls = formattedMetrics.map((item) => item.callsData);
    const tokens = formattedMetrics.map((item) => item.tokenData);
    const latency = formattedMetrics.map((item) => item.latencyData);
    const throughput = formattedMetrics.map((item) => item.throughputData);

    return NextResponse.json({ calls, tokens, latency, throughput });
  } catch (error) {
    console.error('Error fetching metrics:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch metrics',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
