# Alerter & Telemetry

## Overview

OpenShield can dispatch real-time notifications to Discord via webhook when security events occur. The alerter runs in the collector goroutine, processing events from the BPF ring buffer and formatting them as Discord embeds.

## Configuration

```yaml
alerter:
  enabled: false
  webhook_url: ""
  events: []                # empty = all events
  # events: [attack_start, ban_triggered, panic_mode]  # filtered

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

## Rate Limiting

::: warning Concurrency Guard
The alerter uses a **buffered Go channel as a semaphore** with capacity 10. Each alert dispatch acquires a slot; if all 10 slots are occupied, new alerts are **silently dropped** (non-blocking `select` with `default:` case). This prevents alert storms from saturating the HTTP client or spamming the webhook endpoint.
:::

```go
// Internal implementation (alerter.go)
sem: make(chan struct{}, 10)   // max 10 concurrent dispatches

func (a *Alerter) Send(eventType string, details map[string]interface{}) {
    // ...
    select {
    case a.sem <- struct{}{}:   // acquire slot
    default:                    // all slots full → drop
        return
    }
    defer func() { <-a.sem }()  // release slot
    go a.dispatch(payload)
}
```

- **HTTP timeout**: 5 seconds per dispatch
- **Concurrent max**: 10 in-flight requests
- **Non-blocking drop**: If all slots are full, the alert is dropped with no queuing

## Event Types

| Event Key | Trigger Condition | Discord Color |
|-----------|------------------|---------------|
| `attack_start` | Baseline learner detects attack state (traffic > threshold × spike%) | 🔴 Red (`#FF0000`) |
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

## Discord Embed Format

Each alert is dispatched as a Discord webhook message with a single rich embed:

```json
{
  "embeds": [{
    "title": "ban_triggered",
    "color": 16744448,
    "timestamp": "2026-06-27T12:00:00Z",
    "footer": {
      "text": "openshield on fw-prod-01"
    },
    "fields": [
      { "name": "ip", "value": "203.0.113.42", "inline": true },
      { "name": "reason", "value": "pps_threshold: 1200 > 850", "inline": true },
      { "name": "score", "value": "105", "inline": true },
      { "name": "duration", "value": "3600s", "inline": true }
    ]
  }]
}
```

The `hostname` in the footer is set from `os.Hostname()` at alerter initialization, falling back to `"unknown"`.

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
