---
title: Configuration Reference
description: Every Blue Plugin Installer setting — the admin option, search parameters, and the conf.yml manifest.
---

# Configuration Reference

## Admin settings

Managed at **Admin → Extensions → Blue Plugin Installer** (`/admin/extensions/blueplugininstaller`). Values are stored by Blueprint's extension settings store.

| Setting | Type | Default | Description |
|---|---|---|---|
| `curseforge_api_key` | string | *(empty)* | Your CurseForge API key, sent as `x-api-key` on every CurseForge request. **Server-side only** — users never see it. Leave empty to disable CurseForge (the other four providers still work). Get a key at <https://console.curseforge.com/>. The key is required by the settings form; paste any placeholder if you only use other providers. |

::: tip Which providers need keys?
Only **CurseForge**. Modrinth, Hangar, SpigotMC (via the Spiget API), and Polymart are queried without credentials.
:::

## Search parameters

Query parameters accepted by the search endpoint (used by the UI; documented for custom API clients — see [API Reference](../user-guide/api)):

| Parameter | Type | Default | Notes |
|---|---|---|---|
| `category` | string | `modrinth` | Provider: `modrinth`, `curseforge`, `hangar`, `spigotmc`, `polymart`. |
| `page` | int ≥ 1 | `1` | Page number. |
| `page_size` | int | `6` | Results per page. |
| `search_query` | string | *(empty)* | Free-text search. |
| `type` | string | *(empty)* | Loader/type filter (e.g. `bukkit`, `paper`, `spigot`). Empty = all types. |
| `sort_by` | string | provider default | Modrinth: `relevance`, `downloads`, `follows`, `newest`, `updated` (fallback `downloads`). CurseForge: numeric sort field (fallback `6` = total downloads). |
| `minecraft_version` | string | *(empty)* | MC version filter, e.g. `1.20.1`. Empty = all versions. |

::: info Behavior since 1.0.3
Omitting `sort_by` or `type` previously produced a `500` (the empty values
were forwarded to the provider verbatim). Since 1.0.3 the backend applies the
defaults above and skips empty facets.
:::

## Extension manifest (`conf.yml`)

Located at `blueprint/blueplugininstaller/conf.yml` in the repo. You normally never edit these — Blueprint reads them at install time.

| Key | Value | Purpose |
|---|---|---|
| `info.identifier` | `blueplugininstaller` | Extension identifier — used in all paths and URLs. |
| `info.version` | `1.0.3` | Extension version (shown on the admin page). |
| `info.target` | `beta-2026-06` | Blueprint version the extension targets. |
| `info.compatibility` | `beta-2026-01/02/05/06` | Blueprint versions accepted at install time. |
| `admin.view` / `admin.controller` | `view.blade.php` / `controller.php` | The admin settings page. |
| `dashboard.components` | `components` | React components mounted by Blueprint's build. |
| `requests.app` | `controllers` | Client API controllers. |
| `requests.routers.client` | `routes.php` | Client API router, mounted at `/api/client/extensions/blueplugininstaller`. |
