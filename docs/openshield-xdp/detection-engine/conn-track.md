# Connection Tracking

Drops blind TCP responses — packets that claim to be part of a connection the server never initiated.

## How it works

Each IP's `ip_stats` struct stores `last_syn_seen_ns` — the timestamp of the most recent SYN from that IP. On every TCP packet:

1. If the packet is a SYN, update `last_syn_seen_ns` to `now`
2. If the packet is an ACK (not SYN) and no SYN was seen within `ct_syn_timeout_sec`, drop it as a blind ACK
3. If the packet is a RST and no SYN was ever seen, drop it as a blind RST

## What it catches

| Attack | Signature | Why |
|--------|-----------|-----|
| Blind SYN-ACK flood | ACK without prior SYN | Attacker sends ACKs to an open port, server wastes resources |
| Stale SYN-ACK | SYN older than timeout | Legitimate SYN timed out, returning ACK is now invalid |
| Blind RST flood | RST without prior SYN | Attacker tries to tear down connections |

## Configuration

```yaml
static:
  enable_connection_tracking: false    # Off by default
  ct_syn_timeout_sec: 30              # Max age of last SYN
```

::: tip When to disable
Connection tracking has a small edge case: long-lived connections where the server sends a SYN-ACK first (rare). Most deployments can safely enable it.
:::

## Limitations

| Limitation | Detail |
|-----------|--------|
| Per-IP, not per-connection | Tracks last SYN per source IP, not per 5-tuple |
| No state machine | Doesn't track connection state beyond SYN timestamp |
| Legitimate SYN-ACK | Server-originated connections (e.g., health checks) may trigger false positives |

## Related pages

[Rate-Based Detection](/openshield-xdp/detection-engine/rate-based) · [Pipeline](/openshield-xdp/detection-engine/pipeline)
