---
title: API Reference
description: Complete reference for both Bandwidth Monitor APIs — the node agent REST API on port 8480 (health, stats, history, limits, unthrottle) and the panel's node-facing API (register, heartbeat, limits, events, suspend), with envelopes, error codes, and curl examples.
---

# API Reference

Bandwidth Monitor has **two APIs**, one in each direction:

| API | Implemented by | Base URL | Consumers |
| --- | --- | --- | --- |
| **Node agent API** | the Go agent (`bandwidth-noded`) on each Wings node | `http(s)://<node>:8480/api/v1` | the panel (stats pulls, limits pushes, unthrottle) — and you, for scripting |
| **Panel node-facing API** | the Pterodactyl panel addon | `https://<panel>/api/bandwidth/node` | node agents (register, heartbeat, limits pull, events, suspend callbacks) |

Both sides implement the same wire contract (`API_CONTRACT.md` in the project). This page documents both APIs exactly as implemented, with curl examples for every endpoint.

---

## Conventions

### Response envelope

Every response on **both** APIs — including errors and the public health check — uses the same envelope:

```json
{
  "success": true,
  "data": {},
  "error": null,
  "meta": { "version": "1.0.0" }
}
```

On failure: `success` is `false`, `data` is `null`, `error` is a human-readable message, and `meta.code` carries a machine-readable `ERR_*` code:

```json
{
  "success": false,
  "data": null,
  "error": "unauthorized",
  "meta": { "version": "1.0.0", "code": "ERR_UNAUTHORIZED" }
}
```

### Authentication

Both directions use the **same 64-hex pairing token** (32 random bytes, hex-encoded; generated per node on the panel's Nodes page):

```
Authorization: Bearer <64-hex token>
```

- **Node → panel:** the panel resolves the candidate token row by the indexed first 16 hex chars, then bcrypt-verifies the full token. Tokens are random 256-bit values, so the prefix is not a security weakness. These endpoints sit behind their own middleware (JSON check + throttle + bandwidth token auth) — they do **not** accept panel API/Sanctum keys.
- **Panel → node:** the agent reads the token from `/etc/bandwidth-node/token` and compares in constant time (padded, so length is not leaked).
- The node's `GET /api/v1/health` is **public** — no auth — and deliberately cheap.

### Units

- Byte counters and rates are integers (bytes, bytes/sec).
- Quota fields (`*_quota_*_gb`) are **GiB** (1024³ bytes) on both sides.
- A speed or quota of `0` means **unlimited / no rule**.
- Heartbeat `rx_rate_bps` / `tx_rate_bps` are integers (the node rounds).
- `quota_exceeded` in the heartbeat counts **servers** with at least one exceeded quota, not individual quota combinations.
- Timestamps are RFC 3339.

---

## Node agent API (panel-facing)

Base: `http(s)://<node_api_url>:8480/api/v1`. All endpoints require the bearer token **except** `/health`. Content-Type for request bodies: `application/json`. Bodies are capped at 1 MiB.

The node API is the panel's interface to the agent, but nothing stops you from calling it directly for monitoring scripts — that is what the examples below do.

### GET /health

Public liveness and version probe. No auth, no envelope exceptions — still wrapped in the standard envelope.

```bash
curl -s http://node1.example.com:8480/api/v1/health
```

```json
{
  "success": true,
  "data": {
    "status": "ok",
    "version": "1.0.0",
    "containers": 12,
    "uptime_seconds": 3600
  },
  "error": null,
  "meta": { "version": "1.0.0", "code": "" }
}
```

`containers` counts managed server containers that are currently running.

### GET /stats

Current per-server counters, rates, and enforcement state. The panel polls this every minute to build its usage rollups.

```bash
TOKEN=$(sudo cat /etc/bandwidth-node/token)
curl -s -H "Authorization: Bearer $TOKEN" \
  http://node1.example.com:8480/api/v1/stats
```

```json
{
  "success": true,
  "data": {
    "servers": [
      {
        "uuid": "c3f0a1b2-0000-4000-8000-abcdef123456",
        "container_id": "abc123def456",
        "online": true,
        "rx_bytes_total": 123456789012,
        "tx_bytes_total": 45678901234,
        "rx_rate_bps": 1000,
        "tx_rate_bps": 2000,
        "rx_used_day_bytes": 1000000,
        "tx_used_day_bytes": 2000000,
        "rx_used_week_bytes": 5000000,
        "tx_used_week_bytes": 9000000,
        "rx_used_month_bytes": 20000000,
        "tx_used_month_bytes": 30000000,
        "throttled": false,
        "exceeded": ["tx_month"]
      }
    ]
  },
  "error": null,
  "meta": { "version": "1.0.0", "code": "" }
}
```

Field notes:

- `rx_*` / `tx_*` are from the **server's** perspective: RX = inbound to the server, TX = outbound from it.
- `*_bytes_total` are cumulative counters since the agent first saw the server; the `*_used_*_bytes` fields are per-period counters that reset at calendar boundaries.
- `exceeded` lists the exceeded `direction_period` combos (e.g. `tx_month`, `rx_day`). A combo an admin cleared via unthrottle is omitted until the period resets.

### GET /servers/{uuid}/history

Time-bucketed usage for one server from the agent's local SQLite history.

| Query param | Values | Default |
| --- | --- | --- |
| `period` | `day`, `week`, `month` — covers from the start of the current calendar period until now | `day` |
| `bucket` | `hour`, `day` (bucket size) | `hour` |

```bash
TOKEN=$(sudo cat /etc/bandwidth-node/token)
curl -s -H "Authorization: Bearer $TOKEN" \
  "http://node1.example.com:8480/api/v1/servers/c3f0a1b2-0000-4000-8000-abcdef123456/history?period=week&bucket=hour"
```

```json
{
  "success": true,
  "data": {
    "uuid": "c3f0a1b2-0000-4000-8000-abcdef123456",
    "period": "week",
    "bucket": "hour",
    "points": [
      { "t": "2026-07-27T00:00:00Z", "rx_bytes": 1048576, "tx_bytes": 2097152 }
    ]
  },
  "error": null,
  "meta": { "version": "1.0.0", "code": "" }
}
```

Errors: `404 ERR_NOT_FOUND` for an unknown UUID, `400 ERR_BAD_REQUEST` for an invalid period/bucket. Day buckets are grouped in the agent's effective quota timezone.

### PUT /limits

Full replace of the enforced limits set. Same payload shape as the panel's `GET /api/bandwidth/node/limits` response data — the panel pushes it after every limits change.

```bash
TOKEN=$(sudo cat /etc/bandwidth-node/token)
curl -s -X PUT -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  http://node1.example.com:8480/api/v1/limits \
  -d '{
    "config_version": 12,
    "timezone": "UTC",
    "servers": [
      {
        "uuid": "c3f0a1b2-0000-4000-8000-abcdef123456",
        "enabled": true,
        "rx_speed_mbps": 100,
        "tx_speed_mbps": 50,
        "rx_quota_day_gb": 0,
        "rx_quota_week_gb": 0,
        "rx_quota_month_gb": 500,
        "tx_quota_day_gb": 0,
        "tx_quota_week_gb": 0,
        "tx_quota_month_gb": 250,
        "exceed_action": "throttle",
        "throttle_rx_mbps": 5,
        "throttle_tx_mbps": 5
      }
    ]
  }'
```

```json
{
  "success": true,
  "data": { "applied": 1, "failed": 0 },
  "error": null,
  "meta": { "version": "1.0.0", "code": "" }
}
```

Semantics:

- The node persists the payload to its SQLite database and applies `tc` rules for every server whose container is running.
- **Full replace:** servers absent from `servers` lose their limits, enforcement flags, and tc rules (a `restored` event is emitted if they were restricted).
- `timezone` switches the agent's calendar-reset timezone for quotas; invalid names are rejected (the previous timezone stays active).
- The node does **not** bump `config_version` — the panel owns the version counter.
- Malformed JSON → `400 ERR_BAD_REQUEST`. Per-server failures (e.g. a missing UUID field) are counted in `failed` without failing the whole request.

### POST /servers/{uuid}/unthrottle

Admin override: removes an active throttle on one server until the underlying quota period resets.

```bash
TOKEN=$(sudo cat /etc/bandwidth-node/token)
curl -s -X POST -H "Authorization: Bearer $TOKEN" \
  http://node1.example.com:8480/api/v1/servers/c3f0a1b2-0000-4000-8000-abcdef123456/unthrottle
```

```json
{
  "success": true,
  "data": { "unthrottled": true },
  "error": null,
  "meta": { "version": "1.0.0", "code": "" }
}
```

The override is recorded per exceeded combo and survives agent restarts. When the period rolls over, the override is dropped and normal quota evaluation resumes. Errors: `404 ERR_NOT_FOUND` (unknown UUID), `500 ERR_INTERNAL`.

### Node API error codes

| HTTP | `meta.code` | When |
| --- | --- | --- |
| 401 | `ERR_UNAUTHORIZED` | Missing or wrong bearer token (any authenticated endpoint) |
| 400 | `ERR_BAD_REQUEST` | Malformed JSON body or invalid query parameters |
| 404 | `ERR_NOT_FOUND` | Unknown server UUID (history, unthrottle) |
| 500 | `ERR_INTERNAL` | Unthrottle failed on the node |

---

## Panel node-facing API

Base: `https://<panel>/api/bandwidth/node`. Called **by node agents**; every request needs the bearer token and `Content-Type: application/json`. Validation failures return HTTP 422 with `meta.code: ERR_VALIDATION`.

These endpoints exist so the agent can talk to the panel; they are documented here for operators debugging pairing issues and for anyone building tooling. You normally never call them by hand — but nothing in the auth model prevents it if you hold a node token.

### POST /register

First contact from a node agent. Retried with exponential backoff (1s → 30s cap) until it succeeds.

```bash
curl -s -X POST -H "Authorization: Bearer <64-hex token>" \
  -H "Content-Type: application/json" \
  https://panel.example.com/api/bandwidth/node/register \
  -d '{ "version": "1.0.0", "hostname": "node1.example.com", "port": 8480, "api_url": "" }'
```

```json
{
  "success": true,
  "data": {
    "node_id": 3,
    "heartbeat_interval_seconds": 60,
    "config_version": 12
  },
  "error": null,
  "meta": { "version": "1.0.0" }
}
```

- `api_url` is optional; when empty the panel derives `http://<hostname-or-peer-ip>:<port>`. When provided it must be a valid `http(s)` URL with a valid host and port.
- Effects: upserts the node's `api_url` and `version`, marks the node online, resets the health-failure counter, stamps `last_seen_at`.
- `heartbeat_interval_seconds` comes from the panel's **Node heartbeat interval** setting; the agent adopts it.

### POST /heartbeat

Liveness + aggregate counters, sent every heartbeat interval (default 60s).

```bash
curl -s -X POST -H "Authorization: Bearer <64-hex token>" \
  -H "Content-Type: application/json" \
  https://panel.example.com/api/bandwidth/node/heartbeat \
  -d '{
    "version": "1.0.0",
    "containers": 12,
    "rx_rate_bps": 123456789,
    "tx_rate_bps": 98765432,
    "throttled": 1,
    "quota_exceeded": 2
  }'
```

```json
{
  "success": true,
  "data": { "config_version": 12 },
  "error": null,
  "meta": { "version": "1.0.0" }
}
```

- Effects: marks the node online, stamps `last_seen_at`, refreshes the `cached_stats` JSON shown on the panel's Nodes page and dashboard stat cards.
- **Config drift:** if the returned `config_version` differs from the node's stored version, the node MUST call `GET /limits` and re-apply. This is how servers learn about limit changes made while they were online but unreachable by push.
- All body fields are optional but validated when present (rates are numeric — the agent rounds to integers per the contract).

### GET /limits

The effective limits for every server on the authenticated node.

```bash
curl -s -H "Authorization: Bearer <64-hex token>" \
  https://panel.example.com/api/bandwidth/node/limits
```

```json
{
  "success": true,
  "data": {
    "config_version": 12,
    "timezone": "UTC",
    "servers": [
      {
        "uuid": "c3f0a1b2-0000-4000-8000-abcdef123456",
        "enabled": true,
        "rx_speed_mbps": 100,
        "tx_speed_mbps": 50,
        "rx_quota_day_gb": 0,
        "rx_quota_week_gb": 0,
        "rx_quota_month_gb": 500,
        "tx_quota_day_gb": 0,
        "tx_quota_week_gb": 0,
        "tx_quota_month_gb": 250,
        "exceed_action": "throttle",
        "throttle_rx_mbps": 5,
        "throttle_tx_mbps": 5
      }
    ]
  },
  "error": null,
  "meta": { "version": "1.0.0" }
}
```

- Only servers belonging to the authenticated node are included.
- Each server's values are its **effective** limits: the per-server override row if one exists, otherwise the global defaults from Settings.
- `0` quota/speed = unlimited. `exceed_action` is `throttle` | `suspend` | `none`.
- `timezone` is the panel's quota timezone; the node adopts it for calendar resets.
- Error: `404 ERR_NODE_NOT_FOUND` if the token's node no longer exists.

### POST /events

Batch delivery of enforcement events. The agent queues events in SQLite and flushes up to 50 per delivery cycle, retrying until accepted.

```bash
curl -s -X POST -H "Authorization: Bearer <64-hex token>" \
  -H "Content-Type: application/json" \
  https://panel.example.com/api/bandwidth/node/events \
  -d '{
    "events": [
      {
        "server_uuid": "c3f0a1b2-0000-4000-8000-abcdef123456",
        "type": "quota_exceeded",
        "period": "month",
        "direction": "tx",
        "message": "tx month quota exceeded: 1181116006/1073741824 bytes used",
        "occurred_at": "2026-07-28T05:12:33Z"
      }
    ]
  }'
```

```json
{
  "success": true,
  "data": { "accepted": 1 },
  "error": null,
  "meta": { "version": "1.0.0" }
}
```

- `type` must be one of `quota_exceeded`, `throttled`, `restored`, `speed_applied`, `suspended`. `period` (`day|week|month`) and `direction` (`rx|tx`) are nullable.
- Batches are limited to 1–100 events; `message` max 1000 chars.
- Events for servers that do not belong to the authenticated node are **silently skipped but still counted** in `accepted` — a misconfigured node learns nothing about other nodes' servers.

### POST /suspend

The node asks the panel to suspend a server (the `suspend` exceed action). Idempotent.

```bash
curl -s -X POST -H "Authorization: Bearer <64-hex token>" \
  -H "Content-Type: application/json" \
  https://panel.example.com/api/bandwidth/node/suspend \
  -d '{ "server_uuid": "c3f0a1b2-0000-4000-8000-abcdef123456", "reason": "tx_month quota exceeded" }'
```

```json
{
  "success": true,
  "data": { "suspended": true },
  "error": null,
  "meta": { "version": "1.0.0" }
}
```

- Suspends the Pterodactyl server through the panel's suspension service and records a `suspended` event — but only when this call actually transitioned the server. Repeat calls stay silent and return success.
- Errors: `404 ERR_UNKNOWN_SERVER` (unknown UUID, or the server belongs to a different node), `500 ERR_SUSPEND_FAILED`.

### Panel API error codes

| HTTP | `meta.code` | When |
| --- | --- | --- |
| 401 | `ERR_UNAUTHORIZED` | Missing or invalid bearer token (rejected by the auth middleware) |
| 422 | `ERR_VALIDATION` | Body failed validation (message names the first failing field) |
| 404 | `ERR_NODE_NOT_FOUND` | Token valid but the node no longer exists (`GET /limits`) |
| 404 | `ERR_UNKNOWN_SERVER` | Suspend target unknown or owned by another node |
| 500 | `ERR_SUSPEND_FAILED` | The panel's suspension service threw |
| 429 | *(middleware)* | Throttle middleware — slow down |

---

## Admin session JSON endpoints

A small set of session-authed (admin web session, same middleware as the admin pages) JSON endpoints powers the dashboard UI. These are for the panel's own JavaScript — not part of the node contract, but stable enough to script against:

| Endpoint | Purpose |
| --- | --- |
| `GET /admin/bandwidth/api/timeseries?hours=&node_id=&server_id=` | Bucketed fleet In/Out series for charts (`hours` 1–2160) |
| `GET /admin/bandwidth/api/top-consumers?hours=&node_id=` | Top 10 servers by combined bytes in range |
| `GET /admin/bandwidth/nodes/poll` | Database-backed node card fields (no node call) |
| `GET /admin/bandwidth/nodes/{node}/live` | Near-real-time In/Out rates for one node — the panel proxies the agent's `GET /api/v1/stats` with a 3-second cache. Feeds the node-card sparklines |

All five return plain JSON (the admin UI consumes them with `fetch`). Chart endpoints use the envelope-less chart shapes shown in the Admin Panel guide; the live endpoint returns `{ "ok": true, "rx_rate_bps": 0, "tx_rate_bps": 0, "throttled": 0, "quota_exceeded": 0, "containers": 0 }`.

## Versioning & compatibility

- The addon/agent version (`1.0.0`) is reported in every envelope's `meta.version` and in the `version` field of register/heartbeat calls.
- `config_version` is a panel-owned, monotonically increasing integer bumped on every limits change. Nodes compare it on each heartbeat and re-pull `GET /limits` on drift — the push-then-pull design means a node can never run stale limits for longer than one heartbeat interval.

::: tip DEBUGGING TIP
To watch a node talk to the panel live: `sudo journalctl -u bandwidth-node.service -f` on the node, and the panel's Laravel log for `bandwidth_monitor.*` entries. A 401 loop on heartbeats almost always means the token was reset in the panel — re-copy it from **Nodes → View Token** into `/etc/bandwidth-node/token` and restart the agent.
:::
