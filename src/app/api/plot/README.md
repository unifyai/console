# Plot API Module

A module for programmatic plot generation with token-gated public access. Create shareable plot links from configuration or natural language descriptions.

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Module Structure](#module-structure)
- [API Endpoints](#api-endpoints)
- [Data Flow](#data-flow)
- [Configuration](#configuration)
- [Security](#security)
- [Testing](#testing)
- [Usage Examples](#usage-examples)
- [Troubleshooting](#troubleshooting)

---

## Overview

The Plot API enables:

1. **Programmatic Plot Creation** - Generate plots via API with full configuration control
2. **Token-Gated Sharing** - Create public, embeddable plot links without exposing credentials
3. **LLM-Powered Inference** - Describe plots in natural language and let AI infer the configuration
4. **Full Parameter Support** - Access all log fetching parameters available in the UI

### Key Features

| Feature | Description |
|---------|-------------|
| Token-based access | 12-character hex tokens with configurable TTL (default 24h) |
| Encrypted credentials | User API keys encrypted at rest using AES-256-GCM |
| LLM inference | Natural language → plot configuration via GPT-4o-mini |
| Validation & fallbacks | Robust validation with intelligent fallbacks for LLM responses |
| Shared rendering | Single `PlotCanvas` component powers both public viewer and UI tiles |

---

## Architecture

### High-Level Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              External Client                             │
│                    (Script, Notebook, Integration)                       │
└─────────────────────────────────┬───────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         POST /api/plot/create                            │
│                                                                          │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────────────────┐   │
│  │ Validate     │───▶│ Infer Config │───▶│ Store Token + Return URL │   │
│  │ Request      │    │ (if desc.)   │    │                          │   │
│  └──────────────┘    └──────────────┘    └──────────────────────────┘   │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
                                  │
                                  │ Returns: { url, token, expires_in_hours }
                                  ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                              Public User                                 │
│                         (Browser, Embed, etc.)                           │
└─────────────────────────────────┬───────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                      /plot/view/[token] (Page)                           │
│                                                                          │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────────────────┐   │
│  │ Fetch Data   │───▶│ Transform    │───▶│ Render PlotCanvas        │   │
│  │ via Token    │    │ for D3       │    │                          │   │
│  └──────────────┘    └──────────────┘    └──────────────────────────┘   │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### Module Dependency Graph

```
                    ┌─────────────────────────────────────┐
                    │         API Routes (Orchestrators)   │
                    │  ┌─────────────┐  ┌───────────────┐  │
                    │  │ create/     │  │ data/[token]/ │  │
                    │  │ route.ts    │  │ route.ts      │  │
                    │  └──────┬──────┘  └───────┬───────┘  │
                    └─────────┼─────────────────┼──────────┘
                              │                 │
          ┌───────────────────┼─────────────────┼───────────────────┐
          │                   │                 │                   │
          ▼                   ▼                 ▼                   ▼
    ┌───────────┐      ┌─────────────┐   ┌───────────┐      ┌────────────┐
    │validation │      │ llm-config  │   │   store   │      │ transform  │
    │   .ts     │◀─────│    .ts      │   │   .ts     │      │    .ts     │
    └───────────┘      └─────────────┘   └─────┬─────┘      └────────────┘
          │                   │                │
          │                   │                ▼
          │                   │          ┌───────────┐
          │                   │          │  crypto   │
          │                   │          │   .ts     │
          ▼                   ▼          └───────────┘
    ┌──────────────────────────────┐
    │      normalization.ts        │
    │  (Pure utility functions)    │
    └──────────────────────────────┘
```

### Component Relationship

```
┌─────────────────────────────────────────────────────────────────┐
│                        Plot Rendering                            │
│                                                                  │
│   ┌─────────────────────┐       ┌─────────────────────────────┐ │
│   │   PlotViewer.tsx    │       │   Plot.tsx (Interface Tile) │ │
│   │   (Public page)     │       │   (Dashboard UI)            │ │
│   └──────────┬──────────┘       └──────────────┬──────────────┘ │
│              │                                 │                 │
│              │    ┌─────────────────────┐      │                 │
│              └───▶│   PlotCanvas.tsx    │◀─────┘                 │
│                   │   (Shared D3 core)  │                        │
│                   └─────────┬───────────┘                        │
│                             │                                    │
│                             ▼                                    │
│                   ┌─────────────────────┐                        │
│                   │   drawPlot()        │                        │
│                   │   (D3 rendering)    │                        │
│                   └─────────────────────┘                        │
└──────────────────────────────────────────────────────────────────┘
```

---

## Module Structure

```
console/src/lib/plot/
├── README.md           # This file
├── crypto.ts           # API key encryption/decryption
├── normalization.ts    # Type normalization, query param building
├── validation.ts       # Config validation with intelligent fallbacks
├── llm-config.ts       # LLM inference from natural language
├── store.ts            # Token storage with TTL
└── transform.ts        # Data transformation for plot rendering
```

### File Descriptions

| File | Responsibility | Dependencies |
|------|----------------|--------------|
| `crypto.ts` | Encrypts/decrypts API keys using AES-256-GCM | Node.js crypto |
| `normalization.ts` | Normalizes plot types, builds query params | None (pure functions) |
| `validation.ts` | Validates LLM responses, provides fallbacks | normalization.ts |
| `llm-config.ts` | Calls Orchestra chat completions for inference | validation.ts |
| `store.ts` | Manages NodeCache token storage | crypto.ts |
| `transform.ts` | Transforms Orchestra data for PlotCanvas | None (pure functions) |

### Related Files (Outside lib/plot/)

| Path | Description |
|------|-------------|
| `app/api/plot/create/route.ts` | POST endpoint for creating plot tokens |
| `app/api/plot/data/[token]/route.ts` | GET endpoint for fetching plot data |
| `app/plot/view/[token]/page.tsx` | Public plot viewer page |
| `components/Pages/Plot/PlotViewer.tsx` | Plot viewer component |
| `components/Common/PlotCanvas.tsx` | Shared D3 rendering component |

---

## API Endpoints

### POST `/api/plot/create`

Creates a new plot token and returns a shareable URL.

**Headers:**
| Header | Required | Description |
|--------|----------|-------------|
| `Authorization` | Yes | `Bearer <user_api_key>` |
| `Content-Type` | Yes | `application/json` |

**Request Body (Direct Config):**
```
{
  "plot_config": {
    "type": "scatter|bar|histogram|line",
    "x_axis": "field_name",           // Required
    "y_axis": "field_name",           // Required for scatter/bar/line
    "group_by": "field_name",         // Optional
    "aggregate": "sum|mean|count|min|max",
    "scale_x": "linear|log",
    "scale_y": "linear|log",
    "metric": "mean|sum|count|min|max",
    "bin_count": 10,
    "show_regression": false,
    "colors": { "group_value": "#hex" }
  },
  "project_config": {
    "project_name": "my-project",     // Required
    "context": "production",
    "filter_expr": "status == 'success'",
    "sorting": "{\"timestamp\": \"descending\"}",
    "limit": 1000,
    "offset": 0,
    "group_by": ["model", "region"],
    "group_limit": 100,
    "value_limit": 10000
  },
  "title": "My Plot Title"
}
```

**Request Body (LLM Description):**
```
{
  "description": "Show a scatter plot of latency vs tokens, grouped by model",
  "project_config": {
    "project_name": "my-project"
  }
}
```

**Response (201 Created):**
```
{
  "url": "https://console.example.com/plot/view/abc123def456",
  "token": "abc123def456",
  "expires_in_hours": 24,
  "inferred_config": {        // Only present when using description
    "type": "scatter",
    "x_axis": "latency_ms",
    "y_axis": "tokens",
    "group_by": "model",
    "confidence": 0.85,
    "reasoning": "User wants to compare latency and tokens"
  }
}
```

### GET `/api/plot/data/[token]`

Fetches plot data for rendering. No authentication required (token is the auth).

**Response (200 OK):**
```
{
  "config": {
    "type": "scatter",
    "xAxis": "table1.latency_ms",
    "yAxis": "table1.tokens",
    "groupBy": "table1.model",
    "scaleX": "linear",
    "scaleY": "linear",
    "metric": "mean",
    "binCount": 10,
    "showRegression": false
  },
  "data": [
    {
      "type": "ungrouped",
      "table1.entries": {
        "table1.latency_ms": 150,
        "table1.tokens": 500
      }
    }
  ],
  "fields": {
    "table1.latency_ms": { "data_type": "float" },
    "table1.tokens": { "data_type": "int" }
  },
  "metadata": {
    "title": "My Plot",
    "project_name": "my-project",
    "created_at": 1703260800000,
    "expires_at": 1703347200000
  }
}
```

---

## Data Flow

### Token Creation Flow

```
1. Client Request
   │
   ├─▶ Validate Authorization header
   │   └─▶ Extract API key from "Bearer <key>"
   │
   ├─▶ Parse and validate request body
   │   ├─▶ Validate project_config.project_name exists
   │   └─▶ Validate plot_config.x_axis OR description exists
   │
   ├─▶ [If description] LLM Inference
   │   ├─▶ Fetch available fields from Orchestra
   │   ├─▶ Build prompt with fields + description
   │   ├─▶ Call Orchestra chat completions
   │   ├─▶ Parse JSON response
   │   └─▶ Validate + apply fallbacks
   │
   ├─▶ Normalize plot configuration
   │   └─▶ Map type names ("Scatter Plot" → "scatter")
   │
   ├─▶ Store token in cache
   │   ├─▶ Generate 12-char hex token
   │   ├─▶ Encrypt API key
   │   └─▶ Set TTL (default 24h)
   │
   └─▶ Return { url, token, expires_in_hours }
```

### Data Retrieval Flow

```
1. Browser/Client Request
   │
   ├─▶ Validate token format (12 hex chars)
   │
   ├─▶ Retrieve token data from cache
   │   └─▶ Return 404 if not found/expired
   │
   ├─▶ Decrypt stored API key
   │
   ├─▶ Fetch data from Orchestra (parallel)
   │   ├─▶ GET /v0/logs?project=...&<params>
   │   └─▶ GET /v0/logs/fields?project=...
   │
   ├─▶ Transform data for PlotCanvas
   │   ├─▶ Prefix field names with "table1." in fields object
   │   ├─▶ Prefix field names with "table1." in log entries
   │   ├─▶ Prefix axis values in config with "table1."
   │   └─▶ Wrap entries in expected structure
   │
   └─▶ Return { config, data, fields, metadata }
```

### Data Format (table1 prefix)

The Plot API and `PlotCanvas` component expect data in a specific format with `table1.` prefixes:

| Component | Expected Format | Example |
|-----------|-----------------|---------|
| Config axes | `table1.field_name` | `xAxis: "table1.latency_ms"` |
| Fields keys | `table1.field_name` | `fields["table1.latency_ms"]` |
| Log entries | `log["table1.entries"]["table1.field_name"]` | `log["table1.entries"]["table1.latency_ms"]` |

This format is required because the D3 plotting code (`getValue()`, `hasProperty()`) looks up values using:
```
fields[axisProperty].data_type        // e.g., fields["table1.latency_ms"]
log[`${table}.entries`][axisProperty] // e.g., log["table1.entries"]["table1.latency_ms"]
```

The data route automatically transforms:
1. **User input**: `x_axis: "latency_ms"` (simple field name)
2. **Stored config**: `xAxis: "latency_ms"` (unchanged)
3. **Returned config**: `xAxis: "table1.latency_ms"` (prefixed for PlotCanvas)

---

## Configuration

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `PLOT_TOKEN_SECRET` | No* | Secret for API key encryption (32+ chars recommended) |
| `JWT_SECRET` | No* | Fallback secret if `PLOT_TOKEN_SECRET` not set |
| `NEXT_PUBLIC_BASE_URL` | Yes | Base URL for generated plot links |
| `ORCHESTRA_URL` | Yes | Orchestra backend URL |

*One of `PLOT_TOKEN_SECRET` or `JWT_SECRET` must be set.

### Token TTL

Default TTL is **24 hours**. Tokens are automatically purged from the cache after expiry.

---

## Security

### API Key Protection

1. **Encryption at Rest** - API keys are encrypted using AES-256-GCM before storage
2. **Server-Side Only** - Encrypted keys never leave the server; only plot data is sent to browsers
3. **Unique IVs** - Each encryption uses a random initialization vector
4. **Auth Tags** - Encryption includes authentication tags for integrity verification

### Token Security

1. **Random Generation** - Tokens are 12-character hex strings from crypto.randomBytes
2. **Time-Limited** - Tokens expire after TTL (default 24h)
3. **No Enumeration** - Invalid tokens return same error as expired (timing attack resistant)
4. **Format Validation** - Strict regex validation before cache lookup

### Access Control

| Endpoint | Authentication | Notes |
|----------|----------------|-------|
| `POST /api/plot/create` | Bearer token (API key) | Required to create plots |
| `GET /api/plot/data/[token]` | Token in URL | Public access with valid token |
| `/plot/view/[token]` | None | Public page, token provides access |

---

## Testing

### Test Files

```
console/src/tests/interfaces/unit/plot/
├── crypto.node.test.ts         # 12 tests - Encryption/decryption
├── normalization.node.test.ts  # 28 tests - Type normalization, params
├── validation.node.test.ts     # 30 tests - Config validation, fallbacks
├── llm-config.node.test.ts     # 13 tests - LLM inference
├── store.node.test.ts          # 16 tests - Token storage
├── routes.node.test.ts         # 23 tests - Route handler logic
├── transform.node.test.ts      # 37 tests - Data transformation
└── PlotCanvas.node.test.ts     # 58 tests - Component logic

console/src/tests/interfaces/api/
└── plot.api.node.test.ts       # Integration tests (requires server)
```

### Running Tests

```bash
# Run all plot unit tests
npm run test:node -- --run src/tests/interfaces/unit/plot/

# Run specific test file
npm run test:node -- --run src/tests/interfaces/unit/plot/validation.node.test.ts

# Run API integration tests (requires dev server)
npm run dev  # In one terminal
npm run test:interfaces:api -- --run plot  # In another
```

### Test Coverage Summary

| Category | Tests | Description |
|----------|-------|-------------|
| Crypto | 12 | Encryption, decryption, key derivation, error handling |
| Normalization | 28 | Plot type mapping, query param building |
| Validation | 30 | Required fields, fallbacks, type checking |
| LLM Config | 13 | Prompt building, response parsing, error handling |
| Store | 16 | Token CRUD, TTL, encryption integration |
| Routes | 23 | Request validation, response format, errors |
| Transform | 37 | Data transformation, field prefixing |
| PlotCanvas | 58 | Props, callbacks, state, rendering logic |
| **Total Unit** | **217** | |
| API Integration | ~25 | End-to-end flows with real server |

---

## Usage Examples

### Python: Create a Plot Programmatically

```python
import requests

API_KEY = "your-orchestra-api-key"
CONSOLE_URL = "https://console.yoursite.com"

# Create plot with direct configuration
response = requests.post(
    f"{CONSOLE_URL}/api/plot/create",
    headers={
        "Authorization": f"Bearer {API_KEY}",
        "Content-Type": "application/json"
    },
    json={
        "plot_config": {
            "type": "scatter",
            "x_axis": "latency_ms",
            "y_axis": "tokens",
            "group_by": "model",
            "show_regression": True
        },
        "project_config": {
            "project_name": "my-llm-project",
            "filter_expr": "status == 'success'",
            "limit": 1000
        },
        "title": "Latency vs Token Usage"
    }
)

result = response.json()
print(f"Plot URL: {result['url']}")
# Output: Plot URL: https://console.yoursite.com/plot/view/abc123def456
```

### Python: Create a Plot from Description

```python
response = requests.post(
    f"{CONSOLE_URL}/api/plot/create",
    headers={
        "Authorization": f"Bearer {API_KEY}",
        "Content-Type": "application/json"
    },
    json={
        "description": "Show me a histogram of response latencies",
        "project_config": {
            "project_name": "my-llm-project"
        }
    }
)

result = response.json()
print(f"Inferred type: {result['inferred_config']['type']}")
print(f"Confidence: {result['inferred_config']['confidence']}")
print(f"Plot URL: {result['url']}")
```

### JavaScript: Embed in a Web Page

```html
<iframe 
  src="https://console.yoursite.com/plot/view/abc123def456"
  width="800" 
  height="600"
  frameborder="0"
></iframe>
```

### cURL: Quick Test

```bash
curl -X POST https://console.yoursite.com/api/plot/create \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "plot_config": {
      "type": "bar",
      "x_axis": "model",
      "y_axis": "latency_ms",
      "aggregate": "mean"
    },
    "project_config": {
      "project_name": "my-project"
    }
  }'
```

---

## Troubleshooting

### Common Errors

| Error | Cause | Solution |
|-------|-------|----------|
| `401 Missing Authorization header` | No Bearer token provided | Add `Authorization: Bearer <key>` header |
| `400 Missing project_config.project_name` | Project name not specified | Add project_name to request |
| `400 Either plot_config or description is required` | No config provided | Add plot_config or description |
| `404 Plot token not found or expired` | Token invalid or expired | Create a new plot token |
| `502 Failed to fetch logs from Orchestra` | Orchestra API error | Check API key and project name |
| `500 LLM inference failed` | Chat completions error | Provide direct plot_config instead |

### Debug Tips

1. **Check token format** - Must be exactly 12 lowercase hex characters
2. **Verify API key** - Test with a direct Orchestra API call first
3. **Check project exists** - Ensure project_name matches exactly
4. **Review field names** - Fields in plot_config must exist in the project
5. **Check TTL** - Tokens expire after 24 hours by default

### Logs

Token operations are logged with `[PlotTokenStore]` prefix:

```
[PlotTokenStore] Stored token: abc123def456, cache size: 5
[PlotTokenStore] Get token: abc123def456, found: true, cache size: 5
```

---

## Future Considerations

1. **Redis Backend** - Move from NodeCache to Redis for multi-instance deployments
2. **Custom TTL** - Allow users to specify token expiry time
3. **Rate Limiting** - Add rate limits to prevent abuse
4. **Refresh Tokens** - Allow extending token TTL without re-creating
5. **Webhook Notifications** - Notify when tokens are about to expire
6. **Usage Analytics** - Track plot views and popular configurations


