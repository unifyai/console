/**
 * Mock data for testing inline table/plot embeds in assistant chat.
 *
 * When USE_MOCK_EMBEDS is true:
 * - Mock assistant messages with table/plot URLs appear in chat panels
 * - The table/plot data fetchers return pre-built mock data for the mock tokens
 *   (no backend needed -- both iframe embeds and new-tab navigation work)
 *
 * Set USE_MOCK_EMBEDS to true, then open any assistant chat to see the embeds.
 */

import type { ChatMessage } from '@/types/assistants/chat';
import { mockSimulationEnabled } from '@/lib/simulation/config';

// =============================================================================
// Configuration
// =============================================================================

/** Enable mock embed mode - injects table/plot sample messages into chat panels. */
export const USE_MOCK_EMBEDS = mockSimulationEnabled();

/** 12-hex-char tokens that pass the /^[a-f0-9]{12}$/ validation in fetchTableData / fetchPlotData */
export const MOCK_TABLE_TOKEN = 'aabb00112233';
export const MOCK_PLOT_TOKEN = 'ccdd44556677';

// =============================================================================
// Mock Chat Messages
// =============================================================================

function getBaseUrl(): string {
  if (typeof window !== 'undefined') {
    return window.location.origin;
  }
  return 'http://localhost:3000';
}

export function getMockEmbedMessages(): ChatMessage[] {
  const base = getBaseUrl();
  return [
    {
      id: 'mock-embed-1',
      role: 'assistant',
      content: `I've analysed the data and generated a table view for you:\n\n${base}/table/view/${MOCK_TABLE_TOKEN}\n\nThis shows the top entries sorted by score. You can expand it to interact with the table.`,
      timestamp: new Date(Date.now() - 120_000),
    },
    {
      id: 'mock-embed-2',
      role: 'assistant',
      content: `Here's a plot visualising the distribution:\n\n${base}/plot/view/${MOCK_PLOT_TOKEN}\n\nThe chart shows the breakdown by category. Click expand for the full interactive view.`,
      timestamp: new Date(Date.now() - 60_000),
    },
    {
      id: 'mock-embed-3',
      role: 'assistant',
      content: `And here's a combined response with both:\n\nTable: ${base}/table/view/${MOCK_TABLE_TOKEN}\n\nPlot: ${base}/plot/view/${MOCK_PLOT_TOKEN}\n\nBoth are fully interactive once expanded.`,
      timestamp: new Date(Date.now() - 30_000),
    },
  ];
}

// =============================================================================
// Mock Table Data
// Property names like _id, _ts, latency_ms, tokens_used mirror the backend schema.
// =============================================================================

/* eslint-disable @typescript-eslint/naming-convention */
export function getMockTableData() {
  const now = new Date().toISOString();
  return {
    config: {
      visibleColumns: [
        '_id',
        '_ts',
        'model',
        'prompt',
        'response',
        'score',
        'latency_ms',
        'tokens_used',
        'status',
        'tags',
      ],
      columnOrder: [
        '_id',
        '_ts',
        'model',
        'prompt',
        'response',
        'score',
        'latency_ms',
        'tokens_used',
        'status',
        'tags',
      ],
    },
    data: [
      {
        _id: 1001,
        _ts: '2026-03-05T10:23:01Z',
        model: 'gpt-4o',
        prompt: 'Explain quantum entanglement in simple terms',
        response: 'Quantum entanglement is when two particles become linked...',
        score: 0.94,
        latency_ms: 1230,
        tokens_used: 312,
        status: 'success',
        tags: ['physics', 'explanation'],
      },
      {
        _id: 1002,
        _ts: '2026-03-05T10:24:15Z',
        model: 'claude-3.5-sonnet',
        prompt: 'Write a SQL query to find duplicate rows',
        response: 'SELECT col, COUNT(*) FROM table GROUP BY col HAVING COUNT(*) > 1',
        score: 0.88,
        latency_ms: 890,
        tokens_used: 198,
        status: 'success',
        tags: ['sql', 'database'],
      },
      {
        _id: 1003,
        _ts: '2026-03-05T10:25:33Z',
        model: 'gpt-4o',
        prompt: 'Summarize the key points of reinforcement learning',
        response: 'Reinforcement learning involves an agent learning through trial and error...',
        score: 0.91,
        latency_ms: 1540,
        tokens_used: 427,
        status: 'success',
        tags: ['ml', 'summary'],
      },
      {
        _id: 1004,
        _ts: '2026-03-05T10:26:42Z',
        model: 'gemini-2.0-flash',
        prompt: 'Convert this JSON to a TypeScript interface',
        response: 'interface User { id: number; name: string; email: string; }',
        score: 0.85,
        latency_ms: 670,
        tokens_used: 156,
        status: 'success',
        tags: ['typescript', 'conversion'],
      },
      {
        _id: 1005,
        _ts: '2026-03-05T10:28:01Z',
        model: 'claude-3.5-sonnet',
        prompt: 'What are the SOLID principles?',
        response: 'SOLID stands for: Single Responsibility, Open/Closed, Liskov Substitution...',
        score: 0.96,
        latency_ms: 1100,
        tokens_used: 389,
        status: 'success',
        tags: ['design-patterns', 'principles'],
      },
      {
        _id: 1006,
        _ts: '2026-03-05T10:29:18Z',
        model: 'gpt-4o-mini',
        prompt: 'Generate a regex for email validation',
        response: '^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$',
        score: 0.79,
        latency_ms: 420,
        tokens_used: 87,
        status: 'success',
        tags: ['regex', 'validation'],
      },
      {
        _id: 1007,
        _ts: '2026-03-05T10:30:05Z',
        model: 'claude-3.5-sonnet',
        prompt: 'Explain the difference between REST and GraphQL',
        response: 'REST uses multiple endpoints while GraphQL uses a single endpoint...',
        score: 0.92,
        latency_ms: 980,
        tokens_used: 345,
        status: 'success',
        tags: ['api', 'comparison'],
      },
      {
        _id: 1008,
        _ts: '2026-03-05T10:31:22Z',
        model: 'gemini-2.0-flash',
        prompt: 'Write a Python decorator for caching',
        response:
          'from functools import lru_cache\n@lru_cache(maxsize=128)\ndef expensive_func()...',
        score: 0.87,
        latency_ms: 750,
        tokens_used: 213,
        status: 'success',
        tags: ['python', 'caching'],
      },
      {
        _id: 1009,
        _ts: '2026-03-05T10:32:40Z',
        model: 'gpt-4o',
        prompt: 'What is the CAP theorem?',
        response:
          'The CAP theorem states that a distributed system can only guarantee two of three properties...',
        score: 0.93,
        latency_ms: 1350,
        tokens_used: 401,
        status: 'success',
        tags: ['distributed-systems', 'theory'],
      },
      {
        _id: 1010,
        _ts: '2026-03-05T10:33:55Z',
        model: 'gpt-4o-mini',
        prompt: 'Create a bash one-liner to find large files',
        response:
          'find / -type f -size +100M -exec ls -lh {} \\; 2>/dev/null | sort -k5 -rh | head -20',
        score: 0.82,
        latency_ms: 380,
        tokens_used: 95,
        status: 'success',
        tags: ['bash', 'system-admin'],
      },
    ],
    fields: {
      _id: { type: 'int', count: 10 },
      _ts: { type: 'datetime', count: 10 },
      model: { type: 'str', count: 10 },
      prompt: { type: 'str', count: 10 },
      response: { type: 'str', count: 10 },
      score: { type: 'float', count: 10 },
      latency_ms: { type: 'int', count: 10 },
      tokens_used: { type: 'int', count: 10 },
      status: { type: 'str', count: 10 },
      tags: { type: 'list', count: 10 },
    },
    metadata: {
      token: MOCK_TABLE_TOKEN,
      title: 'LLM Benchmark Results',
      projectName: 'mock-llm-eval',
      createdAt: now,
      updatedAt: now,
      createdBy: 'mock-user',
    },
    pagination: {
      page: 1,
      pageSize: 100,
      totalCount: 10,
      totalPages: 1,
      hasNextPage: false,
      hasPreviousPage: false,
    },
  };
}
/* eslint-enable @typescript-eslint/naming-convention */

// =============================================================================
// Mock Plot Data
// =============================================================================

export function getMockPlotData() {
  const now = new Date().toISOString();

  const models = ['gpt-4o', 'claude-3.5-sonnet', 'gemini-2.0-flash', 'gpt-4o-mini'];
  const data = [];
  let id = 2001;

  for (const model of models) {
    const count = 15 + Math.floor(Math.random() * 10);
    for (let i = 0; i < count; i++) {
      const score =
        model === 'gpt-4o'
          ? 0.82 + Math.random() * 0.15
          : model === 'claude-3.5-sonnet'
            ? 0.8 + Math.random() * 0.17
            : model === 'gemini-2.0-flash'
              ? 0.7 + Math.random() * 0.2
              : 0.65 + Math.random() * 0.2;

      const latency =
        model === 'gpt-4o'
          ? 800 + Math.random() * 1000
          : model === 'claude-3.5-sonnet'
            ? 600 + Math.random() * 800
            : model === 'gemini-2.0-flash'
              ? 300 + Math.random() * 600
              : 200 + Math.random() * 500;

      const scoreVal = +score.toFixed(3);
      const latencyVal = Math.round(latency);
      const tsStr = `2026-03-05T${String(10 + Math.floor(i / 6)).padStart(2, '0')}:${String(Math.floor(Math.random() * 60)).padStart(2, '0')}:00Z`;
      data.push({
        type: 'ungrouped',
        id: String(id),
        ts: tsStr,
        'table1.id': String(id),
        'table1.ts': tsStr,
        entries: { model, score: scoreVal, latencyMs: latencyVal },
        derivedEntries: {},
        clippedFields: {},
        'table1.entries': {
          'table1.model': model,
          'table1.score': scoreVal,
          'table1.latencyMs': latencyVal,
        },
        'table1.derivedEntries': {},
        'table1.clippedFields': {},
      });
      id++;
    }
  }

  return {
    config: {
      type: 'Scatter Plot',
      xAxis: 'table1.latencyMs',
      yAxis: 'table1.score',
      groupBy: 'table1.model',
      scaleX: 'linear',
      scaleY: 'linear',
      metric: 'mean',
      binCount: 10,
      showRegression: false,
      title: 'Score vs Latency by Model',
      xLabel: 'Latency (ms)',
      yLabel: 'Score',
      showXLabel: true,
      showYLabel: true,
    },
    data,
    fields: {
      'table1.model': {
        dataType: 'str',
        fieldType: 'entry' as const,
        artifacts: '',
        mutable: 'false' as const,
        createdAt: now,
      },
      'table1.score': {
        dataType: 'float',
        fieldType: 'entry' as const,
        artifacts: '',
        mutable: 'false' as const,
        createdAt: now,
      },
      'table1.latencyMs': {
        dataType: 'int',
        fieldType: 'entry' as const,
        artifacts: '',
        mutable: 'false' as const,
        createdAt: now,
      },
    },
    metadata: {
      token: MOCK_PLOT_TOKEN,
      title: 'Score vs Latency by Model',
      projectName: 'mock-llm-eval',
      createdAt: now,
      createdBy: 'mock-user',
    },
  };
}
