---
title: API Reference
description: Blue Plugin Installer client API endpoints — search, versions, and install.
---

# API Reference

All endpoints live under the extension's client API prefix and require a **client API key** (`Authorization: Bearer ptlc_…`) with access to the target server.

**Base URL:** `/api/client/extensions/blueplugininstaller`

| Endpoint | Method | Permission | Purpose |
|---|---|---|---|
| `/servers/{server}/blueplugininstaller` | GET | `file.read` | Search/list plugins |
| `/servers/{server}/blueplugininstaller/version` | GET | `file.read` | List a plugin's versions |
| `/servers/{server}/blueplugininstaller/install` | POST | `file.create` | Install a plugin into `/plugins` |

`{server}` is the server's UUID.

---

## Search plugins

```
GET /servers/{server}/blueplugininstaller?category=modrinth&page=1&page_size=6&search_query=&type=paper&sort_by=downloads&minecraft_version=
```

Query parameters are documented in the [Configuration Reference](../configuration/reference#search-parameters) — all are optional.

**Response `200`:**

```json
{
  "data": [
    {
      "category": "modrinth",
      "id": "6A5T39pE",
      "name": "ViaVersion",
      "description": "Allows newer clients to join older servers",
      "icon": "https://cdn.modrinth.com/data/6A5T39pE/icon.png",
      "downloads": 12000000,
      "pluginUrl": "https://modrinth.com/plugin/6A5T39pE",
      "installable": true
    }
  ],
  "pagination": {
    "total": 500,
    "count": 6,
    "per_page": 6,
    "current_page": 1,
    "total_pages": 84
  }
}
```

**Errors:** mirrors the provider's HTTP status when a provider request fails (with the provider response body), `403` when the API key lacks `file.read`.

---

## List versions

```
GET /servers/{server}/blueplugininstaller/version?category=modrinth&pluginId=6A5T39pE
```

| Parameter | Required | Description |
|---|---|---|
| `category` | yes | `modrinth`, `curseforge`, `hangar`, `spigotmc`, `polymart` |
| `pluginId` | yes | The plugin's id on that provider |

**Response `200`:**

```json
{
  "data": [
    {
      "category": "modrinth",
      "versionId": "uW7X9kLm",
      "versionName": "ViaVersion 5.0.0",
      "downloads": 234567,
      "downloadUrl": null
    }
  ]
}
```

**Errors:** `404` when the provider lookup fails.

---

## Install a plugin

```
POST /servers/{server}/blueplugininstaller/install
Content-Type: application/json

{
  "category": "modrinth",
  "pluginId": "6A5T39pE",
  "versionId": "uW7X9kLm"
}
```

| Field | Required | Description |
|---|---|---|
| `category` | yes | The provider |
| `pluginId` | yes | The plugin's id |
| `versionId` | no | Specific version; omit for the latest |

The panel **downloads** the plugin file from the provider into local temp storage, **uploads** it to the server through Wings (short-lived node JWT), then deletes the temp copy.

**Response `200`:**

```json
{ "status": "success" }
```

**Errors:** `500` when the provider download fails or the Wings upload is rejected (node offline, disk full, …), `403` when the API key lacks `file.create`.

::: warning `/plugins` must exist on the server
Installs target the `/plugins` directory of the server's filesystem — i.e. Bukkit/Spigot/Paper-style servers.
:::
