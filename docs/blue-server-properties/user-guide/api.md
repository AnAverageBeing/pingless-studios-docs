---
title: API Reference
description: Blue Server Properties Editor client API endpoints — nav label, fetch, and update.
---

# API Reference

Endpoints require a **client API key** (`Authorization: Bearer ptlc_…`) with access to the target server.

**Base URL (Blueprint paths):** `/api/client/extensions/blueserverproperties`
**Base URL (Blueprint-free variant):** `/api/client/servers/{server}/servercfg`

| Endpoint | Method | Permission | Purpose |
|---|---|---|---|
| `/settings/nav-text` | GET | any client key | Custom tab label |
| `/{server}` | GET | server access | Read parsed `server.properties` |
| `/{server}/update` | POST | server access | Write `server.properties` |

`{server}` is the server's UUID. On the Blueprint-free variant, fetching requires `file.read` and updating requires `file.update`, plus the `MinecraftServerCheck` middleware (404 on non-Minecraft nests).

---

## Get the tab label

```
GET /settings/nav-text
```

**Response `200`:**

```json
{ "text": "Server Properties" }
```

Reads `storage/app/blueserverproperties_config.json`; falls back to the default label when no custom text is set. Blueprint paths only.

---

## Fetch the config

```
GET /{server}
```

The panel reads the server's `server.properties` through Wings and returns it parsed — nothing is cached.

**Response `200`:**

```json
{
  "items": [
    {
      "name": "difficulty",
      "rawValue": "normal",
      "inputType": "dropdown",
      "options": ["peaceful", "easy", "normal", "hard"]
    },
    {
      "name": "spawn-monsters",
      "rawValue": "true",
      "inputType": "toggle",
      "options": []
    },
    {
      "name": "motd",
      "rawValue": "A Minecraft Server",
      "inputType": "text",
      "options": []
    }
  ],
  "defaults": {
    "difficulty": "normal",
    "spawn-monsters": true,
    "motd": "A Minecraft Server"
  }
}
```

- Keys are normalized (dots → dashes).
- `inputType` is `toggle` for `true/false` values, `dropdown` for `difficulty`/`gamemode`, `text` otherwise.

**Errors:** `400` with *"Unable to retrieve server configuration file."* when Wings can't read the file (missing file, node offline); `400` *"only available for Minecraft servers"* on non-Minecraft nests (Blueprint path).

---

## Update the config

```
POST /{server}/update
Content-Type: application/json

{
  "data": {
    "difficulty": "hard",
    "spawn-monsters": "false",
    "motd": "My Cool Server"
  }
}
```

| Field | Required | Description |
|---|---|---|
| `data` | yes | Map of normalized key → new value. Keys not present keep their current value. |

The panel rewrites only `key=value` lines (comments and unknown lines are preserved) and writes the file back through Wings.

**Response `200`:**

```json
{ "success": true }
```

**Errors:** `400` with *"Unable to retrieve server configuration file."* when the read fails, *"Failed to update configuration. Please try again."* when the Wings write fails.
