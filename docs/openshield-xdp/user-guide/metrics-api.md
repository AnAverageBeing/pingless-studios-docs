# Metrics & Control API

Since v2.0, OpenShield-XDP can serve **everything the TUI shows** as plain JSON over HTTP — traffic, mitigation, attack state, bans, top offenders/ports, behavior clusters, attack history, and the active mitigation config (secrets stripped). Use it to feed Grafana, a status page, or your own tooling. There is no Prometheus dependency; you just poll an endpoint.

Since v2.7, the same endpoint can optionally expose a **full remote-control API** (`/control/*`) — everything the TUI can do: bans, whitelist, geo blocking, runtime config edits, baseline management, L7 rules, attack bulk-bans. This is **off by default** and gated behind `metrics.control_enabled`. Read the [warning](#control_api_warning) before turning it on.

**Both are disabled by default.**

## Enabling

In `/etc/openshield/openshield.yaml`:

```yaml
metrics:
  enabled: true
  listen: "127.0.0.1:9100"   # local only; use 0.0.0.0:9100 for remote dashboards
  api_key: "osk_..."         # pre-generated randomly per install
  rate_limit_per_sec: 10     # per source IP; 0 = unlimited
  whitelist: []              # IP/CIDR allowlist; empty = any IP (key still required)
  control_enabled: false     # /control/* management API — see the warning below
```

Key, rate-limit and listen-address changes apply **without a restart** (`sudo openshield reload`), and so does `control_enabled` — toggling it takes effect on the very next request. Changing `whitelist` requires a loader restart (`sudo openshield unload && sudo openshield load`).

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

## Authentication, allowlist, rate limits

Every request passes through the same pipeline: **IP allowlist → API key → per-IP rate limit → handler**. Control endpoints add a fourth step, the `control_enabled` gate.

Send the key as a Bearer token (or `?key=` query parameter):

```bash
curl -H "Authorization: Bearer osk_1a2b3c..." http://127.0.0.1:9100/metrics
curl "http://127.0.0.1:9100/metrics/baseline?key=osk_1a2b3c..."
```

- **Allowlist** — when `metrics.whitelist` is non-empty, only those IPs/CIDRs may connect at all (403 otherwise). The key is still required.
- **Rate limit** — `metrics.rate_limit_per_sec` is a per-source-IP token bucket (burst 2× the rate, min 4). Read and control endpoints share the same bucket.

### Errors

| Code | Meaning |
|------|---------|
| 400 | Bad request — invalid JSON body, missing/invalid field, or the operation rejected the input |
| 401 | Missing/invalid API key |
| 403 | Source IP not in `metrics.whitelist`, **or** control API disabled |
| 405 | Wrong HTTP method for the path |
| 429 | Rate limit exceeded |
| 503 | Section not available in this build |

All errors are JSON: `{ "error": "..." }`. A 403 from a `/control/*` path with body `{ "error": "control API disabled (metrics.control_enabled: false)" }` means the gate is off.

## Read endpoints

| Path | Method | Description |
|------|--------|-------------|
| `/metrics` | GET | Full JSON snapshot (schema below) |
| `/health` | GET | `{ "status": "ok", "generated_at": <unix> }` |
| `/metrics/baseline` | GET | Baseline learner status + 30-day history |
| `/metrics/geo` | GET | Geo-blocking mode, country list, background jobs |
| `/metrics/alerter` | GET | Webhook delivery statistics |
| `/metrics/autofetch` | GET | Blocklist auto-fetcher status |
| `/metrics/access` | GET | Whitelist + blacklist entries |
| `/metrics/targets` | GET | Top destination IPs by current rate — "which VPS IP is being attacked" on dedicated hosts. Each target carries a per-IP state (`normal` / `elevated` / `under_attack`) on multi-IP dedicated hosts (v2.12.0+, see `tenant.mode`) |
| `/metrics/forensics` | GET | Forensics storage: dir, size vs cap, collecting/halted state, cleanup counters |
| `/metrics/ovh` | GET | OVH edge-mitigation module: mode, protected IPs, rules pushed/removed, rate-limit hits |
| `/metrics/schedule` | GET | Active suppression windows |
| `/metrics/dstips` | GET | Tracked destination IPs overview: tracked count + top-5 destinations by current pps |
| `/metrics/dstip?ip=<addr>` | GET | Full per-destination analysis: registry/blackhole flags, current rates, per-second series, 1m/5m/15m windows, attack history |

The sub-endpoints wrap their payload in `{ "generated_at": <unix>, "data": ... }` (schedule uses `"schedule"` instead of `"data"`). They require the same auth as `/metrics` and work regardless of `control_enabled`.

### `/metrics`

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

- **`snapshot.global`** — `current_pps`, `current_bps`, `passed_pps`, drop/pass rates, totals. The `current_pps` vs `passed_pps` pair is your proof-of-mitigation: what's arriving vs what got through. Since v2.13.5: `live_pass_rate` / `live_drop_rate` (percentages for the *current interval* — the cumulative `pass_rate`/`drop_rate` mix in peacetime traffic) and `live_ips_passed` / `live_ips_blocked` (distinct sources this interval that passed vs are currently blocked).
- **`snapshot.traffic`** — per-protocol rates, peaks, `top_ports`, and per-second history series (`pps_history`, `bps_history`, `drop_rate_history`, newest last — graph them directly).
- **`snapshot.attack`** — `state` (`NORMAL`/`UNDER_ATTACK`), type, duration, baseline + spike thresholds, packets dropped, IPs banned, new sources blocked.
- **`snapshot.bans` / `snapshot.top_offenders`** — active ban count and recent entries (IP, reason, expiry, star level); per-IP rates and suspicion scores.
- **`behavior`** — `enabled`, `auto_block`, live clusters (`state`, `confidence`, `reasons` like "machine-paced timing"), and learned per-port baselines.
- **`attacks`** — up to 50 recent attack records: peak/avg/p95 pps, IPs involved, protocol mix, `forensics_dir`.
- **`config`** — flat `key = value` map of the active mitigation config. License keys, webhook URLs and other secrets are excluded by construction.

### `/metrics/baseline`

```jsonc
{
  "generated_at": 1754325123,
  "data": {
    "success": true,
    "learning": "active",              // or "suppressed (schedule)", "frozen (attack active)"
    "live":      { "date": "...", "pps": 12400.0, "bps": 9800000.0, "tcp_pps": 0, "udp_pps": 0, "icmp_pps": 0, "syn_pps": 0 },
    "effective": { "...": "same shape — live merged with the 30-day history" },
    "spike_pps": 45000, "spike_bps": 38000000,
    "floor_pps": 500,   "floor_bps": 400000,
    "history_days": 30, "oldest_day": "2026-07-07",
    "history": [ { "date": "2026-08-05", "pps": 12100.0, "...": "..." } ],
    "merge_live_weight": 0.4, "merge_recency_weight": 0.6
  }
}
```

### `/metrics/geo`

```jsonc
{
  "generated_at": 1754325123,
  "data": {
    "mode": "block",            // "block" (listed countries dropped) or "allow" (only listed countries pass)
    "countries": ["CN", "RU"],
    "jobs": { "BR": "blocked 4213 prefixes" }   // per-country background job state
  }
}
```

### `/metrics/alerter`

```jsonc
{
  "generated_at": 1754325123,
  "data": {
    "webhook_set": true,
    "queued": 0, "dropped": 0, "sent": 137,
    "last_success_at": 1754325100,
    "last_error": ""             // omitted when empty
  }
}
```

### `/metrics/autofetch`

```jsonc
{
  "generated_at": 1754325123,
  "data": {
    "status": { "...": "fetcher state (last run, entries loaded, errors)" },
    "categories": ["c2", "botnets", "..."],
    "urls": [],
    "never_block": ["203.0.113.10"]
  }
}
```

### `/metrics/access`

```jsonc
{
  "generated_at": 1754325123,
  "data": {
    "whitelist": [ { "ip": "203.0.113.10", "version": 4 } ],
    "blacklist": [ { "ip": "198.51.100.77", "version": 4, "note": "attack #12 bulk-ban" } ]
  }
}
```

### `/metrics/schedule`

```jsonc
{
  "generated_at": 1754325123,
  "schedule": [ { "kind": "baseline", "until": "2026-08-06T20:00:00Z" } ]
}
```

Empty when no suppression windows are active.

### `/metrics/egress`

TC egress policer status (v2.18+; all zeros with `active: false` while the opt-in feature is off):

```jsonc
{
  "generated_at": 1754325123,
  "data": {
    "active": true,
    "passed_total": 1823310,
    "dropped_total": 1338533,
    "dropped_udp": 1338000,
    "dropped_icmp": 12,
    "dropped_syn": 521
  }
}
```

Counters are cumulative since attach, summed over the policer's per-CPU stats map.

### `/metrics/dstips`

Tracked destination IPs overview — how many destinations the per-IP tracker holds, plus the top-5 by current pps (the snapshot's `dstip` section):

```jsonc
{
  "generated_at": 1754325123,
  "data": {
    "tracked": 142,
    "top": [
      { "ip": "203.0.113.10", "pps": 48200, "...": "..." },
      { "ip": "203.0.113.11", "pps": 9100,  "...": "..." }
    ]
  }
}
```

### `/metrics/dstip?ip=<addr>`

Full per-destination analysis for one address — current rates, a per-second time series, 1m/5m/15m window aggregates, and every recorded attack against that destination. `attached`/`blackholed` come from the attached-IP registry and tenant blackhole. Missing or invalid `ip` returns 400.

```jsonc
{
  "generated_at": 1754325123,
  "data": {
    "ip": "203.0.113.10",
    "tracked": true,
    "attached": true,
    "blackholed": false,
    "auto_blackhole": false,
    "current": { "pps": 48200, "bps": 385600000, "dps": 12000 },
    "step_sec": 1,
    "series": [ { "t": 1754325100, "pps": 46000, "bps": 368000000, "dps": 11500 } ],
    "windows": {
      "1m":  { "peak_pps": 51000, "avg_pps": 44000, "peak_bps": 408000000, "avg_bps": 352000000, "drops": 1820000 },
      "5m":  { "...": "same shape" },
      "15m": { "...": "same shape" }
    },
    "attacks": [ { "start": 1754321000, "end": 1754321600, "type": "udp_flood", "peak_pps": 480000, "verdict": "mitigated" } ],
    "ongoing_attack": false
  }
}
```

<a id="control_api_warning"></a>
## ⚠️ Control API — read this before enabling

Setting `metrics.control_enabled: true` turns the API key into a **root-equivalent credential**. Anyone holding it can:

- reconfigure every runtime-safe mitigation setting (`POST /control/config`),
- ban or whitelist arbitrary IPs — including locking you out or unbanning attackers,
- wipe the entire blacklist/whitelist,
- change geo-blocking mode and countries,
- import a poisoned traffic baseline (blinding spike detection),
- promote L7 drop rules, toggle the blocklist fetcher, bulk-ban attack IPs.

**Only enable it when you also:**

1. **Set `metrics.whitelist`** to exactly the IPs of your dashboard/management hosts.
2. **Firewall the listen port** (e.g. `iptables -A INPUT -p tcp --dport 9100 -s <dashboard> -j ACCEPT; ... -j DROP`) so nothing else can even attempt a key guess.
3. Keep `listen` on `127.0.0.1` unless the dashboard truly lives on another host — and never expose the port on a public interface without both protections above.

Every successful control call is written to the audit log (visible in the TUI log feed) with its endpoint and parameters. Control request bodies are capped at 2 MB.

```yaml
metrics:
  enabled: true
  control_enabled: true          # root-equivalent — protect the port!
  whitelist: ["198.51.100.20"]   # your dashboard host ONLY
```

## Control endpoints

All are POST unless noted, all require auth, all return `{ "error": "..." }` with a sensible code on failure and a small JSON object on success. Toggle at runtime with `sudo openshield reload` after editing `control_enabled`.

### Runtime config

**`GET /control/config`** — current value of every runtime-safe setting:

```jsonc
{ "settings": { "static.enabled": true, "static.pps_threshold": 5000, "metrics.control_enabled": true, "...": "..." } }
```

**`POST /control/config`** — apply runtime settings. This is the exact same code path as the TUI/CLI config editor and `openshield reload`: unknown or read-only settings are rejected, changes are written to the BPF config map, and the YAML is persisted.

```bash
curl -X POST -H "Authorization: Bearer osk_..." -H "Content-Type: application/json" \
  -d '{"settings":{"static.enabled":true,"dynamic.global_pps_threshold":100000}}' \
  http://127.0.0.1:9100/control/config
```

New runtime-safe settings (same endpoint, hot-applied):

- `dynamic.port_syn_pps` — per-destination-port new-connection/s cap (0 = off); excess SYNs to that port are dropped.
- `geoip.enforce_mode` — `always` applies the geo country list at all times; `attack` only while an attack is declared.

**`POST /control/reload`** (v2.18+) — hot reload over HTTP: re-reads `/etc/openshield/openshield.yaml`, validates it, and applies every runtime-safe setting through the exact same path as `openshield reload` (no restart, no re-attach). Edit the YAML by hand or from your own tooling, then:

```bash
curl -X POST -H "Authorization: Bearer osk_..." http://127.0.0.1:9100/control/reload
# => { "success": true, "applied": 123 }
```

`applied` counts the runtime-safe fields pushed through the update path. Read-only fields (interface, map sizes) still require a real reload — they are reported by `GET /control/config` but not re-applied here.

```jsonc
{ "success": true, "applied": 2 }
```

### Whitelist

```bash
# Add (also unbans the IP and exempts it from auto-fetch)
curl -X POST ... -d '{"ip":"203.0.113.10"}'  .../control/whitelist
# Remove
curl -X DELETE ... -d '{"ip":"203.0.113.10"}' .../control/whitelist
# Remove everything
curl -X POST ... .../control/whitelist/clear
# Import a file of IPs/CIDRs (one per line; path is on the server)
curl -X POST ... -d '{"path":"/root/my-allowlist.txt"}' .../control/whitelist/import
```

Responses: `{ "success": true, "ip": "..." }`, `{ "success": true, "removed": 42 }`, `{ "success": true, "added": 980, "skipped": 3 }`.

### Blacklist

```bash
# Ban an IP (duration_sec optional; 0 = 24h default)
curl -X POST ... -d '{"ip":"198.51.100.77","duration_sec":86400,"note":"bruteforce"}' .../control/blacklist
# Unban
curl -X DELETE ... -d '{"ip":"198.51.100.77"}' .../control/blacklist
# Remove every single-IP ban
curl -X POST ... .../control/blacklist/clear
```

Responses mirror the whitelist ones.

### Geo blocking

```bash
# Switch mode: "block" = listed countries are dropped, "allow" = only listed countries pass
curl -X POST ... -d '{"mode":"block"}' .../control/geo/mode
# Toggle a country (ISO 3166-1 alpha-2). Blocking runs in the background —
# watch /metrics/geo "jobs" for completion.
curl -X POST ... -d '{"country":"CN"}' .../control/geo/toggle
```

```jsonc
{ "success": true, "country": "CN", "blocked": true }   // blocked=true: added (job started), false: removed
```

### Baseline management

**`GET /control/baseline/export`** — the live baseline + 30-day history as a raw JSON document (the response body *is* the export — save it verbatim):

```bash
curl -H "Authorization: Bearer osk_..." .../control/baseline/export > baseline-backup.json
```

**`POST /control/baseline/import`** — replace the live baseline + history from an export:

```bash
curl -X POST ... -d "{\"payload\": $(cat baseline-backup.json | jq -Rs .)}" .../control/baseline/import
```

**`POST /control/baseline/delete`** — drop one poisoned day; the merged baseline is recomputed immediately:

```bash
curl -X POST ... -d '{"date":"2026-08-04"}' .../control/baseline/delete
# → { "success": true, "date": "2026-08-04", "history_days": 29 }
```

### Auto-fetch (blocklist feeds)

```bash
curl -X POST ... -d '{"enabled":true}'              .../control/autofetch/toggle
curl -X POST ... -d '{"entry":"203.0.113.0/24"}'    .../control/autofetch/never-add
curl -X POST ... -d '{"entry":"203.0.113.0/24"}'    .../control/autofetch/never-remove
curl -X POST ...                                    .../control/autofetch/fetch-now
```

`never_block` is a **fetch-only** exemption (the fetcher skips those ranges) — it is not a firewall whitelist.

### Scheduled suppression

Temporarily suspend baseline learning or behavior auto-block (e.g. during a planned traffic spike or event):

```bash
# Suppress baseline learning for 1 hour
curl -X POST ... -d '{"action":"suppress","kind":"baseline","duration_sec":3600}' .../control/schedule
# Clear early ("kind" may also be "all")
curl -X POST ... -d '{"action":"clear","kind":"baseline"}' .../control/schedule
```

```jsonc
{ "success": true, "schedule": [ { "kind": "baseline", "until": "2026-08-06T20:00:00Z" } ] }
```

### L7 block rules

Promote a payload signature into the live L7 drop map (16 slots) and persist it:

```bash
curl -X POST ... -d '{
  "port": 25565, "proto": 17, "offset": 0,
  "pattern": "fefd", "mask": "ffff",
  "min_payload": 0, "max_payload": 0
}' .../control/block-pattern
```

- `proto`: `6`/`17` or `"tcp"`/`"udp"` (`0`/`"any"`/omitted = both).
- `pattern`/`mask`: hex bytes, max 8 bytes each. `port_is_src: true` matches the source port instead of the destination.
- `name` is optional (auto-generated as `api-<proto>-<port>-<offset>` when omitted).

```jsonc
{ "success": true, "name": "api-udp-25565-0" }
```

### Attack history & bulk-ban

**`GET /control/attacks`** — full attack history plus the forensics base directory:

```jsonc
{
  "forensics_dir": "/var/lib/openshield/attacks",
  "records": [ { "number": 12, "forensics_dir": "12-20260806-115223-IST", "peak_pps": 480000, "...": "..." } ]
}
```

**`POST /control/attacks/blacklist`** — bulk-ban every IP involved in an attack (async, chunked; whitelisted and proven-established sources are skipped automatically):

```bash
curl -X POST ... -d '{"forensics_dir":"12-20260806-115223-IST"}' .../control/attacks/blacklist
# → { "success": true, "started": true }
```

**`GET /control/attacks/blacklist/status`** — poll the job:

```jsonc
{ "success": true, "running": true, "total": 152340, "done": 88000,
  "inserted": 87112, "skipped": 888, "message": "bulk-ban running: 88000/152340 ..." }
```

## Integration notes

- Poll every 1–5 s. The payload is a cached snapshot refreshed at the telemetry poll interval (default 1 s) — polling faster just burns rate-limit tokens.
- The config file (and thus the key) is stored `0600`, root-only.
- Binding remotely? Keep `listen` on localhost unless you need it, and set `whitelist` to your dashboard host's IP when listening on all interfaces:

```yaml
metrics:
  listen: "0.0.0.0:9100"
  whitelist: ["198.51.100.20"]
```

Rotate the key if it ever leaks: `sudo openshield key regen`. If the key leaks **while `control_enabled` is on**, treat it like a root compromise: rotate immediately and review the audit log.

## Next steps

[Config Values in Plain Language](/openshield-xdp/user-guide/config-values) · [CLI Reference](/openshield-xdp/user-guide/cli) · [TUI Guide](/openshield-xdp/user-guide/tui)
