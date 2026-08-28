---
title: HTTP API
description: GameFilter XDP management API — token auth, per-IP rate limiting, live tenant management, and every endpoint (health, stats, metrics, tenants, filters, admissions, lists, config, reload, whitelist/blacklist) with curl examples and JSON responses.
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
| 404 | Unknown endpoint or tenant/filter not found |
| 405 | Method not allowed |
| 409 | Filter name conflict |
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
  "version": "1.2.0",
  "api_uptime_seconds": 312,
  "loaded": true
}
```

## `GET /api/v1/metrics`

Real-time 1s sampler output with current/peak rates, 5-minute history, counters, tenants, and filters.

```bash
curl -H "Authorization: Bearer gf_9f2c…" http://127.0.0.1:9300/api/v1/metrics
```

```json
{
  "generated_at": 1755931200,
  "loaded": true,
  "system": {
    "interface": "vmbr0",
    "xdp_mode": "native",
    "mode": "dedicated",
    "loaded_at": 1755924000,
    "version": "1.2.0"
  },
  "counters": {
    "passed": 128412,
    "dropped": 984012,
    "validated_ok": 1240,
    "validated_fail": 980000,
    "admitted_hits": 127172,
    "banned": 45
  },
  "rates": {
    "pass_pps": 850,
    "drop_pps": 42000,
    "validated_ok_per_sec": 2,
    "validated_fail_per_sec": 41998,
    "peak_pass_pps": 1500,
    "peak_drop_pps": 90000
  },
  "history": [
    { "ts": 1755931199, "pass_pps": 845, "drop_pps": 41800 }
  ],
  "tenants": [
    { "ip": "10.210.0.2", "label": "Minecraft VPS" }
  ],
  "filters": [ … ],
  "lists": {
    "whitelisted": 2,
    "blacklisted": 5,
    "tenants_count": 1
  },
  "admissions": {
    "active": 340
  },
  "api_uptime_seconds": 312
}
```

## `GET /api/v1/stats`

Global counters + tenants + per-filter counters + list sizes, and active admission count. This is the same snapshot `gamefilter status --json` prints.

```bash
curl -H "Authorization: Bearer gf_9f2c…" http://127.0.0.1:9300/api/v1/stats
```

---

## Tenant Endpoints (Multi-Tenant / Dedicated Mode)

In `mode: dedicated`, only enrolled destination IPs are inspected. Un-enrolled destination IPs bypass filtering instantly with `XDP_PASS`.

### `GET /api/v1/tenants`

List all enrolled tenant destination IPs.

```bash
curl -H "Authorization: Bearer gf_9f2c…" http://127.0.0.1:9300/api/v1/tenants
```

```json
{
  "generated_at": 1755931200,
  "mode": "dedicated",
  "count": 2,
  "enrolled_in_kernel": 2,
  "tenants": [
    { "ip": "10.210.0.2", "label": "Minecraft VPS" },
    { "ip": "10.210.0.3", "label": "FiveM VPS" }
  ]
}
```

### `POST /api/v1/tenants`

Enroll a destination IP live into the kernel's `TENANTS_MAP` and persist to YAML.

```bash
curl -X POST -H "Authorization: Bearer gf_9f2c…" -H "Content-Type: application/json" \
  -d '{"ip": "10.210.0.4", "label": "CS2 Server"}' \
  http://127.0.0.1:9300/api/v1/tenants
```

```json
{
  "enrolled": "10.210.0.4",
  "label": "CS2 Server",
  "persisted": true,
  "mode": "dedicated"
}
```

### `GET /api/v1/tenants/{ip}`

View enrollment status and label for a specific IP.

```bash
curl -H "Authorization: Bearer gf_9f2c…" http://127.0.0.1:9300/api/v1/tenants/10.210.0.2
```

### `DELETE /api/v1/tenants/{ip}`

Un-enroll a destination IP live. Traffic to this IP will now immediately bypass filtering without requiring a reload or restart.

```bash
curl -X DELETE -H "Authorization: Bearer gf_9f2c…" \
  http://127.0.0.1:9300/api/v1/tenants/10.210.0.4
```

```json
{
  "unenrolled": "10.210.0.4",
  "persisted": true,
  "mode": "dedicated"
}
```

### `GET /api/v1/tenants/{ip}/admissions`

View active player/source admissions specifically targeting this tenant destination IP.

```bash
curl -H "Authorization: Bearer gf_9f2c…" http://127.0.0.1:9300/api/v1/tenants/10.210.0.2/admissions
```

---

## Filter Endpoints

### `GET /api/v1/filters`

Active filter table with per-filter counters:

```bash
curl -H "Authorization: Bearer gf_9f2c…" http://127.0.0.1:9300/api/v1/filters
```

### `POST /api/v1/filters`

Add a filter to the running engine live.

```bash
curl -X POST -H "Authorization: Bearer gf_9f2c…" -H "Content-Type: application/json" \
  -d '{
    "name": "fivem",
    "protocol": "udp",
    "ports": ["30120"],
    "validator": "fivem",
    "min_size": 9,
    "max_size": 1500,
    "admission_ttl_sec": 600,
    "ban_sec": 300,
    "max_failures": 8
  }' \
  http://127.0.0.1:9300/api/v1/filters
```

### `PATCH /api/v1/filters/{name}`

Update fields (e.g. widen a port range live without restart):

```bash
curl -X PATCH -H "Authorization: Bearer gf_9f2c…" -H "Content-Type: application/json" \
  -d '{"ports": ["27015-27060"]}' \
  http://127.0.0.1:9300/api/v1/filters/source-engine
```

### `DELETE /api/v1/filters/{name}`

Delete a filter rule live.

---

## Configuration Endpoints

### `GET /api/v1/config`

Read active config with secret keys masked.

### `POST /api/v1/config`

Partial patch applied live and persisted:

```bash
curl -X POST -H "Authorization: Bearer gf_9f2c…" -H "Content-Type: application/json" \
  -d '{"mode": "dedicated", "default_action": "pass"}' \
  http://127.0.0.1:9300/api/v1/config
```

### `POST /api/v1/reload`

Re-read `/etc/gamefilter/gamefilter.yaml` from disk and hot-apply it incrementally.

---

## List Endpoints

### `GET /api/v1/lists`

View current whitelist, blacklist, and enrolled tenant keys.

### `POST /api/v1/whitelist` / `DELETE /api/v1/whitelist/{ip}`

Add or remove whitelist IPs.

### `POST /api/v1/blacklist` / `DELETE /api/v1/blacklist/{ip}`

Add (`{"ip":"1.2.3.4", "duration":3600}`) or remove blacklist IPs.

---

## Endpoint Summary

| Path | Method | Description |
| ---- | ------ | ----------- |
| `/health` | GET | Liveness, version, loaded flag |
| `/api/v1/stats` | GET | Global + per-filter counters, list sizes, admissions |
| `/api/v1/metrics` | GET | 1s rate sampler, peaks, 5-min history, counters |
| `/api/v1/tenants` | GET / POST | List enrolled tenant IPs / enroll new IP |
| `/api/v1/tenants/{ip}` | GET / DELETE | View tenant status / un-enroll IP |
| `/api/v1/tenants/{ip}/admissions` | GET | View live admitted players to this tenant |
| `/api/v1/filters` | GET / POST | Active filter table / add filter live |
| `/api/v1/filters/{name}` | GET / PATCH / DELETE | Granular filter inspection / update / delete |
| `/api/v1/admissions` | GET | Live admitted sources across all tenants |
| `/api/v1/lists` | GET | Whitelist + blacklist + tenant entries |
| `/api/v1/config` | GET / POST | Read (secrets masked) / partial patch, hot-applied |
| `/api/v1/reload` | POST | Re-read the YAML and hot-apply |
| `/api/v1/whitelist[/{ip}]` | POST / DELETE | Manage whitelist |
| `/api/v1/blacklist[/{ip}]` | POST / DELETE | Manage blacklist (`{"ip","duration"}`) |
