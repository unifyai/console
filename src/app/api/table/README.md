# Table View API Module

A module for creating shareable table excerpts with token-gated public access. Create read-only table views from log data that can be embedded or shared.

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

The Table View API enables:

1. **Shareable Table Excerpts** - Create public, embeddable table links without exposing credentials
2. **Read-Only Visualization** - Column visibility, reordering, sorting - no data manipulation
3. **Token-Gated Access** - 12-character hex tokens provide permanent access

### Key Features

| Feature            | Description                                                     |
| ------------------ | --------------------------------------------------------------- |
| Token-based access | 12-character hex tokens (permanent, no expiry)                  |
| Backend storage    | Table views stored in Orchestra database with project ownership |
| Read-only display  | Show/hide columns, reorder, sort - no filtering/editing         |
| Copy to clipboard  | Export visible data as TSV                                      |
| Project lifecycle  | Table views auto-deleted when associated project is deleted     |

### Comparison with Plot API

| Aspect        | Plot API                | Table View API          |
| ------------- | ----------------------- | ----------------------- |
| Data format   | Visualizations (charts) | Tabular data            |
| Interactivity | Zoom, scale, binning    | Sort, show/hide columns |
| LLM inference | Yes (describe → config) | No                      |
| Rendering     | D3-based PlotCanvas     | TanStack Table          |

---

## Architecture

### High-Level Overview

The Table View API uses the same split architecture as Plot API:

1. **Orchestra Backend** - Handles table view creation, storage, and access control
2. **Console Frontend** - Provides proxy endpoints and renders the table viewer

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              External Client                             │
│                    (Script, Notebook, AI Assistant)                      │
└─────────────────────────────┬───────────────────────────────────────────┘
                              │
            ┌─────────────────┴─────────────────┐
            ▼                                   ▼
┌───────────────────────┐           ┌───────────────────────────┐
│   Console Proxy       │           │   Orchestra Backend       │
│   (Optional)          │           │   (Primary API)           │
│                       │           │                           │
│ POST /api/table/create│──────────▶│ POST /v0/logs/table       │
│   ↓ Proxies to        │           │   • Validate request      │
│   Orchestra           │           │   • Store in database     │
│                       │           │   • Return URL + token    │
└───────────────────────┘           └───────────────────────────┘
                                              │
                          Returns: { url, token }
                                              ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                              Public User                                 │
│                         (Browser, Embed, etc.)                           │
└─────────────────────────────┬───────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                      /table/view/[token] (Page)                          │
│                                                                          │
│  ┌──────────────────┐    ┌──────────────────┐    ┌──────────────────┐   │
│  │ GET /api/table/  │───▶│ Admin: Get Table │───▶│ Admin: Get User  │   │
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
│                   │ TableViewer          │                               │
│                   └──────────────────────┘                               │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## Module Structure

### Console Files

```
console/src/app/api/table/
├── README.md                      # This file
├── create/
│   └── route.ts                   # Proxy to Orchestra POST /logs/table
└── data/
    └── [token]/
        └── route.ts               # Fetch table data via admin endpoints

console/src/app/table/
└── view/
    └── [token]/
        └── page.tsx               # Public table viewer page

console/src/components/Pages/Table/
├── index.ts                       # Exports
└── TableViewer.tsx                # Interactive table component

console/src/types/
└── tableView.ts                   # Shared type definitions
```

### Orchestra Files

```
orchestra/orchestra/web/api/table_view/
├── __init__.py                    # Router exports
├── views.py                       # API endpoints
└── schema.py                      # Pydantic request/response models

orchestra/orchestra/db/
├── models/orchestra_models.py     # TableView SQLAlchemy model
├── dao/table_view_dao.py          # Data access object
└── migrations/versions/
    └── ..._add_table_view.py      # Database migration
```

---

## API Endpoints

### Console Endpoints

#### POST `/api/table/create` (Proxy)

Proxies requests to Orchestra `POST /v0/logs/table`.

**Headers:**

| Header          | Required | Description             |
| --------------- | -------- | ----------------------- |
| `Authorization` | Yes      | `Bearer <user_api_key>` |
| `Content-Type`  | Yes      | `application/json`      |

**Request Body:**

```json
{
  "title": "My Table View",
  "tableConfig": {
    "columns": {
      "visible": ["name", "status", "value"],
      "order": ["status", "name", "value"],
      "widths": { "name": 200, "value": 100 }
    },
    "rowLimit": 100,
    "sortBy": "name",
    "sortOrder": "asc"
  },
  "projectConfig": {
    "projectName": "my-project",
    "context": "production",
    "filterExpr": "status == 'active'",
    "limit": 1000
  }
}
```

**Response (201 Created):**

```json
{
  "url": "https://console.unify.ai/table/view/abc123def456",
  "token": "abc123def456"
}
```

#### GET `/api/table/data/[token]`

Fetches table data for rendering. No authentication required - token provides access.

**Response (200 OK):**

```json
{
  "config": {
    "visibleColumns": ["name", "status", "value"],
    "columnOrder": ["status", "name", "value"],
    "rowLimit": 100,
    "sortBy": "name",
    "sortOrder": "asc"
  },
  "data": [
    { "_id": 1, "_ts": "2026-01-01T00:00:00Z", "name": "Item 1", "status": "active", "value": 42 }
  ],
  "fields": {
    "name": { "type": "str", "count": 100 },
    "status": { "type": "str", "count": 100 },
    "value": { "type": "float", "count": 100 }
  },
  "metadata": {
    "token": "abc123def456",
    "title": "My Table View",
    "projectName": "my-project",
    "createdAt": "2026-01-20T12:00:00Z",
    "updatedAt": "2026-01-20T12:00:00Z",
    "createdBy": "user_123"
  },
  "totalCount": 1000
}
```

---

## Data Flow

### Table View Creation

```
1. Client Request (to Orchestra or Console proxy)
   │
   ├─▶ Validate Authorization header
   │   └─▶ Extract API key, verify user access
   │
   ├─▶ Validate project access
   │   └─▶ Check project:write permission
   │
   ├─▶ Store table view in database
   │   ├─▶ Generate unique 12-char hex token
   │   └─▶ Link to project, user, organization
   │
   └─▶ Return { url, token }
```

### Data Retrieval

```
1. Browser Request to /table/view/{token}
   │
   ├─▶ Console fetches /api/table/data/{token}
   │
   ├─▶ Admin: GET /admin/logs/table?token={token}
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
   ├─▶ Transform data for TableViewer
   │   └─▶ Compute visible columns and order
   │
   └─▶ Return { config, data, fields, metadata, totalCount }
```

---

## Configuration

### Environment Variables

| Variable              | Required | Description                                        |
| --------------------- | -------- | -------------------------------------------------- |
| `ORCHESTRA_URL`       | Yes      | Orchestra backend URL                              |
| `ORCHESTRA_ADMIN_KEY` | Yes      | Admin key for fetching table configs and user data |
| `NEXT_PUBLIC_APP_URL` | Yes      | Base URL for the console (for table view URLs)     |

---

## Security

### Access Control

| Action              | Authentication | Authorization                     |
| ------------------- | -------------- | --------------------------------- |
| Create table view   | User API key   | `project:write` on target project |
| View table (public) | Token in URL   | Token provides access             |

### Token Security

1. **Random Generation** - Tokens are 12-character hex strings from `secrets.token_hex(6)`
2. **Collision Prevention** - Retry logic ensures uniqueness
3. **No Expiration** - Tokens are permanent unless explicitly deleted
4. **Project Lifecycle** - Tokens deleted with their project (CASCADE)
5. **Organization Lifecycle** - Tokens deleted with their organization (CASCADE)

### Read-Only Design

The TableViewer intentionally **does not** include:

- ❌ Filtering (manipulates underlying data)
- ❌ Editing (modifies data)
- ❌ Deletion (removes data)

Only visualization features are allowed:

- ✅ Show/hide columns
- ✅ Reorder columns (drag & drop)
- ✅ Sort by column
- ✅ Pagination
- ✅ Copy to clipboard

---

## Usage Examples

### Python: Create Table View

```python
import requests

API_KEY = "your-orchestra-api-key"
ORCHESTRA_URL = "https://api.unify.ai"

headers = {
    "Authorization": f"Bearer {API_KEY}",
    "Content-Type": "application/json"
}

response = requests.post(
    f"{ORCHESTRA_URL}/v0/logs/table",
    headers=headers,
    json={
        "table_config": {
            "columns": {
                "visible": ["name", "status", "value"],
                "order": ["status", "name", "value"]
            },
            "row_limit": 100,
            "sort_by": "value",
            "sort_order": "desc"
        },
        "project_config": {
            "project_name": "my-project",
            "filter_expr": "status == 'active'"
        },
        "title": "Active Items by Value"
    }
)

result = response.json()
print(f"Table URL: {result['url']}")
print(f"Token: {result['token']}")
```

### Embed in Web Page

```html
<iframe
  src="https://console.unify.ai/table/view/abc123def456"
  width="100%"
  height="600"
  frameborder="0"
></iframe>
```

---

## Troubleshooting

### Common Errors

| Error                                   | Cause                      | Solution                                 |
| --------------------------------------- | -------------------------- | ---------------------------------------- |
| `401 Unauthorized`                      | Missing or invalid API key | Add `Authorization: Bearer <key>` header |
| `400 Missing projectConfig.projectName` | Project name not specified | Add projectName to request               |
| `403 Forbidden`                         | No permission on project   | Verify project access permissions        |
| `404 Table view not found`              | Token invalid or deleted   | Create a new table view                  |
| `504 Request timed out`                 | Slow backend response      | Try again or reduce data size            |

### Debug Tips

1. **Check token format** - Must be exactly 12 lowercase hex characters
2. **Verify API key** - Test with a direct Orchestra API call first
3. **Check project exists** - Ensure project_name matches exactly
4. **Check column names** - Columns in config must exist in the data
