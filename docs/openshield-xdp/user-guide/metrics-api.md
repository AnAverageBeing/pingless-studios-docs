# Metrics API

Since v2.0, OpenShield-XDP can serve **everything the TUI shows** as plain JSON over HTTP — traffic, mitigation, attack state, bans, top offenders/ports, behavior clusters, attack history, and the active mitigation config (secrets stripped). Use it to feed Grafana, a status page, or your own tooling. There is no Prometheus dependency; you just poll an endpoint.

**It is disabled by default.**

## Enabling

In `/etc/openshield/openshield.yaml`:

```yaml
metrics:
  enabled: true
  listen: "127.0.0.1:9100"   # local only; use 0.0.0.0:9100 for remote dashboards
  api_key: "osk_..."         # pre-generated randomly per install
  rate_limit_per_sec: 10     # per source IP; 0 = unlimited
  whitelist: []              # IP/CIDR allowlist; empty = any IP (key still required)
```

Key, rate-limit and listen-address changes apply **without a restart** (`sudo openshield reload`). Changing `whitelist` requires a loader restart (`sudo openshield unload && sudo openshield load`).

## Getting your URL and key

```bash
sudo openshield key
```

Prints the endpoint URL, health path, your API key, and a ready-to-paste `curl` example — but only when the endpoint is enabled; otherwise it tells you how to enable it.

Managing the key (both are hot-applied, no restart):

```bash
sudo openshield key set <your-key>   # bring your own key (min 8 chars)
sudo openshield key regen            # rotate to a fresh random key
```

## Endpoints

| Path | Method | Auth | Description |
|------|--------|------|-------------|
| `/metrics` | GET | yes | Full JSON snapshot (schema below) |
| `/health` | GET | yes | `{ "status": "ok", "generated_at": <unix> }` |

Send the key as a Bearer token (or `?key=` query parameter):

```bash
curl -H "Authorization: Bearer osk_1a2b3c..." http://127.0.0.1:9100/metrics
```

### Errors

| Code | Meaning |
|------|---------|
| 401 | Missing/invalid API key |
| 403 | Source IP not in `metrics.whitelist` |
| 429 | Rate limit exceeded |
| 405 | Non-GET method |

All errors are JSON: `{ "error": "..." }`.

## Response shape (`/metrics`)

```jsonc
{
  "generated_at": 1754325123,
  "snapshot":  { ... },  // the full TUI dashboard snapshot
  "behavior":  { ... },  // behavior engine state + clusters
  "attacks":   [ ... ],  // last 50 attack records
  "config":    { ... }   // active mitigation config, secrets stripped
}
```

Highlights of what's inside:

- **`snapshot.global`** — `current_pps`, `current_bps`, `passed_pps`, drop/pass rates, totals. The `current_pps` vs `passed_pps` pair is your proof-of-mitigation: what's arriving vs what got through.
- **`snapshot.traffic`** — per-protocol rates, peaks, `top_ports`, and per-second history series (`pps_history`, `bps_history`, `drop_rate_history`, newest last — graph them directly).
- **`snapshot.attack`** — `state` (`NORMAL`/`UNDER_ATTACK`), type, duration, baseline + spike thresholds, packets dropped, IPs banned, new sources blocked.
- **`snapshot.bans` / `snapshot.top_offenders`** — active ban count and recent entries (IP, reason, expiry, star level); per-IP rates and suspicion scores.
- **`behavior`** — `enabled`, `auto_block`, live clusters (`state`, `confidence`, `reasons` like "machine-paced timing"), and learned per-port baselines.
- **`attacks`** — up to 50 recent attack records: peak/avg/p95 pps, IPs involved, protocol mix, `forensics_dir`.
- **`config`** — flat `key = value` map of the active mitigation config. License keys, webhook URLs and other secrets are excluded by construction.

## Integration notes

- Poll every 1–5 s. The payload is a cached snapshot refreshed at the telemetry poll interval (default 1 s) — polling faster just burns rate-limit tokens.
- The config file (and thus the key) is stored `0600`, root-only.
- Binding remotely? Keep `listen` on localhost unless you need it, and set `whitelist` to your dashboard host's IP when listening on all interfaces:

```yaml
metrics:
  listen: "0.0.0.0:9100"
  whitelist: ["198.51.100.20"]
```

Rotate the key if it ever leaks: `sudo openshield key regen`.

## Next steps

[Config Values in Plain Language](/openshield-xdp/user-guide/config-values) · [CLI Reference](/openshield-xdp/user-guide/cli) · [TUI Guide](/openshield-xdp/user-guide/tui)
