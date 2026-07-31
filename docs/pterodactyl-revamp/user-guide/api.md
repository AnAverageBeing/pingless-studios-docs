---
title: API Reference
description: Pterodactyl Revamp HTTP APIs — the admin session API (/admin/revamp), the application API (/api/application/revamp) for integrations, and the client API server tags endpoint.
---

# API Reference

Pterodactyl Revamp exposes **three HTTP surfaces**:

| Surface | Prefix | Auth | Audience |
| ------- | ------ | ---- | -------- |
| **Admin session API** | `/admin/revamp` | Panel web session + 2FA + root admin | The Revamp admin UI (and browser tooling) |
| **Application API** | `/api/application/revamp` | Application API key owned by a **root admin** | External integrations, WHMCS / billing systems |
| **Client API** | `/api/client/servers/{server}` | Client API key with server access | Server owners reading their tags |

The application API mirrors the admin controllers — it exists so integrations can drive tags, templates, bulk operations, search, analytics, and health without a browser session.

---

## Admin Session API

Mounted by `RevampServiceProvider` under `/admin/revamp` behind the standard admin middleware stack: `web`, `auth.session`, `RequireTwoFactorAuthentication`, and `AdminAuthenticate`. In practice this means **a logged-in root admin session with 2FA passed** — same bar as the rest of the admin area.

Routes that render the UI return **HTML views**; everything the React/blade front-end consumes returns **JSON**. Both are listed below.

### Dashboard & Multi-Create

| Method | Path | Returns | Purpose |
| ------ | ---- | ------- | ------- |
| `GET` | `/admin/revamp` | HTML | Revamp admin dashboard (stats composed by `AdminDashboardStats`). |
| `GET` | `/admin/revamp/multicreate` | HTML | Multi-server create page. Redirects to node setup if no nodes exist. |
| `POST` | `/admin/revamp/multicreate` | JSON | Create up to **50 servers** in one call. |
| `GET` | `/admin/revamp/servers/filter-meta` | JSON | Filter metadata for the server list: `{tags, types, eggs, nodes, locations}`. |

`POST /admin/revamp/multicreate` payload:

```json
{
  "servers": [
    {
      "name": "Survival-01",
      "owner_id": 1,
      "node_id": 2,
      "nest_id": 1,
      "egg_id": 5,
      "allocation_id": 120,
      "memory": 4096,
      "swap": 0,
      "disk": 10240,
      "io": 500,
      "cpu": 200,
      "environment": { "SERVER_JARFILE": "server.jar" },
      "revamp_tag_ids": [1, 3]
    }
  ]
}
```

Each entry is validated against the panel's own `ServerFormRequest` rules — the same rules as the stock **Create Server** form. `revamp_tag_ids` is optional and syncs tags after creation. The response is per-server, so partial failures don't sink the batch:

```json
{
  "results": [
    { "success": true, "name": "Survival-01", "id": 512 },
    { "success": false, "name": "Survival-02", "error": "The allocation id field is required." }
  ],
  "summary": { "total": 2, "success": 1, "failed": 1 }
}
```

### Naming Pattern

| Method | Path | Returns | Purpose |
| ------ | ---- | ------- | ------- |
| `GET` | `/admin/revamp/naming/pattern` | JSON | Current naming pattern: `{ "pattern": "..." }`. |
| `POST` | `/admin/revamp/naming/preview` | JSON | Preview the auto-generated server name for the create form. |

Preview accepts optional `owner_id`, `node_id`, `egg_id`, `memory`, `disk`, `cpu`, `index`, and `batch_offset` (all integers) and resolves them against the pattern:

```json
{ "name": "Survival-513 - alice", "pattern": "{server_id} - {username}" }
```

### Settings

| Method | Path | Returns | Purpose |
| ------ | ---- | ------- | ------- |
| `GET` | `/admin/revamp/settings` | HTML | Settings page (all `revamp` settings). |
| `POST` | `/admin/revamp/settings` | Redirect | Save settings (flashes success, redirects back). |

Update payload keys and rules (all required):

| Key | Rule |
| --- | ---- |
| `naming_pattern` | string, max 191 |
| `allocation_page_size` | integer 10–200 |
| `metrics_retention_days` | integer 7–3650 |
| `upgrade_cpu_threshold` / `upgrade_ram_threshold` / `upgrade_disk_threshold` | integer 1–100 |
| `upgrade_window_hours` / `upgrade_cooldown_hours` | integer 1–8760 |
| `upgrade_message` | string, max 500 |
| `health_crash_threshold` | integer 1–100 |
| `health_window_hours` | integer 1–168 |
| `health_retention_days` | integer 1–365 |
| `bulk_move_enabled` | boolean |
| `node_pressure_warn_pct` | integer 1–99 |
| `node_pressure_crit_pct` | integer 1–100 |

::: danger `bulk_move_enabled` is off by default
Bulk move only **re-points panel database records** — it does not transfer server data via Wings, which would leave servers broken. Enable it only if you understand this; the service refuses the operation otherwise. Every settings save is written to the audit log as `settings.updated`.
:::

### Tags

| Method | Path | Returns | Purpose |
| ------ | ---- | ------- | ------- |
| `GET` | `/admin/revamp/tags` | HTML | Tag management page. |
| `GET` | `/admin/revamp/tags/list` | JSON | All tags as a flat array. |
| `POST` | `/admin/revamp/tags/settings` | Redirect | Save `tags_visible_to_users` (nullable boolean). |
| `POST` | `/admin/revamp/tags` | Redirect | Create a tag. |
| `PUT` | `/admin/revamp/tags/{tag}` | Redirect | Update a tag. |
| `DELETE` | `/admin/revamp/tags/{tag}` | Redirect | Delete a tag. |
| `GET` | `/admin/revamp/tags/by-servers?ids=1,2,3` | JSON | Tags grouped per server id. |
| `POST` | `/admin/revamp/tags/server/{serverId}` | JSON | Sync a server's tag set. |

Create/update payload (`StoreTagRequest`):

| Field | Rule |
| ----- | ---- |
| `name` | required, string, max 60 |
| `slug` | nullable, string, max 60, `alpha_dash`, unique per tag |
| `color` | required, hex `#rrggbb` |
| `icon` | nullable, string, max 40 |
| `is_default` | sometimes, boolean |

`by-servers` returns a map keyed by server id:

```json
{ "12": [{ "id": 3, "name": "Production", "color": "#22c55e", "icon": "check" }] }
```

`POST /tags/server/{serverId}` expects `{ "tag_ids": [1, 2] }` (required array, each must exist in `revamp_tags`) and replies `{ "success": true }`.

### Templates

| Method | Path | Returns | Purpose |
| ------ | ---- | ------- | ------- |
| `GET` | `/admin/revamp/templates` | HTML | Template library page. |
| `GET` | `/admin/revamp/templates/options` | JSON | All templates (for pickers). |
| `POST` | `/admin/revamp/templates` | Redirect | Create a template. |
| `POST` | `/admin/revamp/templates/{template}/save` | Redirect | Update metadata + save a new config revision. |
| `POST` | `/admin/revamp/templates/{template}/revision` | Redirect | Append a config revision only. |
| `POST` | `/admin/revamp/templates/{template}/clone` | Redirect | Clone with a new `name`. |
| `DELETE` | `/admin/revamp/templates/{template}` | Redirect | Delete a template. |
| `POST` | `/admin/revamp/templates/{template}/favorite` | JSON | Toggle favorite → `{ "favorited": true }`. |

Create payload: `name` (required, max 100), `category` (required, max 60), `description` (nullable, max 500), `is_default` (boolean), `config` (required array). Recognised `config` keys include `cpu`, `threads`, `memory`, `swap`, `disk`, `io`, `database_limit`, `allocation_limit`, `backup_limit`, `startup`, `image`, `custom_image`, `nest_id`, `egg_id`, `oom_disabled`, `skip_scripts`, and `tag_ids` — empty optional values are stripped so applying a template only touches fields that were actually configured.

### Allocation Picker

Cursor-paginated port picker data for a node.

| Method | Path | Purpose |
| ------ | ---- | ------- |
| `GET` | `/admin/revamp/allocations/{node}` | Page of allocations. Params: `search` (max 60), `free_only` (boolean), `per_page` (10–200). |
| `GET` | `/admin/revamp/allocations/{node}/next?current_port=25565` | Next free allocation above a port → `{ "allocation": {...} }`. |
| `GET` | `/admin/revamp/allocations/{node}/prev?current_port=25565` | Previous free allocation below a port. |
| `GET` | `/admin/revamp/allocations/{node}/random` | Random free allocation. |
| `POST` | `/admin/revamp/allocations/recents` | Record a selection. Body: `{ "allocation_id": 120 }` → `{ "success": true }`. |
| `GET` | `/admin/revamp/allocations/recents` | Recently used allocations for the current admin. |

### Bulk Operations

| Method | Path | Purpose |
| ------ | ---- | ------- |
| `POST` | `/admin/revamp/bulk` | Dispatch a bulk operation → `202` with a job UUID. |
| `POST` | `/admin/revamp/bulk/preflight` | Validate without dispatching → `{ "valid": true }` or `{ "valid": false, "error": "..." }`. |
| `GET` | `/admin/revamp/bulk/meta` | UI metadata: nodes with free allocation counts, tags, transfer strategies/modes. |
| `GET` | `/admin/revamp/bulk/{uuid}` | Poll job progress. |

Dispatch payload (`POST /admin/revamp/bulk`):

```json
{
  "type": "power",
  "server_ids": [101, 102, 103],
  "options": { "power_action": "restart" }
}
```

| Field | Rule |
| ----- | ---- |
| `type` | required, one of `suspend`, `unsuspend`, `delete`, `move`, `power`, `reinstall`, `tags_add`, `tags_remove` |
| `server_ids` | required array, 1–500 ids, each must exist in `servers` |
| `options.target_node_id` | required when `type=move`, must exist in `nodes` |
| `options.power_action` | required when `type=power`, one of `start`, `stop`, `restart`, `kill` |
| `options.tag_ids` | required when `type=tags_add`/`tags_remove`, each must exist in `revamp_tags` |

The `202` response gives you the polling handle:

```json
{ "uuid": "9f2c…", "total": 3, "status": "pending" }
```

`GET /admin/revamp/bulk/{uuid}` returns full progress:

```json
{
  "uuid": "9f2c…",
  "type": "power",
  "label": "Power actions",
  "status": "running",
  "total": 3,
  "processed": 2,
  "failed": 0,
  "skipped": 0,
  "succeeded": 2,
  "progress_pct": 66,
  "started_at": "2026-07-31T15:00:00+00:00",
  "finished_at": null,
  "items": [
    { "server_id": 101, "status": "success", "error": null },
    { "server_id": 102, "status": "success", "error": null },
    { "server_id": 103, "status": "pending", "error": null }
  ]
}
```

The work itself runs on the `revamp` queue — keep the [queue worker](/pterodactyl-revamp/user-guide/cli#queue-worker) running.

### Search

| Method | Path | Purpose |
| ------ | ---- | ------- |
| `GET` | `/admin/revamp/search?q=...` | Global search across the panel. `q` required, max 100 chars. |

Returns grouped matches:

```json
{ "servers": [], "users": [], "allocations": [], "nodes": [], "tags": [] }
```

### Analytics

| Method | Path | Purpose |
| ------ | ---- | ------- |
| `GET` | `/admin/revamp/analytics/series/{server}?hours=72` | Downsampled chart series. `hours` clamped to 1–8760 (default 72). |
| `GET` | `/admin/revamp/analytics/recommendations/{server}` | Active (non-dismissed, not cooling down) recommendations for a server. |
| `POST` | `/admin/revamp/analytics/recommendations/{recommendation}/dismiss` | Dismiss a recommendation → `{ "success": true }`. |

Series response:

```json
{ "server_id": 512, "hours": 72, "series": [ /* downsampled points */ ] }
```

Recommendations carry `id`, `type`, `rule_key`, `message`, `evidence`, and `created_at`.

### Health

| Method | Path | Returns | Purpose |
| ------ | ---- | ------- | ------- |
| `GET` | `/admin/revamp/health` | HTML | Health overview (node pressure scores, recently unstable servers). |
| `GET` | `/admin/revamp/health/nodes/{node}` | JSON | Latest node snapshot + last 48 snapshots of history. |
| `GET` | `/admin/revamp/health/servers/{server}` | JSON | Latest server snapshot + last 48 snapshots of history. |
| `GET` | `/admin/revamp/health/node-recommendations?memory_mb=4096` | JSON | Top 5 placement nodes for a workload. |

Node detail response:

```json
{
  "node": { "id": 2, "name": "node-eu-1", "fqdn": "node1.example.com", "memory": 65536, "disk": 512000 },
  "latest": { /* full RevampNodeHealthSnapshot */ },
  "history": [
    { "snapshot_at": "…", "health_score": 87, "status": "healthy", "allocation_used_pct": 42, "memory_used_pct": 61 }
  ]
}
```

Node recommendations rank nodes by composite score and include the reasons:

```json
[
  { "node_id": 2, "node_name": "node-eu-1", "composite_score": 0.83, "mem_pct": 61, "alloc_pct": 42, "reasons": ["…"] }
]
```

### Activity & Audit

| Method | Path | Returns | Purpose |
| ------ | ---- | ------- | ------- |
| `GET` | `/admin/revamp/activity` | JSON | Unified activity feed (core `activity_logs` ∪ `revamp_events`), paginated. |
| `GET` | `/admin/revamp/audit` | HTML | Admin audit log (50 per page). |

Activity params: `server_id`, `node_id`, `event` (substring match, max 80), `per_page` (10–100, default 25). Each row carries `source` (`core` or `revamp`), `event`, `server_id`, `node_id`, and `payload`. The audit page filters by `action` (substring) and `actor_id`.

---

## Application API

Mounted under `/api/application/revamp` behind `api`, `application-api`, and `throttle:api.application`, plus the addon's own **`RequireRevampRootAdmin`** middleware: possessing an application API key is not enough — the key's **owning user must be a root admin**, or every route returns:

```http
HTTP/1.1 403 Forbidden
```

> Revamp API access requires a root administrator account.

All endpoints below reuse the admin controllers, so payloads, validation rules, and response shapes are identical to the [Admin Session API](#admin-session-api) sections above.

### Endpoints

| Method | Path | Mirrors |
| ------ | ---- | ------- |
| `GET` | `/api/application/revamp/tags` | List tags |
| `POST` | `/api/application/revamp/tags` | Create tag |
| `PUT` | `/api/application/revamp/tags/{tag}` | Update tag |
| `DELETE` | `/api/application/revamp/tags/{tag}` | Delete tag |
| `GET` | `/api/application/revamp/templates` | List templates |
| `POST` | `/api/application/revamp/templates` | Create template |
| `POST` | `/api/application/revamp/bulk` | Dispatch bulk operation |
| `GET` | `/api/application/revamp/bulk/{uuid}` | Poll bulk job status |
| `GET` | `/api/application/revamp/search?q=...` | Global search |
| `GET` | `/api/application/revamp/analytics/{server}/series` | Metric series |
| `GET` | `/api/application/revamp/analytics/{server}/recommendations` | Server recommendations |
| `GET` | `/api/application/revamp/health/nodes/{node}` | Node health detail |
| `GET` | `/api/application/revamp/health/servers/{server}` | Server health detail |
| `GET` | `/api/application/revamp/health/node-recommendations` | Placement recommendations |
| `GET` | `/api/application/revamp/settings` | Settings page |

::: warning The settings mirror returns HTML
`GET /api/application/revamp/settings` reuses `RevampSettingsController@index`, which renders the settings **view** — it does not return a JSON settings object. All other application-API endpoints behave like their admin counterparts.
:::

::: info Route-model binding
`{tag}`, `{template}`, `{server}`, and `{node}` are route-model bound — pass the numeric id. Scoped bindings are enabled for this route group.
:::

### curl Example

Dispatch a bulk suspend across three servers with an application API key:

```bash
curl -X POST "https://panel.example.com/api/application/revamp/bulk" \
  -H "Authorization: Bearer pl_app_yourkeyhere" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -d '{
    "type": "suspend",
    "server_ids": [101, 102, 103]
  }'
```

Response (`202 Accepted`):

```json
{ "uuid": "9f2c8d1e-…", "total": 3, "status": "pending" }
```

Then poll until `status` is `finished`:

```bash
curl "https://panel.example.com/api/application/revamp/bulk/9f2c8d1e-…" \
  -H "Authorization: Bearer pl_app_yourkeyhere" \
  -H "Accept: application/json"
```

---

## Client API — Server Tags

Registered by the Blueprint extension as a client router (`blueprint/pterodactylrevamp/routes/blueprint/client/revamp.php`), mounted under the client API with `ServerSubject` + `AuthenticateServerAccess` — i.e. any **client API key with access to that server** (owner or subuser).

| Method | Path | Purpose |
| ------ | ---- | ------- |
| `GET` | `/api/client/servers/{server}/tags` | Read the tags assigned to a server. |

The endpoint is gated by the `tags_visible_to_users` admin setting. When visibility is off, the response is deliberately empty rather than an error:

```json
{ "visible": false, "tags": [] }
```

When enabled, `tags` contains the full tag objects (`id`, `name`, `slug`, `color`, `icon`, `is_default`, timestamps):

```json
{
  "visible": true,
  "tags": [
    {
      "id": 3,
      "name": "Production",
      "slug": "production",
      "color": "#22c55e",
      "icon": "check",
      "is_default": false,
      "created_at": "2026-07-01T10:00:00.000000Z",
      "updated_at": "2026-07-01T10:00:00.000000Z"
    }
  ]
}
```

Tags are **read-only** from the client side — assignment happens through the admin UI or the application API.

---

## What's Next?

- **[CLI & Artisan Commands →](/pterodactyl-revamp/user-guide/cli)** — the scheduled commands and queue worker that keep these endpoints fed with data.
- **[Installation →](/pterodactyl-revamp/getting-started/installation)** — get the addon installed before wiring up integrations.
