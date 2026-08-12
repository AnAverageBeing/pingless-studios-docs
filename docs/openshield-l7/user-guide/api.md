---
title: Admin API — OpenShield-L7
description: The OpenShield-L7 admin REST + SSE API — token auth and roles, error envelope, every endpoint with curl examples, SSE event format, and dashboard integration notes.
outline: deep
---

# Admin API

The admin API is the primary control surface of OpenShield-L7 — an external dashboard drives everything through it. It is served on `admin.listen` (default `127.0.0.1:9090`), entirely separate from the proxied traffic ports.

- Base URL: `http://127.0.0.1:9090/api/v1`
- JSON everywhere, requests and responses.
- Every mutation returns the new state.
- Live telemetry is available as Server-Sent Events (SSE).

---

## Authentication

Every request except `GET /api/v1/health` requires a token, sent either way:

```text
Authorization: Bearer <token>
X-Api-Token: <token>
```

Tokens are matched against `admin.tokens` from the **live** global config in constant time, re-read on every request — rotating tokens via `PUT /api/v1/global` or a `config.yaml` reload takes effect instantly. Token values are never logged; a bad or missing token gets a bare `401` with no hints.

If `admin.allow_hosts` is non-empty, the request's `Host` header must also be in that list, or the request is rejected before token checks.

### Roles and permission matrix

Roles come from each token's `role` field (`admin` / `operator` / `readonly`):

| Endpoint | readonly | operator | admin |
|---|:-:|:-:|:-:|
| `GET` (all endpoints, incl. `/global`, `/export`) | ✓ | ✓ | ✓ |
| `POST /sites`, `PUT/PATCH/DELETE /sites/{id}` | — | ✓ | ✓ |
| `POST /sites/{id}/enable` · `/disable` | — | ✓ | ✓ |
| `POST /reload` | — | ✓ | ✓ |
| `POST /bans`, `DELETE /bans/{ip}` | — | ✓ | ✓ |
| `PUT /global` | — | — | ✓ |

A token attempting something above its role gets `403`.

---

## Errors

All errors use one envelope:

```json
{
  "error": "config validation failed",
  "details": [
    "hostnames: at least one hostname is required",
    "origin.url: 'not-a-url': relative URL without a base"
  ]
}
```

| Status | Meaning |
|---|---|
| `400` | Bad request body, or config validation failed. Validation failures list **every** problem in `details`. |
| `401` | Missing/invalid token. No hints. |
| `403` | Token role insufficient (e.g. `operator` calling `PUT /global`). |
| `404` | Unknown site id, or nothing to delete/unban. |
| `409` | Conflict (e.g. creating a site whose id already exists). |
| `500` | Internal error. |

`details` may be absent when there is nothing to enumerate.

---

## Health & info

### `GET /api/v1/health`

Liveness probe. **Unauthenticated** — safe for load-balancer checks.

```bash
curl -s http://127.0.0.1:9090/api/v1/health
```

```json
{"status": "ok"}
```

### `GET /api/v1/info`

Version, uptime, site counts.

```bash
curl -s -H "Authorization: Bearer $TOKEN" http://127.0.0.1:9090/api/v1/info
```

```json
{
  "version": "0.1.0",
  "uptime_secs": 86412,
  "sites_total": 3,
  "sites_enabled": 2
}
```

---

## Stats

### `GET /api/v1/stats/global`

Process-wide counters.

```bash
curl -s -H "Authorization: Bearer $TOKEN" http://127.0.0.1:9090/api/v1/stats/global
```

| Field | Type | Meaning |
|---|---|---|
| `uptime_secs` | int | Seconds since the process started. |
| `version` | string | Binary version. |
| `sites_total` | int | Configured sites (enabled + disabled). |
| `sites_enabled` | int | Enabled sites. |
| `total_requests` | int | Requests seen since start. |
| `blocked` | int | Requests denied by any rule. |
| `challenged` | int | Requests served a PoW challenge. |
| `bytes_up` | int | Client→origin bytes. |
| `bytes_down` | int | Origin→client bytes. |
| `active_connections` | int | In-flight requests **plus live WebSocket/upgrade tunnels** right now (a tunnel holds a slot from the `101` until it closes). |
| `rps_1m` | float | Requests/sec over the last minute. |

```json
{
  "uptime_secs": 86412, "version": "0.1.0", "sites_total": 3, "sites_enabled": 2,
  "total_requests": 12938471, "blocked": 40211, "challenged": 8102,
  "bytes_up": 3481293847, "bytes_down": 90213478123,
  "active_connections": 87, "rps_1m": 412.6
}
```

### `GET /api/v1/stats/sites`

Array of per-site stats for all sites.

### `GET /api/v1/stats/sites/{id}`

One site. `404` for an unknown id.

```bash
curl -s -H "Authorization: Bearer $TOKEN" http://127.0.0.1:9090/api/v1/stats/sites/www-example-com
```

| Field | Type | Meaning |
|---|---|---|
| `site` | string | Site id. |
| `enabled` | bool | Whether the site is currently proxying. |
| `requests` / `blocked` / `challenged` | int | Counters since start. |
| `bytes_up` / `bytes_down` | int | Byte counters since start. |
| `rps_1m` | float | Requests/sec, last minute. |
| `active_connections` | int | In-flight requests **plus live WebSocket/upgrade tunnels** right now (gauge opened at route/tunnel-splice time, closed when the request event publishes or the tunnel ends). |
| `unique_ips_1h` | int | Distinct client IPs in the last hour (bounded-memory estimate, not exact). |
| `quota_used_bytes` | int or null | Bytes consumed in the current monthly window. `null` when no quota is configured. |
| `quota_limit_bytes` | int or null | The configured `monthly_quota_bytes`, or `null`. |
| `quota_reset_at` | int or null | Unix ms when the current quota window resets, or `null`. |
| `mitigation_active` | bool | True while auto-mitigation is tightening limits. |

```json
{
  "site": "www-example-com", "enabled": true,
  "requests": 8123456, "blocked": 31200, "challenged": 5401,
  "bytes_up": 2103456789, "bytes_down": 60123456789,
  "rps_1m": 301.2, "active_connections": 64, "unique_ips_1h": 1882,
  "quota_used_bytes": 801234567890, "quota_limit_bytes": 1099511627776,
  "quota_reset_at": 1725148800000, "mitigation_active": false
}
```

---

## Analytics

### `GET /api/v1/analytics/sites/{id}?window_secs=&max_events=`

On-demand analytics over the site's recent-event buffer plus the per-minute aggregates. `404` for an unknown site.

Query parameters:

| Param | Type | Default | Meaning |
|---|---|---|---|
| `window_secs` | int | `3600` | Lookback window in seconds. Max `604800` (7 days). |
| `max_events` | int | `5000` | Cap on scanned recent events. Larger = slower, more accurate tops. |

```bash
curl -s -H "Authorization: Bearer $TOKEN" \
  "http://127.0.0.1:9090/api/v1/analytics/sites/www-example-com?window_secs=21600&max_events=20000"
```

Response fields:

| Field | Type | Meaning |
|---|---|---|
| `site` | string | Site id. |
| `window_secs` | int | The effective window. |
| `requests` / `blocked` / `challenged` | int | Totals inside the window. |
| `unique_ips` | int | Distinct client IPs in the window (estimate). |
| `status_hist` | array of `TopEntry` | Status-class counts, e.g. `{"key": "2xx", "count": 9123}`. |
| `top_ips` | array of `TopEntry` | Most active client IPs. |
| `top_paths` | array of `TopEntry` | Most requested paths. |
| `top_user_agents` | array of `TopEntry` | Most common UA strings. |
| `top_rule_hits` | array of `TopEntry` | Most-fired rule ids (`sqli`, `rate_limit.per_ip`, your custom ids, ...). |
| `latency` | map | Microsecond percentiles: `p50_us`, `p90_us`, `p99_us`, `max_us`. |
| `rps_series` | array of `SeriesPoint` | Per-minute `{"ts_ms", "value"}` requests/sec points — plot directly. |
| `bandwidth_series` | array of `SeriesPoint` | Per-minute bytes/sec points. |

`TopEntry` = `{"key": string, "count": int}`; `SeriesPoint` = `{"ts_ms": int, "value": float}`.

```json
{
  "site": "www-example-com", "window_secs": 21600,
  "requests": 81230, "blocked": 1193, "challenged": 402, "unique_ips": 4211,
  "status_hist": [{"key": "2xx", "count": 78122}, {"key": "4xx", "count": 2601}, {"key": "5xx", "count": 507}],
  "top_ips": [{"key": "203.0.113.9", "count": 12004}],
  "top_paths": [{"key": "/", "count": 30211}, {"key": "/api/items", "count": 8102}],
  "top_user_agents": [{"key": "Mozilla/5.0 ...", "count": 40213}],
  "top_rule_hits": [{"key": "rate_limit.per_ip", "count": 812}, {"key": "sqli", "count": 91}],
  "latency": {"p50_us": 1830, "p90_us": 12410, "p99_us": 88012, "max_us": 1203912},
  "rps_series": [{"ts_ms": 1722999180000, "value": 3.81}],
  "bandwidth_series": [{"ts_ms": 1722999180000, "value": 901234.5}]
}
```

Series resolution and retention are bounded by `events.aggregate_retention_hours` (default 7 days of per-minute points) and `events.recent_buffer`.

---

## Events

### `GET /api/v1/events/recent?site=&limit=&action=`

Most recent request events, newest first, from the ring buffers.

| Param | Type | Default | Meaning |
|---|---|---|---|
| `site` | string | — (all sites) | Restrict to one site id. |
| `limit` | int | server default | Max events returned. Bounded by `events.recent_buffer`. |
| `action` | enum | — (all) | Filter by outcome: `allowed`, `blocked`, `challenged`, `challenge_passed`, `redirected`, `errored`. |

```bash
curl -s -H "Authorization: Bearer $TOKEN" \
  "http://127.0.0.1:9090/api/v1/events/recent?site=www-example-com&limit=50&action=blocked"
```

```json
[
  {
    "ts_ms": 1723000000123,
    "site": "www-example-com",
    "client_ip": "203.0.113.9",
    "peer_ip": "172.64.0.12",
    "method": "GET",
    "host": "www.example.com",
    "path": "/login?u=' OR 1=1--",
    "status": 403,
    "action": "blocked",
    "rule_hits": ["sqli"],
    "latency_us": 412,
    "bytes_up": 388,
    "bytes_down": 1024,
    "user_agent": "sqlmap/1.7",
    "referer": "",
    "conn_bumped_ip": false,
    "conn_bumped_site": false
  }
]
```

Field notes: `site` is `null` for traffic matching no site (bare-IP scanners); `client_ip` is the trusted-proxy-resolved IP, `peer_ip` the direct TCP peer; `latency_us` is end-to-end request time; `bytes_up` / `bytes_down` are per-request byte counts. `conn_bumped_ip` / `conn_bumped_site` (default `false` when absent) are the conn-gauge pairing flags: true when this request incremented the per-IP / per-site in-flight connection gauge, so the limit engine releases exactly what was taken (pre-chain rejections like early 413s or ban/ACL 403s carry `false`/`false` and release nothing).

### `GET /api/v1/events/stream`

SSE stream of every engine event, live. One `data:` frame per event; the payload is a JSON object discriminated by its `kind` field.

```bash
curl -N -H "Authorization: Bearer $TOKEN" http://127.0.0.1:9090/api/v1/events/stream
```

Event kinds (`kind` is `snake_case`):

| `kind` | Payload fields | Fires when |
|---|---|---|
| `request` | Full `RequestEvent` (see above) | Exactly once per finished/rejected request. High volume. |
| `ban` | `ip`, `site` (null = global), `reason`, `until_ms`, `auto` | An IP is banned. `auto: true` = created by a limiter, `false` = operator/API. |
| `unban` | `ip`, `site` | A ban is lifted. |
| `mitigation` | `site`, `on`, `rps` | Auto-mitigation toggles for a site. |
| `config_reload` | `applied: [site/file, ...]`, `failed: [[file, error], ...]` | A hot reload finished. Per-file failures are isolated by design. |
| `quota_exceeded` | `site`, `used`, `limit` | A monthly bandwidth quota is crossed (once per window). |
| `site_up` | `site` | A site starts proxying. |
| `site_down` | `site`, `reason` | A site stops (disabled, origin dead, ...). |

Example frames:

```text
data: {"kind":"request","ts_ms":1723000000123,"site":"www-example-com","client_ip":"203.0.113.9","peer_ip":"203.0.113.9","method":"GET","host":"www.example.com","path":"/","status":200,"action":"allowed","rule_hits":[],"latency_us":1843,"bytes_up":312,"bytes_down":10420,"user_agent":"Mozilla/5.0 ...","referer":"","conn_bumped_ip":false,"conn_bumped_site":false}

data: {"kind":"ban","ip":"198.51.100.77","site":"www-example-com","reason":"rate_limit.per_ip: 6 violations","until_ms":1723000600000,"auto":true}

data: {"kind":"config_reload","applied":["www-example-com"],"failed":[["sites.d/broken.yaml","protection.waf.custom_rules[no-curl]: bad regex: unclosed group"]]}
```

Consumers should parse each `data:` line as JSON and switch on `kind`. Under bus congestion events are dropped rather than blocking the data plane (`events.channel_capacity` bounds the buffer) — **SSE is telemetry, not an audit log**.

---

## Sites

Site objects in requests/responses mirror the YAML model from the [Configuration Reference](../configuration/reference.md) exactly, as JSON (`snake_case` fields, same enums, same defaults). A full `SiteConfig` is a lot of JSON; PATCH exists so you rarely have to send one. One syntax difference from the YAML files: enums that carry a value use the JSON object form here — a header-targeted custom rule is `"target": {"header": "x-api-version"}` (YAML files write the same rule as `target: !header "x-api-version"`).

### `GET /api/v1/sites`

Array of all `SiteConfig`s.

```bash
curl -s -H "Authorization: Bearer $TOKEN" http://127.0.0.1:9090/api/v1/sites
```

### `POST /api/v1/sites`

Create a site. Body: a full or partial `SiteConfig` — omitted fields take defaults. If `id` is empty one is assigned and written back to the file. Validated; **all** validation errors come back at once. Role: operator+.

```bash
curl -s -X POST -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"hostnames": ["shop.example.com"], "origin": {"url": "http://10.0.0.6:8080"}}' \
  http://127.0.0.1:9090/api/v1/sites
```

`200` with the created site (id assigned):

```json
{
  "id": "shop-example-com",
  "enabled": true,
  "hostnames": ["shop.example.com"],
  "origin": {"url": "http://10.0.0.6:8080", "host_header": null,
             "connect_timeout_ms": 5000, "read_timeout_ms": 30000,
             "keepalive_secs": 75, "max_idle_per_host": 32},
  "tls": {"enabled": false, "cert_path": "", "key_path": "",
          "redirect_http_to_https": true, "hsts_max_age": null},
  "client_ip": {"trusted_proxies": [], "forward_mode": "x_forwarded_for",
                "custom_header": null, "transparent": false, "proxy_protocol": "off"},
  "protection": { "...": "..." },
  "bandwidth": {"monthly_quota_bytes": null, "quota_action": "error_page",
                "quota_reset_day": null, "max_site_bps": null, "max_ip_bps": null}
}
```

Errors: `400` (validation, `details` lists everything), `409` (id conflict).

### `GET /api/v1/sites/{id}`

One site's current config. `404` unknown id.

### `PUT /api/v1/sites/{id}`

Full replace. Body: complete `SiteConfig`; the result is validated before anything changes. Role: operator+. Returns the new state.

### `PATCH /api/v1/sites/{id}`

JSON merge-patch (RFC 7386) over the YAML model: send only what changes, objects merge recursively, `null` removes optional fields. The merged result is validated, persisted to `sites.d/<id>.yaml`, and hot-applied. Role: operator+.

```bash
# tighten one knob, leave everything else
curl -s -X PATCH -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"protection": {"rate_limit": {"per_ip": {"requests": 100}}}}' \
  http://127.0.0.1:9090/api/v1/sites/www-example-com

# remove the origin host_header override
curl -s -X PATCH -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"origin": {"host_header": null}}' \
  http://127.0.0.1:9090/api/v1/sites/www-example-com
```

Returns the full new state. `400` if the merged config fails validation (old config keeps running, file untouched).

### `DELETE /api/v1/sites/{id}`

Removes the site from the live registry and deletes its file. Role: operator+.

```bash
curl -s -X DELETE -H "Authorization: Bearer $TOKEN" \
  http://127.0.0.1:9090/api/v1/sites/www-example-com
```

```json
{"deleted": "www-example-com"}
```

### `POST /api/v1/sites/{id}/enable` · `POST /api/v1/sites/{id}/disable`

Flip `enabled` without touching the rest of the config. Disabled sites stop proxying (503 page) but keep their file, runtime, and stats. Role: operator+. Returns the updated site.

```bash
curl -s -X POST -H "Authorization: Bearer $TOKEN" \
  http://127.0.0.1:9090/api/v1/sites/www-example-com/disable
```

---

## Reload & global config

### `POST /api/v1/reload`

Re-read **every** file in `sites.d/` from disk. Per-file failures are isolated: good files apply, broken ones keep their old config running. Role: operator+. Equivalent to what the file watcher does automatically — use it after out-of-band edits (rsync, config management).

```bash
curl -s -X POST -H "Authorization: Bearer $TOKEN" http://127.0.0.1:9090/api/v1/reload
```

```json
{
  "applied": ["www-example-com", "shop-example-com"],
  "failed": [["sites.d/broken.yaml", "origin.url: 'http://': missing host"]]
}
```

### `GET /api/v1/global`

The live `GlobalConfig`. **Token values are redacted** (`"token": "***"`) — names and roles are visible.

```bash
curl -s -H "Authorization: Bearer $TOKEN" http://127.0.0.1:9090/api/v1/global
```

```json
{
  "listen_http": ["0.0.0.0:80"],
  "listen_https": ["0.0.0.0:443"],
  "admin": {
    "listen": "127.0.0.1:9090",
    "tokens": [{"name": "root", "token": "***", "role": "admin"}],
    "allow_hosts": []
  },
  "data_dir": "data",
  "sites_dir": "sites.d",
  "global_acl": {"blacklist": [], "whitelist": []},
  "events": {"channel_capacity": 65536, "recent_buffer": 10000,
             "aggregate_retention_hours": 168},
  "log_level": "info"
}
```

### `PUT /api/v1/global`

Replace the global config. **Role: admin only.** Validated before applying; persisted to `config.yaml` and hot-applied. Returns the applied config (tokens redacted).

A token left as the redaction placeholder `"***"` in the PUT body keeps the **stored** secret of the token with the same `name`, so a read-modify-write round trip through `GET /global` cannot clobber secrets. To actually change a token, supply the new value; to delete a token, remove the entry.

```bash
# rotate: add the new token, keep the old one until clients move
curl -s -X PUT -H "Authorization: Bearer $OLD_TOKEN" \
  -H "Content-Type: application/json" \
  -d @new-global.json \
  http://127.0.0.1:9090/api/v1/global
```

Notes: listen-address and token changes apply to **new connections only**. Tokens are re-read from the live config per request, so removing a token kills it instantly for new requests.

---

## Bans

A ban blocks one IP, either globally (`site: null`) or for one site. Automatic bans from `rate_limit.ban_after_violations` share the same store and appear here with `auto: true`.

### `GET /api/v1/bans`

All current bans.

```bash
curl -s -H "Authorization: Bearer $TOKEN" http://127.0.0.1:9090/api/v1/bans
```

```json
[
  {"ip": "198.51.100.77", "site": "www-example-com",
   "reason": "rate_limit.per_ip: 6 violations", "until_ms": 1723000600000,
   "auto": true},
  {"ip": "203.0.113.66", "site": null, "reason": "manual: credential stuffing",
   "until_ms": 0, "auto": false}
]
```

`until_ms` is the expiry in Unix ms; **`0` = permanent** (only a DELETE lifts it).

### `POST /api/v1/bans`

Create a ban. Role: operator+.

| Body field | Type | Required | Meaning |
|---|---|---|---|
| `ip` | string (IP) | yes | Address to ban. |
| `site` | string | no | Site id. Omit/null = global ban across all sites. |
| `reason` | string | no | Free text, shown in lists/events. |
| `duration_secs` | int | no | Ban lifetime. Omit = permanent. |

```bash
curl -s -X POST -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"ip": "203.0.113.66", "reason": "credential stuffing", "duration_secs": 86400}' \
  http://127.0.0.1:9090/api/v1/bans
```

`200` with the created `BanInfo` (same shape as the list above).

### `DELETE /api/v1/bans/{ip}?site=`

Lift a ban. `site` selects a site-scoped ban; omit it for the global ban. Role: operator+.

```bash
curl -s -X DELETE -H "Authorization: Bearer $TOKEN" \
  "http://127.0.0.1:9090/api/v1/bans/203.0.113.66"
```

```json
{"removed": true}
```

`404` when no matching ban exists.

---

## Export

### `GET /api/v1/export`

Full configuration dump in one call — the global config plus every site — for backups and config management. Tokens are redacted as in `GET /global`.

```bash
curl -s -H "Authorization: Bearer $TOKEN" http://127.0.0.1:9090/api/v1/export > backup.json
```

```json
{
  "global": { "...": "..." },
  "sites": [ { "id": "www-example-com", "...": "..." } ]
}
```

---

## Dashboard integration guide

### Polling vs SSE

- **SSE (`/events/stream`)** is for the live tail: an event feed, a "what just got blocked" ticker, ban notifications, reload confirmations. It pushes every event with sub-second latency. `kind: "request"` frames are high-volume on busy sites — filter client-side or drop them and rely on stats endpoints for counters. Reconnect with backoff; the stream is lossy under congestion by design.
- **Polling** is for gauges and graphs: `GET /stats/global` + `GET /stats/sites` every 5–15 s gives you every counter the overview page needs at negligible cost. Poll `GET /analytics/sites/{id}` only when a user is looking at that site — it scans the recent buffer and is the most expensive read.

A good default: one SSE connection for the event log + `config_reload` toasts, one 10 s poller for stats, analytics on demand.

### Rendering timeseries

`rps_series` and `bandwidth_series` in the analytics response are per-minute `{"ts_ms", "value"}` points, oldest→newest. Plot `value` against `ts_ms` directly; pick `window_secs` to match the zoom level (3600 for an hour view, 86400 for a day). Gaps mean no traffic, not missing data. Retention is `events.aggregate_retention_hours` (default 168 h) — older data is gone; export to your own TSDB if you need it.

### Building a site editor on PATCH semantics

1. `GET /sites/{id}` → render the form from the response.
2. On save, compute the diff client-side and send **only the changed subtree** as a merge-patch. `{protection:{rate_limit:{per_ip:{requests:100}}}}` is a valid patch; you do not need to round-trip the whole object.
3. Send `null` for optional fields the user cleared (`origin.host_header`, `client_ip.custom_header`, all four `bandwidth` nullables).
4. Re-render from the **response body**, not local state — the server returns the validated, persisted, hot-applied config.
5. On `400`, display every entry of `details`; the old config is still live, nothing was written.
6. Arrays (`hostnames`, `custom_rules`, `trusted_proxies`, ...) are replaced wholesale by a patch, not merged — send the full new array.

### Token storage advice

- Issue a `readonly` token for any dashboard view that only displays data; keep `operator`/`admin` tokens for mutation UI behind a separate login step.
- Never store tokens in `localStorage` (XSS-readable). Prefer a backend session that holds the token server-side, or memory-only storage with a short-lived token. If the dashboard is a pure SPA, put a small auth proxy in front of the API instead of shipping tokens to browsers.
- Never expose `admin.listen` on a public interface. If you must reach it remotely, an SSH tunnel (`ssh -L 9090:127.0.0.1:9090`) beats opening the port; if you do bind it wider, set `admin.allow_hosts` and front it with TLS-terminating infrastructure you control.
- Rotate tokens with `PUT /global` (see above): add the new token, deploy it to clients, remove the old one. Rotation is instant — tokens are re-read from live config per request.

### Alerts worth wiring

`config_reload` events with non-empty `failed` (a config edit didn't take), `quota_exceeded`, `site_down`, and `mitigation` with `on: true` (a flood is being auto-tightened — someone should look).
