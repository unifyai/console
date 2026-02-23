/**
 * MSW Handlers for Usage API
 *
 * Mock Service Worker handlers for testing the usage API layer.
 */

import { http, HttpResponse } from 'msw';
import { SAMPLE_WEEK_RESPONSE, SAMPLE_HOURLY_RESPONSE, createMockMetricsResponse } from './data';
import { TimeGranularity } from '@/types/usage';

/**
 * Create a successful metrics response handler.
 */
export function createMetricsSuccessHandler(customResponse?: Record<string, { sum: number }>) {
  return http.get('*/api/logs/sum', ({ request }) => {
    const url = new URL(request.url);
    const groupBy = url.searchParams.get('groupBy') as TimeGranularity;

    // Return custom response if provided
    if (customResponse) {
      return HttpResponse.json(customResponse);
    }

    // Return appropriate sample data based on granularity
    if (groupBy === 'time_hour') {
      return HttpResponse.json(SAMPLE_HOURLY_RESPONSE);
    }

    return HttpResponse.json(SAMPLE_WEEK_RESPONSE);
  });
}

/**
 * Create an error response handler.
 */
export function createMetricsErrorHandler(statusCode: number, detail: string) {
  return http.get('*/api/logs/sum', () => {
    return HttpResponse.json({ detail }, { status: statusCode });
  });
}

/**
 * Create a network error handler.
 */
export function createMetricsNetworkErrorHandler() {
  return http.get('*/api/logs/sum', () => {
    return HttpResponse.error();
  });
}

/**
 * Create a delayed response handler for testing loading states.
 */
export function createMetricsDelayedHandler(delayMs: number) {
  return http.get('*/api/logs/sum', async () => {
    await new Promise((resolve) => setTimeout(resolve, delayMs));
    return HttpResponse.json(SAMPLE_WEEK_RESPONSE);
  });
}

/**
 * Create a handler that returns empty data.
 */
export function createMetricsEmptyHandler() {
  return http.get('*/api/logs/sum', () => {
    return HttpResponse.json({});
  });
}

/**
 * Create a dynamic handler that generates data based on request params.
 */
export function createMetricsDynamicHandler() {
  return http.get('*/api/logs/sum', ({ request }) => {
    const url = new URL(request.url);
    const filterExpr = url.searchParams.get('filterExpr') || '';
    const groupBy = (url.searchParams.get('groupBy') as TimeGranularity) || 'time_day';

    // Parse date range from filter expression
    const startMatch = filterExpr.match(/event_timestamp >= '(\d{4}-\d{2}-\d{2})'/);
    const startDate = startMatch ? startMatch[1] : '2026-01-01';

    // Generate mock data
    const response = createMockMetricsResponse({
      count: 7,
      startDate,
      granularity: groupBy,
      seed: 42,
    });

    return HttpResponse.json(response);
  });
}

/**
 * Default handlers for usage API
 */
export const usageHandlers = [createMetricsSuccessHandler()];

/**
 * Handler configurations for different test scenarios
 */
export const usageHandlerScenarios = {
  success: createMetricsSuccessHandler,
  error: createMetricsErrorHandler,
  networkError: createMetricsNetworkErrorHandler,
  delayed: createMetricsDelayedHandler,
  empty: createMetricsEmptyHandler,
  dynamic: createMetricsDynamicHandler,
};
