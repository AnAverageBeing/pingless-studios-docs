---
title: Configuration Reference
description: Every Blue Mod Installer setting — admin options, search parameters, and the conf.yml manifest.
---

# Configuration Reference

## Admin settings

Managed at **Admin → Extensions → Blue Mod Installer** (`/admin/extensions/bluemodinstaller`). Values are stored by Blueprint's extension settings store and take effect immediately (the extension caches them under the `bluemodinstaller_settings` cache key, which is flushed on save).

| Setting | Type | Default | Description |
|---|---|---|---|
| `curseforge_api_key` | string (max 255) | *(empty)* | Your CurseForge API key, sent as `X-API-Key` on every CurseForge request. **Server-side only** — users never see it. Leave empty to disable CurseForge (Modrinth still works). Get a key at <https://console.curseforge.com/>. |
| `default_provider` | `modrinth` \| `curseforge` | `modrinth` | Provider pre-selected when a user opens the Mod Installer tab. |
| `default_page_size` | `6` \| `12` \| `24` \| `48` | `6` | Results per page in the search grid. |

::: tip CurseForge keys
Rotating the key is safe — save the form and the next search uses the new key. A missing or invalid key surfaces as a provider error in the UI, not a panel error.
:::

## Search parameters

These are the query parameters accepted by the search endpoint (used by the UI; documented for custom API clients — see [API Reference](../user-guide/api)):

| Parameter | Type | Default | Notes |
|---|---|---|---|
| `provider` | `modrinth` \| `curseforge` | `modrinth` | Which provider to query. |
| `page` | int ≥ 1 | `1` | Page number. |
| `page_size` | int | `6` | Results per page. |
| `search_query` | string | *(empty)* | Free-text search. |
| `loader` | string | *(empty)* | Loader filter (e.g. `fabric`, `forge`, `quilt`, `neoforge`). Empty = all loaders. |
| `sort_by` | string | provider default | Modrinth: `relevance`, `downloads`, `follows`, `newest`, `updated` (fallback `downloads`). CurseForge: numeric sort field (fallback `6` = total downloads). |
| `minecraft_version` | string | *(empty)* | MC version filter, e.g. `1.20.1`. Empty = all versions. |

::: info Behavior since 1.12.4
Omitting `sort_by` or `loader` previously produced a `500` (the empty values
were forwarded to the provider verbatim). Since 1.12.4 the backend applies the
defaults above and skips empty facets.
:::

## Extension manifest (`conf.yml`)

Located at `blueprint/bluemodinstaller/conf.yml` in the repo. You normally never edit these — Blueprint reads them at install time.

| Key | Value | Purpose |
|---|---|---|
| `info.identifier` | `bluemodinstaller` | Extension identifier — used in all paths and URLs. |
| `info.version` | `1.12.4` | Extension version (shown on the admin page). |
| `info.target` | `beta-2026-06` | Blueprint version the extension targets. |
| `info.compatibility` | `beta-2026-01/02/05/06` | Blueprint versions accepted at install time. |
| `admin.view` / `admin.controller` | `view.blade.php` / `controller.php` | The admin settings page. |
| `dashboard.components` | `components` | React components mounted by Blueprint's build. |
| `requests.app` | `controllers` | Client API controllers. |
| `requests.routers.client` | `routes.php` | Client API router, mounted at `/api/client/extensions/bluemodinstaller`. |
