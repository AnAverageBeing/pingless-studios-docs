# Rate-Based Detection

Per-IP, per-second rate thresholds with additive suspicion scoring. When an IP exceeds a threshold, points are added to its suspicion score. When the cumulative score reaches the ban threshold, the IP is banned.

## How scoring works

```
Window (1 second):
  IP sends N packets, M bytes, T TCP, U UDP, I ICMP, S SYN
  For each threshold exceeded → add score to suspicion_score
  suspicion_score decays by suspicion_decay% each window
  When suspicion_score ≥ suspicion_threshold → ban
```

## Thresholds and scores

| Metric | Default threshold | Default score | Config field |
|--------|------------------|---------------|--------------|
| Packets/s | 1,000 | 20 | `pps_threshold` / `pps_score` |
| Bytes/s | 10 MB/s | 20 | `bps_threshold` / `bps_score` |
| TCP/s | 800 | 15 | `tcp_pps_threshold` / `tcp_pps_score` |
| UDP/s | 500 | 15 | `udp_pps_threshold` / `udp_pps_score` |
| ICMP/s | 100 | 25 | `icmp_pps_threshold` / `icmp_pps_score` |
| SYN/s | 200 | 30 | `syn_pps_threshold` / `syn_pps_score` |

SYN floods are scored higher by default (30 points vs 20 for PPS) because they are almost always malicious at high rates.

## Check frequency

Threshold scoring evaluates on two triggers:

1. **Window reset** — every 1 second, the per-IP window counters become the rate
2. **Per-packet** — every 256th packet (`pkt_count & 0xFF == 0`) triggers an evaluation

This catches rate violations within ~256 packets instead of waiting the full second.

## Suspicion decay

Each window reset, the suspicion score is multiplied by `suspicion_decay`:

```yaml
static:
  suspicion_decay: 0.5    # Keep 50% per second
```

A clean IP's score halves each second. After 3–5 windows of normal traffic, a one-time burst is fully decayed.

## Repeat offenders

The effective ban threshold tightens for repeat offenders:

```
effective = suspicion_threshold * 2 / (2 + ban_count)
Minimum floor = 10
```

First ban: full threshold (default 100). Third ban: drops to 40. The floor of 10 prevents over-aggressive banning.

## Token bucket alternative

Set `rate_limit_mode: token_bucket` for a different model:

```yaml
static:
  rate_limit_mode: token_bucket
  token_rate: 1000          # Tokens refilled per second per IP
  token_burst: 2000         # Max burst before draining
```

Tokens refill proportionally to elapsed nanoseconds. First packet seeds the bucket. Each packet drains 1 token. Drop when empty.

## Configuration

```yaml
static:
  enabled: true
  pps_threshold: 1000
  syn_pps_threshold: 200
  suspicion_threshold: 100
  ban_duration: 3600
  suspicion_decay: 0.5
  rate_limit_mode: threshold
```

## Related pages

[L2/L3/L4 Validation](/openshield-xdp/detection-engine/l3-l4) · [Mitigation](/openshield-xdp/mitigation/overview)
