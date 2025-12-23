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
| Token-based access | 12-character hex tokens (permanent, no expiry) |
| Backend storage | Plots stored in Orchestra database with project ownership |
| LLM inference | Natural language → plot configuration via GPT-4o-mini (billed to user) |
| Validation & fallbacks | Robust validation with intelligent fallbacks for LLM responses |
| Shared rendering | Single `PlotCanvas` component powers both public viewer and UI tiles |
| Project lifecycle | Plots auto-deleted when associated project is deleted |

---

## Architecture

### High-Level Overview

The Plot API uses a split architecture:

1. **Orchestra Backend** - Handles plot creation, storage, LLM inference, and access control
2. **Console Frontend** - Provides proxy endpoints and renders the plot viewer

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              External Client                             │
│                    (Script, Notebook, Integration)                       │
└─────────────────────────────┬───────────────────────────────────────────┘
                              │
            ┌─────────────────┴─────────────────┐
            ▼                                   ▼
┌───────────────────────┐           ┌───────────────────────────┐
│   Console Proxy       │           │   Orchestra Backend       │
│   (Optional)          │           │   (Primary API)           │
│                       │           │                           │
│ POST /api/plot/create │──────────▶│ POST /v0/logs/plot        │
│   ↓ Proxies to        │           │   • Validate request      │
│   Orchestra           │           │   • LLM inference         │
│                       │           │   • Store in database     │
└───────────────────────┘           │   • Return URL + token    │
                                    └───────────────────────────┘
                                              │
                          Returns: { url, token, plot_config, ... }
                                              ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                              Public User                                 │
│                         (Browser, Embed, etc.)                           │
└─────────────────────────────┬───────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                      /plot/view/[token] (Page)                           │
│                                                                          │
│  ┌──────────────────┐    ┌──────────────────┐    ┌──────────────────┐   │
│  │ GET /api/plot/   │───▶│ Admin: Get Plot  │───▶│ Admin: Get User  │   │
│  │ data/{token}     │    │ Config + User    │    │ API Key          │   │
│  └──────────────────┘    └──────────────────┘    └──────────────────┘   │
│           │                                               │              │
│           └───────────────────┬───────────────────────────┘              │
│                               ▼                                          │
│                   ┌──────────────────────┐                               │
│                   │ GET /v0/logs         │                               │
│                   │ (with user's key)    │                               │
│                   └──────────────────────┘                               │
│                               │                                          │
│                               ▼                                          │
│                   ┌──────────────────────┐                               │
│                   │ Transform + Render   │                               │
│                   │ PlotCanvas           │                               │
│                   └──────────────────────┘                               │
└──────────────────────────────────────────────────────────────────────────┘
```

### Backend (Orchestra) Responsibilities

- **Plot Storage**: Persistent storage in PostgreSQL with project/org relationships
- **Access Control**: Project-based permissions (`project:read`, `project:write`)
- **LLM Inference**: Infer plot configuration from natural language descriptions
- **Token Generation**: Unique 12-character hex tokens with collision prevention
- **Cascade Deletion**: Automatic cleanup when projects/users/orgs are deleted
- **Project Transfer**: Update plot ownership when projects move between personal/org

### Frontend (Console) Responsibilities

- **Proxy Endpoint**: Optional pass-through to Orchestra for plot creation
- **Data Retrieval**: Fetch plot data using admin endpoints + user's API key
- **Plot Rendering**: Transform data and render with D3-based PlotCanvas
- **Public Viewer**: Token-based public access page

---

## Module Structure

### Console Files

```
console/src/app/api/plot/
├── README.md                      # This file
├── create/
│   └── route.ts                   # Proxy to Orchestra POST /logs/plot
└── data/
    └── [token]/
        └── route.ts               # Fetch plot data via admin endpoints

console/src/app/plot/
└── view/
    └── [token]/
        └── page.tsx               # Public plot viewer page

console/src/components/Pages/Plot/
└── PlotViewer.tsx                 # Plot viewer component

console/src/components/Common/
└── PlotCanvas.tsx                 # Shared D3 rendering component
```

### Orchestra Files

```
orchestra/orchestra/web/api/plot/
├── README.md                      # Backend API documentation
├── __init__.py                    # Router exports
├── views.py                       # API endpoints
├── schema.py                      # Pydantic request/response models
└── llm_inference.py               # LLM configuration inference

orchestra/orchestra/db/
├── models/orchestra_models.py     # Plot SQLAlchemy model
├── dao/plot_dao.py                # Data access object
└── migrations/versions/
    └── ..._add_plot_table.py      # Database migration
```

---

## API Endpoints

### Console Endpoints

#### POST `/api/plot/create` (Proxy)

Proxies requests to Orchestra `POST /v0/logs/plot`. Optional - clients can call Orchestra directly.

**Headers:**
| Header | Required | Description |
|--------|----------|-------------|
| `Authorization` | Yes | `Bearer <user_api_key>` |
| `Content-Type` | Yes | `application/json` |

#### GET `/api/plot/data/[token]`

Fetches plot data for rendering. No authentication required - token provides access.

**Flow:**
1. Fetch plot config from Orchestra admin endpoint
2. Extract user_id and organization_id
3. Fetch user's API key from admin endpoint
4. Call `/v0/logs` with user's credentials
5. Transform data for D3 rendering

### Orchestra Endpoints (Primary API)

#### POST `/v0/logs/plot` (User-scoped)

Creates a new plot. Requires API key authentication.

**Request Body (Direct Config):**
```json
{
  "plot_config": {
    "type": "scatter|bar|histogram|line",
    "x_axis": "field_name",
    "y_axis": "field_name",
    "group_by": "field_name",
    "aggregate": "sum|mean|count|min|max",
    "scale_x": "linear|log",
    "scale_y": "linear|log",
    "metric": "mean|sum|count|min|max",
    "bin_count": 10,
    "show_regression": false,
    "sort_by": "x|y|value|name|count",
    "sort_order": "asc|desc",
    "title": "Plot Title",
    "x_label": "X Axis Label",
    "y_label": "Y Axis Label"
  },
  "project_config": {
    "project_name": "my-project",
    "context": "production",
    "filter_expr": "status == 'success'",
    "limit": 1000
  },
  "title": "My Plot Title"
}
```

**Request Body (LLM Description):**
```json
{
  "description": "Show a scatter plot of latency vs tokens, grouped by model",
  "project_config": {
    "project_name": "my-project"
  }
}
```

**Response (201 Created):**
```json
{
  "url": "https://console.unify.ai/plot/view/abc123def456",
  "token": "abc123def456",
  "plot_config": { ... },
  "project_config": { ... },
  "plot_metadata": {
    "token": "abc123def456",
    "title": "My Plot",
    "project_name": "my-project",
    "created_at": "2024-01-01T00:00:00Z",
    "created_by": "user_123"
  },
  "user_metadata": {
    "user_id": "user_123",
    "organization_id": null
  },
  "inferred_config": {
    "type": "scatter",
    "x_axis": "latency_ms",
    "y_axis": "tokens",
    "group_by": "model",
    "confidence": 0.85,
    "reasoning": "User wants to compare latency and tokens"
  }
}
```

#### GET `/v0/logs/plots` (User-scoped)

List plots accessible by the authenticated user.

**Query Parameters:**
| Parameter | Description |
|-----------|-------------|
| `project_name` | Filter by project name |

#### GET `/v0/logs/plots/{token}` (User-scoped)

Get a specific plot by token.

#### PATCH `/v0/logs/plots/{token}` (User-scoped)

Update a plot's title or configuration.

#### DELETE `/v0/logs/plots/{token}` (User-scoped)

Delete a plot.

#### GET `/v0/admin/logs/plot` (Admin-scoped)

Admin endpoint to retrieve plot including user_metadata. Used by console to fetch user's API key.

---

## Data Flow

### Plot Creation Flow

```
1. Client Request (to Orchestra or Console proxy)
   │
   ├─▶ Validate Authorization header
   │   └─▶ Extract API key, verify user access
   │
   ├─▶ Validate project access
   │   └─▶ Check project:write permission
   │
   ├─▶ [If description] LLM Inference
   │   ├─▶ Fetch available fields from /v0/logs/fields
   │   ├─▶ Build prompt with fields + description
   │   ├─▶ Call Orchestra chat completions (billed to user)
   │   ├─▶ Parse JSON response
   │   └─▶ Validate + apply fallbacks
   │
   ├─▶ Store plot in database
   │   ├─▶ Generate unique 12-char hex token
   │   └─▶ Link to project, user, organization
   │
   └─▶ Return { url, token, configs, metadata }
```

### Data Retrieval Flow (Console)

```
1. Browser Request to /plot/view/{token}
   │
   ├─▶ Console fetches /api/plot/data/{token}
   │
   ├─▶ Admin: GET /admin/logs/plot?token={token}
   │   └─▶ Returns config, project_config, user_id, organization_id
   │
   ├─▶ Admin: GET /admin/auth-user/by-user-id?user_id={user_id}
   │   └─▶ Returns user's API keys (personal + org)
   │
   ├─▶ Select correct API key based on organization_id
   │
   ├─▶ GET /v0/logs with user's API key
   │   └─▶ Returns log data
   │
   ├─▶ GET /v0/logs/fields with user's API key
   │   └─▶ Returns field metadata
   │
   ├─▶ Transform data for PlotCanvas
   │   ├─▶ Add table1. prefixes to field names
   │   └─▶ Convert snake_case to camelCase
   │
   └─▶ Return { config, data, fields, metadata }
```

---

## Configuration

### Environment Variables

#### Console

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_ORCHESTRA_URL` | Yes | Orchestra backend URL |
| `ORCHESTRA_ADMIN_KEY` | Yes | Admin key for fetching plot configs and user data |
| `NEXT_PUBLIC_APP_URL` | Yes | Base URL for the console (for plot URLs) |

#### Orchestra

| Variable | Required | Description |
|----------|----------|-------------|
| `ORCHESTRA_CONSOLE_URL` | No | Console URL for plot links (default: `https://console.unify.ai`) |

---

## Security

### Access Control

| Action | Authentication | Authorization |
|--------|----------------|---------------|
| Create plot | User API key | `project:write` on target project |
| List plots | User API key | Only shows plots for accessible projects |
| Get plot | User API key | `project:read` on plot's project |
| Update plot | User API key | `project:write` on plot's project |
| Delete plot | User API key | `project:write` on plot's project |
| View plot (public) | Token in URL | Token provides access |

### Token Security

1. **Random Generation** - Tokens are 12-character hex strings from `secrets.token_hex(6)`
2. **Collision Prevention** - Retry logic ensures uniqueness
3. **No Expiration** - Tokens are permanent unless explicitly deleted
4. **Project Lifecycle** - Tokens deleted with their project (CASCADE)
5. **Organization Lifecycle** - Tokens deleted with their organization (CASCADE)

### API Key Handling

- User API keys are **never stored** in the Plot table
- Console fetches keys via admin endpoint when rendering plots
- Keys are selected based on plot's `organization_id`

---

## Usage Examples

### Python: Create Plot via Orchestra (Recommended)

```python
import requests

API_KEY = "your-orchestra-api-key"
ORCHESTRA_URL = "https://api.unify.ai"

headers = {
    "Authorization": f"Bearer {API_KEY}",
    "Content-Type": "application/json"
}

# Create a scatter plot
response = requests.post(
    f"{ORCHESTRA_URL}/v0/logs/plot",
    headers=headers,
    json={
        "plot_config": {
            "type": "scatter",
            "x_axis": "latency_ms",
            "y_axis": "accuracy",
            "group_by": "model",
            "show_regression": True,
            "title": "Accuracy vs Latency",
            "x_label": "Response Latency (ms)",
            "y_label": "Accuracy Score"
        },
        "project_config": {
            "project_name": "my-project",
            "filter_expr": "status == 'success'",
            "limit": 1000
        },
        "title": "Accuracy vs Latency by Model"
    }
)

result = response.json()
print(f"Plot URL: {result['url']}")
print(f"Token: {result['token']}")
```

### Python: Create Plot with LLM Description

```python
# Uses LLM credits - billed to your account
response = requests.post(
    f"{ORCHESTRA_URL}/v0/logs/plot",
    headers=headers,
    json={
        "description": "Show me a bar chart comparing average latency across different models",
        "project_config": {
            "project_name": "my-project"
        }
    }
)

result = response.json()
print(f"Inferred type: {result['inferred_config']['type']}")
print(f"Confidence: {result['inferred_config']['confidence']}")
print(f"Reasoning: {result['inferred_config']['reasoning']}")
print(f"Plot URL: {result['url']}")
```

### Python: List and Manage Plots

```python
# List all plots
plots = requests.get(
    f"{ORCHESTRA_URL}/v0/logs/plots",
    headers=headers
).json()

for plot in plots["plots"]:
    print(f"- {plot['token']}: {plot['title']} ({plot['project_name']})")

# Get specific plot
plot = requests.get(
    f"{ORCHESTRA_URL}/v0/logs/plots/{token}",
    headers=headers
).json()

# Update plot title
requests.patch(
    f"{ORCHESTRA_URL}/v0/logs/plots/{token}",
    headers=headers,
    json={"title": "Updated Title"}
)

# Delete plot
requests.delete(
    f"{ORCHESTRA_URL}/v0/logs/plots/{token}",
    headers=headers
)
```

### cURL: Quick Test

```bash
# Create a bar chart
curl -X POST https://api.unify.ai/v0/logs/plot \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "plot_config": {
      "type": "bar",
      "x_axis": "model",
      "y_axis": "latency_ms",
      "aggregate": "mean",
      "sort_by": "y",
      "sort_order": "desc"
    },
    "project_config": {
      "project_name": "my-project"
    },
    "title": "Average Latency by Model"
  }'
```

### JavaScript: Embed in Web Page

```html
<iframe 
  src="https://console.unify.ai/plot/view/abc123def456"
  width="800" 
  height="600"
  frameborder="0"
></iframe>
```

---

## Troubleshooting

### Common Errors

| Error | Cause | Solution |
|-------|-------|----------|
| `401 Unauthorized` | Missing or invalid API key | Add `Authorization: Bearer <key>` header |
| `400 Missing project_config.project_name` | Project name not specified | Add project_name to request |
| `400 Either plot_config or description is required` | No config provided | Add plot_config or description |
| `403 Forbidden` | No permission on project | Verify project access permissions |
| `404 Plot not found` | Token invalid or plot deleted | Create a new plot |
| `404 Project not found` | Project doesn't exist | Verify project name |
| `500 LLM inference failed` | Chat completions error | Provide direct plot_config instead |

### Debug Tips

1. **Check token format** - Must be exactly 12 lowercase hex characters
2. **Verify API key** - Test with a direct Orchestra API call first
3. **Check project exists** - Ensure project_name matches exactly
4. **Review field names** - Fields in plot_config must exist in the project
5. **Check permissions** - User needs `project:write` to create, `project:read` to view

---

## Migration from Legacy System

The Plot API has been migrated from a console-based NodeCache storage to Orchestra-based PostgreSQL storage. Key changes:

| Aspect | Legacy (Console) | Current (Orchestra) |
|--------|------------------|---------------------|
| Storage | NodeCache (in-memory) | PostgreSQL database |
| Expiry | 24-hour TTL | No expiry (permanent) |
| API Key | Encrypted in cache | Fetched via admin endpoint |
| LLM Inference | Console server | Orchestra backend |
| Access Control | Token-only | Project-based permissions |
| Lifecycle | Independent | Tied to project/org lifecycle |

The console `/api/plot/create` endpoint now acts as a proxy to Orchestra for backward compatibility.
