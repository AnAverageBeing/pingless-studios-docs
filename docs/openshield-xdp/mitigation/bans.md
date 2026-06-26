# Ban System

When an IP's suspicion score reaches the effective threshold, a ban entry is inserted. Ban entries are checked on every packet against every source IP.

## Ban lifecycle

```
Suspicion ≥ threshold → insert ban_entry{expiry, reason, score}
                      → increment ban_count (repeat offender tracking)
                      → emit event via ring buffer
                      → userspace webhook (if configured)

Ban checks (every packet):
  Single IP → ban_map lookup → if matched and expiry > now → DROP
  Subnet    → LPM trie lookup → longest prefix match → if matched → DROP

Ban expiry (userspace every 5s):
  ban_manager iterates ban maps → deletes entries where expiry ≤ now
                                  → decays star level if eligible
```

## Ban types

| Type | Map | Mechanism |
|------|-----|-----------|
| Single-IP (IPv4) | `ban_map` | HASH lookup by source IP |
| Single-IP (IPv6) | `ban_map_v6` | HASH lookup by ip6_key |
| Subnet (IPv4) | `subnet_ban_map` | LPM trie, longest prefix match |
| Subnet (IPv6) | `subnet_ban_map_v6` | LPM trie |

## Auto subnet escalation

When `auto_escalation_enabled: true`, each single-IP ban in a /24 prefix increments a PERCPU counter. When the counter reaches `auto_escalation_threshold` (default 5), a /24 subnet ban is inserted with `duration = ban_duration * 2`.

## Star system

| Star | Duration multiplier | Clean period |
|------|-------------------|--------------|
| 0 (first) | ×1 | — |
| 1 | ×2 | `star_decay_seconds` |
| 2 | ×4 | ↓ |
| 3 | ×8 | ↓ |
| 4 | ×16 | ↓ |
| 5 (max) | ×32 | — |

Stars decay by 1 level after `star_decay_seconds` (default 3600s) of clean behaviour. Handled by the userspace ban manager.

## Ban reason codes

| Code | Reason |
|------|--------|
| 1 | PPS exceeded |
| 2 | BPS exceeded |
| 3 | TCP PPS exceeded |
| 4 | UDP PPS exceeded |
| 5 | ICMP PPS exceeded |
| 6 | SYN PPS exceeded |
| 7 | New source flood |
| 8 | Bogus TCP flags |
| 9 | Connection rate |
| 10 | TTL anomaly |
| 11 | Packet size anomaly |
| 12 | Entropy spoofing |
| 13 | SYN/FIN ratio |

## Persistence

Bans survive across loader restarts (maps are pinned). IP statistics are cleared on restart.

## Related pages

[Rate Limiting](/openshield-xdp/mitigation/rate-limiting) · [Whitelist](/openshield-xdp/mitigation/whitelist) · [Rate-Based Detection](/openshield-xdp/detection-engine/rate-based)
