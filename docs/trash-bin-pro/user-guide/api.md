---
title: API Reference
description: Trash Bin Pro REST APIs — the Pterodactyl client API endpoints (trash listing, restore, quota, empty) and the admin panel routes.
---

# API Reference

Two REST surfaces:

- **Client API** — panel-side endpoints under the Pterodactyl client API (`/api/client/servers/{server}/files/...`), used by the file manager UI and any integrations. Authenticated with a normal Pterodactyl **client API key**, subject to subuser permissions.
- **Admin routes** — browser session routes under `/admin/trashbinpro` for the settings panel.

---

## Client API (panel)

Base URL: `/api/client/servers/{server}/files` — where `{server}` is the server UUID (or short identifier) used everywhere else in the client API.

Trash Bin Pro patches the stock `FileController` in place (intercepting directory listing and delete) and adds three new routes. All five endpoints together:

| Method | Path | Permission | Description |
|--------|------|-----------|-------------|
| `GET` | `/files?directory=/.trash` | `file.read` + `trashbinpro.access` | List trash entries for the server. |
| `POST` | `/files/delete` | `file.delete` (+ `trashbinpro.access` inside trash) | Move files to trash, or permanently delete from trash. |
| `POST` | `/files/restore` | `trashbinpro.access` | Restore entries from trash. **Throttled: 10/min.** |
| `GET` | `/files/trash-quota` | `file.read` | Quota and retention status for the server. |
| `POST` | `/files/trash/empty` | `trashbinpro.access` | Permanently delete every trash entry. **Throttled: 10/min.** |

::: tip The `trashbinpro.access` permission
Grant subusers access in the server's **Users** tab: **Trash Bin Pro → Access**. Restore, delete-from-trash, trash listing, and empty-trash all enforce it server-side. Without it, subusers can still delete files (moved to trash) via their normal `file.delete` permission, but they cannot see or manage the trash.
:::

### Trash listing — `GET /files?directory=/.trash`

Requesting the special directory `/.trash` returns the server's trash entries instead of a Wings directory listing — the panel answers from the `trashbin_files` table and never touches Wings for this path (the physical folder may not exist yet).

Each entry is an object of type `trash_bin_file_object`:

```json
{
  "object": "trash_bin_file_object",
  "attributes": {
    "name": "plugins/broken-plugin.jar",
    "mode": "0644",
    "mode_bits": 420,
    "size": 184320,
    "is_file": true,
    "is_symlink": false,
    "is_trash": true,
    "trash_id": 42,
    "mimetype": "application/octet-stream",
    "created_at": "2026-07-31T12:04:11+00:00",
    "modified_at": "2026-07-31T12:04:11+00:00"
  }
}
```

Notable fields:

- `name` is the **original path** of the file relative to the container root (no leading slash) — not a filename inside `.trash`.
- `trash_id` is the numeric ID used by the restore and delete-from-trash endpoints.
- `is_trash` is always `true` and `mimetype` is always `application/octet-stream` for trash entries; normal file objects carry `is_trash: false` and `trash_id: null`.
- `created_at` / `modified_at` are both the deletion timestamp (when the file entered the trash). Entries are returned newest first.

### Delete — `POST /files/delete`

This is the stock Pterodactyl delete endpoint with trash-aware behavior patched in.

```json
{
  "root": "/",
  "files": ["plugins/broken-plugin.jar"]
}
```

| `root` value | `permanent` flag | Behavior |
|--------------|------------------|----------|
| Anything except `/.trash` | omitted/falsy | Files are **moved to trash**: rows created in `trashbin_files`, files renamed to `.trash/{id}` on the daemon. Returns `204`. |
| Anything except `/.trash` | truthy | Original Pterodactyl **hard delete** (bypasses trash entirely). Returns `204`. |
| `/.trash` | ignored | `files` must be **trash IDs** (as strings). Entries are permanently deleted from trash. Requires `trashbinpro.access`. Returns `204`. |

::: warning Server-side guard
The service refuses to trash the trash directory itself: a `root` of `.trash`/`/.trash`, or any resolved path equal to `.trash` or starting with `.trash/`, is rejected with a display exception. If the addon is globally disabled, the move-to-trash path transparently falls back to a permanent delete.
:::

#### Quota errors — `409 Conflict`

When a per-server / per-egg / global quota blocks a move-to-trash, the endpoint returns `409` in the standard Pterodactyl error envelope:

```json
{
  "errors": [
    {
      "code": "FileTooLargeForTrash",
      "detail": "This file is too large to fit in the Trash Bin.",
      "meta": { "file_size": 5368709120, "cap_bytes": 1073741824 }
    }
  ]
}
```

| `errors[].code` | Trigger | `meta` payload |
|-----------------|---------|----------------|
| `FileTooLargeForTrash` | A single file is larger than the effective cap. | `file_size`, `cap_bytes` |
| `TrashBinFull` | `used_bytes + incoming > cap`. | `used_bytes`, `cap_bytes`, `incoming_bytes` |

`cap_bytes` of `0` means unlimited — quota errors only occur when an effective cap is configured.

### Restore — `POST /files/restore`

Restores one or more trash entries to their original paths. Throttled to **10 requests/minute**; body is validated by `RestoreFilesRequest` (`files` is a required array of integers).

```json
{ "files": [42, 43] }
```

Returns `204 No Content` on success.

Collision handling: if the original path is occupied, the restored file is renamed to `name (restored)`, then `name (restored 2)`, and so on. Entries whose recorded path points inside `.trash` are treated as ghosts — the row is cleaned up and the entry is skipped.

### Quota — `GET /files/trash-quota`

Returns the effective quota and retention for this server (server override → egg override → global default):

```json
{
  "object": "trash_quota",
  "attributes": {
    "enabled": true,
    "cap_bytes": 1073741824,
    "used_bytes": 268435456,
    "retention_hours": 24
  }
}
```

`cap_bytes: 0` means unlimited. `retention_hours` is how long entries live before the hourly purge removes them.

### Empty trash — `POST /files/trash/empty`

Permanently deletes **every** trash entry for the server, regardless of retention. Throttled to **10 requests/minute**. Send an empty POST body — no `files` parameter.

Returns `204 No Content`.

::: danger Irreversible
Empty-trash bypasses the retention window and deletes immediately. The operation cannot be undone.
:::

### curl examples

All examples use a client API key (`ptlc_...`):

```bash
PANEL="https://panel.example.com"
KEY="ptlc_your_client_api_key"
SERVER="1a7ce997"   # server identifier

# Trash quota / retention status
curl -s "$PANEL/api/client/servers/$SERVER/files/trash-quota" \
  -H "Authorization: Bearer $KEY" \
  -H "Accept: application/json"

# Restore two trash entries by ID
curl -s -X POST "$PANEL/api/client/servers/$SERVER/files/restore" \
  -H "Authorization: Bearer $KEY" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -d '{"files": [42, 43]}'

# Empty the entire trash (immediate, permanent)
curl -s -X POST "$PANEL/api/client/servers/$SERVER/files/trash/empty" \
  -H "Authorization: Bearer $KEY" \
  -H "Accept: application/json"
```

---

## Admin routes

Browser-session routes under `/admin`, protected by the standard admin middleware stack (`auth.session` + two-factor authentication + admin check). These back the settings panel at `/admin/trashbinpro` — they are not REST API endpoints and are not callable with an API key.

| Method | Path | Route name | Description |
|--------|------|-----------|-------------|
| `GET` | `/admin/trashbinpro` | `admin.trashbinpro.settings` | Render the Trash Bin Pro settings page. |
| `POST` | `/admin/trashbinpro` | `admin.trashbinpro.settings.update` | Save global settings (enabled, retention, default quota, purge batch, logging). |
| `POST` | `/admin/trashbinpro/reset` | `admin.trashbinpro.settings.reset` | Reset global settings to defaults. |
| `POST` | `/admin/trashbinpro/egg` | `admin.trashbinpro.egg.upsert` | Create or update a per-egg quota/retention override. |
| `POST` | `/admin/trashbinpro/egg/{egg}/delete` | `admin.trashbinpro.egg.delete` | Remove a per-egg override. |
| `POST` | `/admin/trashbinpro/purge-now` | `admin.trashbinpro.purge` | Run the retention purge immediately instead of waiting for the hourly schedule. |

---

## See also

- [Configuration Reference](../configuration/reference) — every setting, quota, and retention option and how overrides resolve.
