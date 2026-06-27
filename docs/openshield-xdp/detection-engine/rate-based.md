# Rate-Based Detection

Per-IP, per-second rate thresholds with **additive suspicion scoring**. When an IP exceeds a threshold, points are added to its `suspicion_score`. When the cumulative score reaches the effective ban threshold, the IP is banned.

## How scoring works

```
Window (1 second):
  IP sends N packets, M bytes, T TCP, U UDP, I ICMP, S SYN
  For each threshold exceeded → add score to suspicion_score
  suspicion_score decays by suspicion_threshold/10 each window
  When suspicion_score ≥ effective_threshold → ban
```

## Thresholds and scores

| Metric | Default threshold | Default score | Config field |
|--------|-------------------|---------------|--------------|
| Packets/s | 850 | 20 | `pps_threshold` / `pps_score` |
| Bytes/s | 8,912,896 (~8.5 MB/s) | 20 | `bps_threshold` / `bps_score` |
| TCP/s | 680 | 15 | `tcp_pps_threshold` / `tcp_pps_score` |
| UDP/s | 425 | 15 | `udp_pps_threshold` / `udp_pps_score` |
| ICMP/s | 85 | 25 | `icmp_pps_threshold` / `icmp_pps_score` |
| SYN/s | 170 | 30 | `syn_pps_threshold` / `syn_pps_score` |

SYN floods are scored higher by default (30 points vs 20 for PPS) because they are almost always malicious at high rates.

## Check frequency

Threshold scoring evaluates on two triggers:

1. **Window reset** — every 1 second, the per-IP window counters become the rate
2. **Per-packet sampling** — every 256th packet (`pkt_count & 0xFF == 0`) triggers a mid-window evaluation

This catches rate violations within ~256 packets instead of waiting the full second.

## Suspicion decay

Suspicion score uses **subtractive decay** — a fixed amount is subtracted each window reset:

```c
decay_amount = suspicion_threshold / 10;  // default: 100/10 = 10
if (decay_amount < 5) decay_amount = 5;   // floor of 5
stats->suspicion_score -= decay_amount;   // never goes below 0
```

| Config value | Decay amount | Time to clear a 100-point burst |
|-------------|-------------|--------------------------------|
| 100 | 10 | 10 windows (10s) |
| 200 | 20 | 5 windows (5s) |
| 50 | 5 (floor) | 20 windows (20s) |

The `suspicion_decay_percent` config field controls the *decay amount* indirectly: `decay_percent >= 100` disables decay entirely. Otherwise the subtractive formula above applies.

::: warning Subtractive, not multiplicative
The old documentation described multiplicative decay (`score * 0.5`). The actual implementation is subtractive. This is deliberate — subtractive decay prevents a single massive burst from keeping the score permanently elevated.
:::

## Repeat offenders

The effective ban threshold tightens for repeat offenders:

```
effective_threshold = suspicion_threshold * 2 / (2 + ban_count)
minimum floor = 10
```

| Ban count | Effective threshold (default 100) |
|-----------|-----------------------------------|
| 0 (first offense) | 100 |
| 1 | 66 |
| 2 | 50 |
| 3 | 40 |
| 5 | 28 |
| 10+ | 10 (floor) |

The `ban_count` is stored per-IP in `ip_stats` and is never reset by the kernel. It is cleared only by userspace restart (all `ip_stats` maps are cleared on loader startup).

## Attack mode threshold tightening

When the dynamic mitigation subsystem declares `ATTACK_UNDER_ATTACK`, all rate thresholds are multiplied by `attack_threshold_multiplier_percent` (default 50%):

```
During attack: pps_threshold = 850 * 0.5  = 425
               bps_threshold = 8912896 * 0.5 = 4456448
               ...etc.
```

This makes detection more aggressive during confirmed attack conditions and returns to normal thresholds when the attack subsides.

## Token bucket alternative

Set `rate_limit_mode: token_bucket` to use token bucket rate limiting instead of threshold scoring:

```yaml
static:
  rate_limit_mode: token_bucket
  token_rate: 1000          # Tokens refilled per second per IP
  token_burst: 2000         # Max tokens before draining
```

Tokens refill proportionally to elapsed nanoseconds. First packet seeds the bucket. Each packet drains 1 token. Drop when empty. The token bucket is independent of suspicion scoring — no ban is triggered on token bucket exhaustion; packets are simply dropped.

::: tip Which mode to choose
- **Threshold scoring**: Best for servers with mixed traffic profiles. Allows brief bursts (decay clears them), bans persistent offenders.
- **Token bucket**: Best for strict rate limiting of known-good traffic patterns. Predictable, no stateful ban tracking.
:::

## Configuration

```yaml
static:
  enabled: true
  pps_threshold: 850
  bps_threshold: 8912896
  tcp_pps_threshold: 680
  udp_pps_threshold: 425
  icmp_pps_threshold: 85
  syn_pps_threshold: 170
  suspicion_threshold: 100
  ban_duration: 3600
  suspicion_decay: "0.5"                # Actually subtractive (see above)
  rate_limit_mode: threshold
  token_rate: 0                         # Set >0 for token bucket mode
  token_burst: 0                        # Set >0 for token bucket mode
```

## Related pages

[Ban System](/openshield-xdp/mitigation/bans) · [Rate Limiting](/openshield-xdp/mitigation/rate-limiting) · [Mitigation Overview](/openshield-xdp/mitigation/overview)
