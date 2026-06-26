# Mitigation Overview

When an IP's suspicion score reaches the effective threshold, OpenShield automatically bans it. Multiple escalation mechanisms tighten response for repeat offenders and subnet-level attacks.

## Ban types

| Type | Mechanism | Duration |
|------|-----------|----------|
| Single-IP | Inserted when suspicion ≥ threshold | `ban_duration` (default 1 hour) |
| LPM subnet | CIDR-level via longest-prefix-match trie | `subnet_ban_duration` (default 2 hours) |
| Auto /24 escalation | After N single-IP bans per /24 | `ban_duration * 2` |
| Star (repeat) | 6 offence levels, multipliers ×1–×32 | `ban_duration * star_multiplier` |

## Ban reason codes

| Code | Trigger |
|------|---------|
| 1 | PPS threshold exceeded |
| 2 | BPS threshold exceeded |
| 3 | TCP PPS exceeded |
| 4 | UDP PPS exceeded |
| 5 | ICMP PPS exceeded |
| 6 | SYN PPS exceeded |
| 7 | New source flood |
| 8 | Bogus TCP flags |
| 9 | Connection rate limit |
| 10 | TTL anomaly |
| 11 | Packet size anomaly |
| 12 | Entropy spoofing |
| 13 | SYN/FIN ratio |

## Effective threshold

Repeat offenders face a stricter threshold:

```
effective = suspicion_threshold * 2 / (2 + ban_count)
Minimum floor = 10
```

First offence: full threshold (default 100). After 3 bans: threshold drops to 40.

## Rate limiting modes

| Mode | Config | Behaviour |
|------|--------|-----------|
| Threshold scoring | `rate_limit_mode: threshold` | Additive suspicion per violation. Cumulative ban |
| Token bucket | `rate_limit_mode: token_bucket` | Per-IP token bucket with `token_rate` and `token_burst` |

## Whitelist

Per-IP flags with granular bypass:

| Flag | Effect |
|------|--------|
| Full bypass (0x0000) | Skip all checks |
| Skip ban (0x0001) | Skip ban + subnet ban |
| Skip rate (0x0002) | Skip rate threshold |
| Skip validation (0x0004) | Skip private/bogon/bogus TCP |

::: tip Empty-map fast path
When 0 whitelist entries exist, the whitelist lookup is skipped entirely. Same for bans. Updated automatically after every config change.
:::

## Related pages

[Ban System](/openshield-xdp/mitigation/bans) · [Rate Limiting](/openshield-xdp/mitigation/rate-limiting) · [Detection Overview](/openshield-xdp/detection-engine/overview)
