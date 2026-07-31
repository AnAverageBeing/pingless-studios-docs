---
title: Client API
description: Ask Access REST API — every endpoint under the client API, with request bodies and responses.
---

# Client API

All endpoints live under the panel's authenticated client API, so they work with the logged-in session or a client API key, and are covered by the panel's global rate limiter.

```
Base URL: /api/client/extensions/pterodactylaskaccess/access
```

Authorization is enforced per-record in the service layer: a user can only act on their own requests, blocks, settings, and grants on servers they own or manage.

---

## Bootstrap

```
GET /bootstrap
```

Everything the Server Access page needs in one call.

```json
{
  "enabled": true,
  "settings": { "accept_requests": true, "default_preset": "standard" },
  "presets": ["read", "standard", "full"],
  "preset_permissions": { "read": ["websocket.connect", "..."], "standard": ["..."], "full": ["..."] },
  "sent": [ /* outgoing requests */ ],
  "received": [ /* incoming requests */ ],
  "blocks": [ { "id": 1, "username": "user", "email": "u@example.com" } ]
}
```

If the admin policy excludes the caller, returns `{ "enabled": false, "message": "..." }`.

---

## Requests

### Create a request

```
POST /requests
```

| Field | Type | Required | Notes |
|---|---|---|---|
| `type` | `server` · `user` | yes | Single server vs. all of a user's servers |
| `identifier` | string | yes | Server UUID/short ID, or owner email |
| `preset` | `read` · `standard` · `full` | no | Defaults to `standard` |
| `message` | string ≤ 500 | no | Shown to the owner; HTML stripped |

Returns `201` with `{ success, message, request? }`. Email-scope requests return a neutral response without a `request` object when the target doesn't exist or isn't eligible — this is intentional (anti-enumeration).

### Requester actions

```
POST /requests/{id}/cancel      → cancel a pending outgoing request
DELETE /requests/sent/{id}      → hide a handled outgoing request from your list
```

### Owner actions

```
POST /requests/{id}/approve
POST /requests/{id}/deny
POST /requests/{id}/revoke      → revoke a live approved grant
DELETE /requests/received/{id}  → hide a handled incoming request from your list
```

Approve body (all optional):

| Field | Type | Notes |
|---|---|---|
| `preset` | `read` · `standard` · `full` | Overrides the requested preset |
| `access_type` | `permanent` · `temporary` | Default `permanent` |
| `duration_hours` | int 1–8760 | **Required** when `access_type` is `temporary` |

### Request object shape

```json
{
  "id": 12,
  "direction": "received",
  "scope": "server",
  "status": "pending",
  "permission_preset": "standard",
  "access_type": "temporary",
  "access_expires_at": "2026-07-21T20:00:00+00:00",
  "access_revoked_at": null,
  "active": false,
  "message": "Need console access to debug the modpack",
  "requester": { "username": "steve", "email": "steve@example.com" },
  "server": { "name": "Survival", "identifier": "1a2b3c4d" },
  "expires_at": "2026-07-21T18:00:00+00:00",
  "created_at": "2026-07-20T18:00:00+00:00",
  "can_respond": true,
  "can_revoke": false
}
```

`status` is one of `pending`, `approved`, `denied`, `cancelled`, `expired`. In the **sent** direction the owner's email is masked (`s****@example.com`).

---

## Settings & blocks

```
PATCH /settings     { "accept_requests": false }  and/or  { "default_preset": "read" }
POST /blocks        { "email": "spammer@example.com" }   → 201
DELETE /blocks/{id}
```

Blocking also auto-denies every pending request from that user to you.

---

## Active grant management

### List active access

```
GET /active
```

```json
{
  "grantees": [
    {
      "user_id": 5,
      "username": "alex",
      "email": "alex@example.com",
      "servers": [
        {
          "server_id": 3,
          "name": "Survival",
          "identifier": "1a2b3c4d",
          "permissions": ["websocket.connect", "control.console"],
          "is_manager": false,
          "access_type": "temporary",
          "access_expires_at": "2026-07-21T20:00:00+00:00"
        }
      ]
    }
  ],
  "manageable_servers": [ { "server_id": 3, "name": "Survival", "identifier": "1a2b3c4d" } ],
  "permission_catalog": [ { "group": "control", "description": "...", "keys": [...] } ]
}
```

Covers every server the caller owns **or** holds `accessmanager.manage` on.

### Manage grants

```
POST /grants
PATCH /grants/permissions
PATCH /grants/expiry
DELETE /grants
```

| Endpoint | Body | Effect |
|---|---|---|
| `POST /grants` | `server_id`, `user_id` or `email`, `permissions[]`?, `access_type`?, `duration_hours`? | Add/update a subuser on one of your servers. Default permissions = `standard` preset. `201` |
| `PATCH /grants/permissions` | `server_id`, `user_id`, `permissions[]` | Replace a grantee's permission set |
| `PATCH /grants/expiry` | `server_id`, `user_id`, `access_type`, `duration_hours`? | Switch permanent ↔ temporary |
| `DELETE /grants` | `server_id`, `user_id` | Remove access (subuser deleted, SFTP sessions revoked) |

All permission arrays are sanitized server-side against the panel's registered permission list — unknown strings are dropped and `websocket.connect` is always added.

---

## Errors

Failures return the panel's standard error envelope; user-facing problems come back as `DisplayException` messages, e.g.:

```json
{ "errors": [ { "code": "DisplayException", "status": "400", "detail": "You already have a pending request for this server." } ] }
```

| Status | Meaning |
|---|---|
| `400` | Validation failure or a rule violation (duplicate request, not pending, self-block, …) |
| `404` | Route missing — addon not installed or route cache stale |
| `429` | Rate limited (global API limiter or the block-action throttle) |
