---
title: API Reference
description: Blue Mod Installer client API endpoints — search, versions, and install.
---

# API Reference

All endpoints live under the extension's client API prefix and require a **client API key** (`Authorization: Bearer ptlc_…`) with access to the target server.

**Base URL:** `/api/client/extensions/bluemodinstaller`

| Endpoint | Method | Permission | Purpose |
|---|---|---|---|
| `/servers/{server}` | GET | `file.read` | Search/list mods |
| `/servers/{server}/version` | GET | `file.read` | List a mod's versions |
| `/servers/{server}/install` | POST | `file.create` | Install a mod into `/mods` |

`{server}` is the server's UUID.

---

## Search mods

```
GET /servers/{server}?provider=modrinth&page=1&page_size=6&search_query=&loader=fabric&sort_by=downloads&minecraft_version=
```

Query parameters are documented in the [Configuration Reference](../configuration/reference#search-parameters) — all are optional.

**Response `200`:**

```json
{
  "data": [
    {
      "provider": "modrinth",
      "id": "AANobbMI",
      "name": "Sodium",
      "description": "A modern rendering engine...",
      "icon": "https://cdn.modrinth.com/data/AANobbMI/icon.png",
      "downloads": 34000000,
      "url": "https://modrinth.com/mod/AANobbMI"
    }
  ],
  "pagination": {
    "total": 1234,
    "count": 6,
    "per_page": 6,
    "current_page": 1,
    "total_pages": 206
  }
}
```

**Errors:** `503` if the provider request fails (e.g. bad CurseForge key), `500` for unexpected provider errors.

---

## List versions

```
GET /servers/{server}/version?provider=modrinth&modId=AANobbMI
```

| Parameter | Required | Description |
|---|---|---|
| `provider` | yes | `modrinth` or `curseforge` |
| `modId` | yes | The mod's id on that provider |

**Response `200`:**

```json
{
  "data": [
    {
      "provider": "modrinth",
      "versionId": "T3PxXQ8x",
      "versionName": "Sodium 0.6.0 for Minecraft 1.21.1",
      "game_versions": ["1.21.1"],
      "loaders": ["fabric"],
      "downloads": 123456
    }
  ]
}
```

---

## Install a mod

```
POST /servers/{server}/install
Content-Type: application/json

{
  "provider": "modrinth",
  "modId": "AANobbMI",
  "versionId": "T3PxXQ8x"
}
```

| Field | Required | Description |
|---|---|---|
| `provider` | yes | `modrinth` or `curseforge` |
| `modId` | yes | The mod's id |
| `versionId` | no | Specific version; omit for the latest |

The panel resolves the real download URL for the version and has Wings **pull** the file into the server's `/mods` directory in the foreground (the request blocks until the pull finishes).

**Response `200`:**

```json
{ "status": "success", "message": "Mod installed successfully" }
```

**Errors:** `503` when the provider lookup fails or Wings cannot complete the pull (node offline, disk full, …), `403` when the API key lacks `file.create`.

::: warning `/mods` must exist on the server
The pull targets the `/mods` directory of the server's filesystem — i.e. Forge/Fabric/NeoForge-style servers. Vanilla servers don't load mods.
:::
