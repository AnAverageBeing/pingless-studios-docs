# Alerter & Telemetry

## Overview

OpenShield can dispatch real-time notifications to Discord via webhook when security events occur. The alerter runs in the collector goroutine, processing events from the BPF ring buffer and formatting them as Discord embeds.

## Configuration

```yaml
alerter:
  enabled: false
  webhook_url: ""
  events: []                # empty = all events
  # events: [attack_start, attack_update, attack_end, ban_triggered, panic_mode]
  graph_enabled: true       # attach labeled traffic graph to attack-end alerts
  show_banned_ips: false    # inline banned IPs in ban alerts (default off: categorized .txt attached instead)
  geo_breakdown: true       # continent/country share of banned IPs (needs GeoIP db)
  attack_updates: true      # progress embeds while an attack is ongoing

telemetry:
  poll_interval: 1
  event_rate_limit: 100
  top_offenders_count: 20
  log_level: info
  snapshot_interval: 1
```

### Alerter Fields

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `alerter.enabled` | `bool` | `false` | Master toggle for webhook alerts |
| `alerter.webhook_url` | `string` | `""` | Discord webhook URL (must be full `https://discord.com/api/webhooks/...`) |
| `alerter.events` | `[]string` | `[]` | Event filter — if not empty, only listed events trigger alerts |
| `alerter.graph_enabled` | `bool` | `true` | Attach the attack traffic graph (incoming vs passed PPS + BPS, labeled axes) to attack-end alerts |
| `alerter.show_banned_ips` | `bool` | `false` | List banned IPs inline in ban alerts; default off — a categorized `.txt` (grouped by reason) is attached instead |
| `alerter.geo_breakdown` | `bool` | `true` | Continent/country breakdown (% share + IP counts) in ban-batch alerts; requires the GeoIP database |
| `alerter.attack_updates` | `bool` | `true` | Send progress embeds while an attack is ongoing |

## Rate Limiting

All webhook traffic flows through **one paced dispatch queue** (depth 64).
A single dispatcher goroutine delivers messages with a minimum 1.2s
spacing, so a burst of events during an attack can never trip Discord's
webhook rate limit:

- **HTTP 429 honored**: on a rate-limit response the dispatcher sleeps the
  server-provided `Retry-After` window and retries once before dropping.
- **Overflow drops, never blocks**: when the queue is full, new alerts are
  dropped and counted — the firewall never blocks on Discord.
- **Coalesced warnings**: alerter failures (429s, network errors) reach the
  log feed through a rate-limited sink (max one per 30s, with
  "+N similar suppressed"). They are never written to the terminal.
- **Event batching**: all per-IP event types (bans, new-source floods,
  threshold violations, subnet bans, anomaly detections...) accumulate per
  type and flush every 5 seconds as ONE merged embed per type, with the IP
  list as a categorized .txt — never one message per IP.

## Attack Progress Updates

While an attack is ongoing, progress embeds are dispatched at **30s, 60s,
120s, 240s, 480s, 900s** after the start, then every **30 minutes** (hard
cap) for multi-hour attacks. Each update carries current/peak/avg rates,
growth vs the attack's first seconds and vs the previous update, bans, new
sources/s, drop rate, and the next update's ETA as a Discord-localized
timestamp. Disable with `alerter.attack_updates: false`.

## Attack-End Report Semantics

The attack-end embed reports two honest time figures:

- **Duration** — how long attack traffic was actually elevated (start →
  traffic normalized, i.e. 2 sustained samples below the recovery
  threshold). **State Cleared** shows the full state-machine duration
  including the recovery window when it ran longer.
- **Mitigation Time** — "blocked in Xs": when the *passed* rate (traffic
  getting through mitigation) collapsed. A flood whose sender keeps
  transmitting after being banned shows a high incoming line with a flat
  passed line — the graph's green `passed` line makes this visible.

## Event Types

| Event Key | Trigger Condition | Discord Color |
|-----------|------------------|---------------|
| `attack_start` | Baseline learner detects attack state (traffic > threshold × spike%) | 🔴 Red (`#FF0000`) |
| `attack_update` | Ongoing-attack progress (30s, growing intervals, 30min cap) | 🟠 Amber (`#E67E22`) |
| `attack_end` | Attack state clears after recovery period | 🟢 Green (`#00FF00`) |
| `ban_triggered` | IP banned (suspicion score reached threshold) | 🟠 Orange (`#FF8C00`) |
| `panic_mode` | Panic circuit breaker activates (per-CPU PPS > `panic_pps_rate`) | 🟣 Magenta (`#FF00FF`) |
| `new_source_flood` | New unique IP rate exceeds `new_source_limit` | 🟡 Yellow (`#FFFF00`) |
| `threshold_violation` | IP exceeded threshold (PPS/BPS/TCP/UDP/ICMP/SYN) | ⚪ Grey |
| `subnet_ban` | Auto subnet ban triggered (escalation) | 🔵 Blue |
| `entropy_spoof` | Entropy-based spoofing detected | 🟦 Cyan |
| `ttl_anomaly` | TTL deviation detected | 🟦 Cyan |
| `packet_size_anomaly` | Avg packet size outside [min, max] range | 🟦 Cyan |
| `syn_fin_flood` | SYN:FIN ratio exceeded threshold | 🔴 Red |
| `conn_rate_flood` | Connection rate limit exceeded | 🟡 Yellow |
| `cluster_suspicious` | Behavior cluster crossed the suspicious threshold | ⚪ Grey |
| `cluster_malicious` | Behavior cluster crossed the malicious threshold | 🔴 Red |

## Event Rate Limiting (Ring Buffer)

Separate from the webhook rate limiter, the BPF side also enforces an event emission cap:

```
telemetry.event_rate_limit: 100   # max events/s emitted to ring buffer
```

This is enforced in the XDP program itself — when the per-second event counter exceeds `event_rate_limit`, further event emissions to the ring buffer are silently suppressed. This protects both kernel memory and the userspace collector from being overwhelmed during an attack.

## Telemetry Fields

| Field | Default | Description |
|-------|---------|-------------|
| `poll_interval` | `1` | Seconds between collector reads of `global_stats_map` |
| `event_rate_limit` | `100` | Max events/s emitted by BPF to ring buffer |
| `top_offenders_count` | `20` | Top N IPs displayed in TUI / logged |
| `log_level` | `"info"` | `debug`, `info`, `warn`, or `error` |
| `snapshot_interval` | `1` | Seconds between TUI stat snapshots |

## Related Pages

- [Configuration Reference](./reference) — All config fields
- [Configuration Validation](./validation) — Runtime config updates
- [TUI Overview](/openshield-xdp/tui/overview) — Live monitoring dashboard
