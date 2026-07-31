---
title: Daemon API
description: The Panel Firewall daemon REST API — bearer + HMAC-SHA256 authentication, all endpoints for firewall control, lists, SMART, analytics, and import/export.
---

# Daemon API

The daemon exposes a Fastify REST API on `127.0.0.1:8475` (default). The panel's `DaemonClient` is the only caller in normal operation — this reference is for debugging and custom integrations.

---

## Authentication

Three layers, all required for every endpoint except `/api/v1/health`:

1. **IP allowlist** — `allowedIps` in `config.json` (default `127.0.0.1` only)
2. **Bearer token** — `Authorization: Bearer <64-hex>` (constant-time compare)
3. **HMAC signature** — mutations require:

```
X-PFW-Signature: hex(HMAC-SHA256(token, METHOD + "\n" + PATH + "\n" + TIMESTAMP + "\n" + sha256(body)))
X-PFW-Timestamp: <unix seconds>   # must be within timestampDriftSec (60s) of daemon time
```

Rate limits apply per scope (health 60/min, reads 120/min, mutations 30/min). Responses use a `{success, data, error, meta}` envelope, and every request gets an `X-Correlation-ID`.

::: tip Read-only shortcut
GET endpoints need only layers 1–2 (bearer, no HMAC) — handy for debugging:
```bash
curl -s -H "Authorization: Bearer $(sudo cat /etc/panel-firewall/token)" \
  http://127.0.0.1:8475/api/v1/state | jq
```
:::

---

## Health & state

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/api/v1/health` | none | Liveness, version, capability probe (iptables/ipset present), degraded flag |
| GET | `/api/v1/state` | bearer | Full tracked state: chains, ipsets, rule counts, ownership registry |

## Firewall control

| Method | Path | Auth | Purpose |
|---|---|---|---|
| POST | `/api/v1/firewall/plan` | HMAC | Dry-run: returns the desired-state plan (chains/rules/ipsets) without applying |
| POST | `/api/v1/firewall/apply` | HMAC | Transactional apply: checkpoint → atomic `iptables-restore` → verify → arms the 60s confirm window |
| GET | `/api/v1/firewall/pending/:id` | bearer | Poll a pending apply (`confirmed` / `rolled_back` / `expired`) |
| POST | `/api/v1/firewall/confirm` | HMAC | Confirm the apply (blocked until `confirmDelaySec` after apply) |
| POST | `/api/v1/firewall/rollback` | HMAC | Roll back to the pre-apply checkpoint |
| GET | `/api/v1/firewall/checkpoints` | bearer | List checkpoints (`id`, `createdAt`, `reason`, hash fields, size) |
| GET | `/api/v1/firewall/reconcile/status` | bearer | Drift status between desired and kernel state |
| POST | `/api/v1/firewall/reconcile` | HMAC | Force a reconcile (auto-repairs drift when `autoRepair` is on) |
| POST | `/api/v1/firewall/safe-mode/clear` | HMAC | Clear SAFE_MODE after a failed rollback — explicit admin recovery |
| GET | `/api/v1/firewall/audit` | bearer | Daemon audit log entries |

### Apply payload

```json
{
  "globalEnabled": true,
  "protectedPorts": { "http": 80, "https": 443 },
  "preset": "medium",
  "adminWhitelist": ["203.0.113.10/32"],
  "permanentBlacklist": [],
  "smart": { "enabled": true, "alpha": 0.1, "beta": 0.05, "anomalyDeviation": 4 },
  "l7": {
    "enabled": true, "logPaths": [], "rateLimitRpm": 600, "windowSec": 60,
    "banDurationSec": 900, "excludePrivate": true, "maxBansPerMinute": 20
  }
}
```

All CIDRs are strictly validated (`zCidr`: real octets, prefix 0–32, no leading zeros); `logPaths` is capped at 16 × 256 chars. A successful apply returns `pendingApplyId`, `appliedAt`, `expiresAt`, and `confirmAvailableAt`.

## Lists

| Method | Path | Auth | Purpose |
|---|---|---|---|
| POST | `/api/v1/lists/whitelist` | HMAC | Add whitelist CIDR (normally managed via the panel + apply) |
| POST | `/api/v1/lists/blacklist` | HMAC | Add permanent blacklist CIDR |
| POST | `/api/v1/lists/temporary-ban` | HMAC | Temp-ban an IP (`durationSec`, `reason`) |
| GET | `/api/v1/lists/temporary-bans` | bearer | Active temp bans with expiry and reason |

## SMART

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/api/v1/smart/state` | bearer | SMART status: mitigation level, EWMA snapshot, active bans, and the `l7` block (`enabled`, `watchedFiles`, `trackedIps`, `bannedTotal`, `recentBans`) |
| POST | `/api/v1/smart/preset` | HMAC | Switch the runtime preset |

## Analytics

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/api/v1/analytics/series?metrics=pps_in,cps_in,l7_requests_per_min&range=1h` | bearer | Timeseries buckets (10s) for graphs. Metrics: `pps_in`, `cps_in`, `syn_per_sec`, `conntrack_pct`, `conntrack_count`, `l7_requests_per_min`, `l7_banned_total`, `l7_tracked_ips`, `l7_dropped_offenses` |
| GET | `/api/v1/analytics/summary` | bearer | Aggregates: mitigations, bans, EWMA state, audit counts |

## Webhooks & import/export

| Method | Path | Auth | Purpose |
|---|---|---|---|
| POST | `/api/v1/webhooks/sync` | HMAC | Replace the daemon's webhook set (from the panel DB) |
| GET | `/api/v1/webhooks/log` | bearer | Delivery log (`at`, `event`, `url`, `statusCode`, `outcome`) |
| GET | `/api/v1/export` | bearer | Export bundle (format `pterodactyl-panel-firewall` v1) |
| POST | `/api/v1/import` | HMAC | Import a bundle (dry-run supported) |

---

## Error codes worth knowing

| Code | Meaning |
|---|---|
| `400 validation_error` | Payload failed zod validation (bad CIDR, oversize `logPaths`, …) |
| `401` | Bad/missing bearer token or IP not in `allowedIps` |
| `403` | Bad HMAC signature or timestamp outside the drift window |
| `423 SAFE_MODE_ACTIVE` | Daemon is in safe mode — mutation frozen until `/firewall/safe-mode/clear` |
| `425` | Confirm attempted before `confirmDelaySec` elapsed |
| `429` | Rate limited |
