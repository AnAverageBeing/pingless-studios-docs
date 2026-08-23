---
title: HTTP API
description: GameFilter XDP management API — token auth, per-IP rate limiting, and every endpoint (health, stats, filters, admissions, lists, config, reload, whitelist/blacklist) with curl examples and JSON responses.
---

# HTTP API

The only management surface besides the CLI — there is no TUI by design. The API runs inside `gamefilter daemon` (the `gamefilter-api.service` unit) and binds to [`api.listen`](/gamefilter-xdp/configuration/reference#api-listen) (default `127.0.0.1:9300`).

`sudo gamefilter key` prints the URL, the key, and a ready-to-paste curl command.

[[toc]]

---

## Authentication

Every endpoint — including `/health` — requires the API key, presented either way:

```bash
# Bearer header (preferred)
curl -H "Authorization: Bearer gf_9f2c…" http://127.0.0.1:9300/api/v1/stats

# Query parameter
curl "http://127.0.0.1:9300/api/v1/stats?key=gf_9f2c…"
```

The comparison is constant-time. Two gates run **before** the key check and rate limiter:

1. **IP allowlist** — if [`api.whitelist`](/gamefilter-xdp/configuration/reference#api-whitelist) is non-empty, the source IP must match an entry (single IPs or CIDRs, v4/v6): `403 {"error":"source IP not in whitelist"}`.
2. **Key** — missing or wrong key: `401 {"error":"missing or invalid API key"}`.

## Rate limiting

Per-source-IP token bucket: [`api.rate_limit_per_sec`](/gamefilter-xdp/configuration/reference#api-rate_limit_per_sec) tokens/second (default 10), burst capacity 2× the rate. `0` disables it. Over the limit:

```json
{"error": "rate limit exceeded"}
```

with HTTP `429`.

## Errors

All errors are JSON with an HTTP status code:

```json
{"error": "missing or invalid API key"}
```

| Code | Meaning |
| ---- | ------- |
| 400 | Bad request (invalid IP, `default_action` not `drop`/`pass`, `api_key` shorter than 8 chars) |
| 401 | Missing or invalid API key |
| 403 | Source IP not in `api.whitelist` |
| 404 | Unknown endpoint |
| 405 | Method not allowed |
| 429 | Rate limit exceeded |
| 500 | Internal error (e.g. pinned maps missing because the filter isn't loaded) |

---

## `GET /health`

Liveness, version, and whether the XDP filter is currently loaded.

```bash
curl -H "Authorization: Bearer gf_9f2c…" http://127.0.0.1:9300/health
```

```json
{
  "status": "ok",
  "generated_at": 1755931200,
  "version": "1.0.0",
  "api_uptime_seconds": 312,
  "loaded": true
}
```

## `GET /api/v1/stats`

Global + per-filter counters, list sizes, and active admission count. This is the same snapshot `gamefilter status --json` prints.

```bash
curl -H "Authorization: Bearer gf_9f2c…" http://127.0.0.1:9300/api/v1/stats
```

```json
{
  "loaded": true,
  "generated_at": 1755931200,
  "system": {
    "interface": "eth1",
    "xdp_mode": "native",
    "loaded_at": 1755924000,
    "version": "1.0.0"
  },
  "global": {
    "passed": 128412,
    "dropped": 9033,
    "validated_ok": 4210,
    "validated_fail": 8801,
    "admitted_hits": 120244,
    "banned": 17
  },
  "filters": [
    {
      "slot": 0,
      "name": "mc-java",
      "protocol": "tcp",
      "ports": "25565",
      "validator": "mc_java",
      "passed": 52100,
      "dropped": 1200,
      "validated_ok": 2400,
      "validated_fail": 1200,
      "admitted_hits": 49700,
      "banned": 9
    }
  ],
  "lists": { "whitelisted": 2, "blacklisted": 26 },
  "admissions": { "active": 4312 }
}
```

## `GET /api/v1/filters`

Just the filter table with counters (the `filters` array from stats):

```bash
curl -H "Authorization: Bearer gf_9f2c…" http://127.0.0.1:9300/api/v1/filters
```

```json
{
  "generated_at": 1755931200,
  "filters": [
    { "slot": 0, "name": "mc-java", "protocol": "tcp", "ports": "25565", "validator": "mc_java",
      "passed": 52100, "dropped": 1200, "validated_ok": 2400, "validated_fail": 1200,
      "admitted_hits": 49700, "banned": 9 }
  ]
}
```

## `GET /api/v1/admissions`

Live admitted sources with remaining TTL. Expired entries are filtered out. Sources admitted under the fragment any-rule marker show `"filter": "any"`.

```bash
curl -H "Authorization: Bearer gf_9f2c…" http://127.0.0.1:9300/api/v1/admissions
```

```json
{
  "generated_at": 1755931200,
  "count": 2,
  "admissions": [
    { "ip": "203.0.113.50", "filter": "mc-bedrock", "remaining_seconds": 287 },
    { "ip": "203.0.113.50", "filter": "any", "remaining_seconds": 287 }
  ]
}
```

## `GET /api/v1/lists`

Current whitelist and blacklist contents (including synced and kernel-added temp-bans):

```bash
curl -H "Authorization: Bearer gf_9f2c…" http://127.0.0.1:9300/api/v1/lists
```

```json
{
  "generated_at": 1755931200,
  "whitelist": ["203.0.113.10"],
  "blacklist": ["198.51.100.7", "192.0.2.44"]
}
```

## `GET /api/v1/config`

Read the running config. Both API keys (`api.api_key` and `sync.openshield.api_key`) are masked:

```bash
curl -H "Authorization: Bearer gf_9f2c…" http://127.0.0.1:9300/api/v1/config
```

```json
{
  "generated_at": 1755931200,
  "config": {
    "interface": "eth1",
    "xdp_mode": "auto",
    "enabled": true,
    "default_action": "drop",
    "filters": [ … ],
    "whitelist": [],
    "blacklist": [],
    "sync": { "openshield": { "enabled": false, "mode": "api", "url": "http://127.0.0.1:9100",
                              "api_key": "***", "file": "/var/lib/openshield/lists.json", "interval_sec": 15 } },
    "api": { "enabled": true, "listen": "127.0.0.1:9300", "api_key": "***",
             "rate_limit_per_sec": 10, "whitelist": [] }
  }
}
```

## `POST /api/v1/config`

Partial patch — only the fields you send are changed. The result is persisted to the YAML and hot-applied to the running filter.

```bash
curl -X POST -H "Authorization: Bearer gf_9f2c…" -H "Content-Type: application/json" \
  -d '{"default_action": "pass"}' \
  http://127.0.0.1:9300/api/v1/config
```

```json
{
  "applied": true,
  "persisted": true,
  "hot_applied": true,
  "config": { … }
}
```

Patchable fields (all optional):

| Field | Type | Notes |
| ----- | ---- | ----- |
| `enabled` | bool | Global kill switch |
| `default_action` | string | Must be `drop` or `pass` (`400` otherwise) |
| `filters` | array | **Replaces the whole filter list** |
| `api.rate_limit_per_sec` | int | |
| `api.whitelist` | array | Replaces the API source allowlist |
| `api.api_key` | string | Min 8 characters (`400` otherwise) |

`hot_applied: false` means the patch was saved but the kernel push failed (e.g. filter not loaded) — check the daemon logs.

## `POST /api/v1/reload`

Re-read the YAML from disk and hot-apply it — the API twin of `gamefilter reload`.

```bash
curl -X POST -H "Authorization: Bearer gf_9f2c…" http://127.0.0.1:9300/api/v1/reload
```

```json
{"reloaded": true}
```

## `POST /api/v1/whitelist`

```bash
curl -X POST -H "Authorization: Bearer gf_9f2c…" -H "Content-Type: application/json" \
  -d '{"ip": "203.0.113.10"}' \
  http://127.0.0.1:9300/api/v1/whitelist
```

```json
{"added": "203.0.113.10", "list": "WHITELIST"}
```

## `DELETE /api/v1/whitelist/{ip}`

```bash
curl -X DELETE -H "Authorization: Bearer gf_9f2c…" \
  http://127.0.0.1:9300/api/v1/whitelist/203.0.113.10
```

```json
{"removed": "203.0.113.10", "list": "WHITELIST"}
```

## `POST /api/v1/blacklist`

`duration` is in seconds; omit it (or send `0`) for a permanent ban.

```bash
curl -X POST -H "Authorization: Bearer gf_9f2c…" -H "Content-Type: application/json" \
  -d '{"ip": "198.51.100.7", "duration": 3600}' \
  http://127.0.0.1:9300/api/v1/blacklist
```

```json
{"added": "198.51.100.7", "list": "BLACKLIST"}
```

## `DELETE /api/v1/blacklist/{ip}`

```bash
curl -X DELETE -H "Authorization: Bearer gf_9f2c…" \
  http://127.0.0.1:9300/api/v1/blacklist/198.51.100.7
```

```json
{"removed": "198.51.100.7", "list": "BLACKLIST"}
```

---

## Endpoint summary

| Path | Method | Description |
| ---- | ------ | ----------- |
| `/health` | GET | Liveness, version, loaded flag |
| `/api/v1/stats` | GET | Global + per-filter counters, list sizes, admissions |
| `/api/v1/filters` | GET | Active filter table with counters |
| `/api/v1/admissions` | GET | Live admitted sources with remaining TTL |
| `/api/v1/lists` | GET | Whitelist + blacklist entries |
| `/api/v1/config` | GET / POST | Read (secrets masked) / partial patch, hot-applied |
| `/api/v1/reload` | POST | Re-read the YAML and hot-apply |
| `/api/v1/whitelist` | POST | Add `{ip}` |
| `/api/v1/whitelist/{ip}` | DELETE | Remove |
| `/api/v1/blacklist` | POST | Add `{ip, duration?}` |
| `/api/v1/blacklist/{ip}` | DELETE | Remove |
