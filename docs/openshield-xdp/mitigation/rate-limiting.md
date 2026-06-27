# Rate Limiting

OpenShield provides two rate limiting modes: **threshold scoring** (additive suspicion accumulation leading to bans) and **token bucket** (strict per-IP packet rate enforcement). The mode is selected via `rate_limit_mode` in the static config.

## Mode selection

```yaml
static:
  rate_limit_mode: threshold       # or: token_bucket
```

| Mode | Config value | Behavior |
|------|-------------|----------|
| Threshold scoring | `threshold` | Per-metric threshold checks with additive suspicion. Cumulative score triggers ban. |
| Token bucket | `token_bucket` | Per-IP token pool. Each packet consumes 1 token. Drop when empty. No ban tracking. |

The mode is checked on every packet in `stage_rate_limit`. Only the selected mode's code path executes.

## Threshold scoring mode

### Additive scoring

Each 1-second window, the IP's rate counters (`pps`, `bps`, `tcp_pps`, `udp_pps`, `icmp_pps`, `syn_pps`) are compared against configured thresholds. For each exceeded threshold, a configurable score is added to `suspicion_score`:

```c
if (stats->pps > cfg->pps_threshold)
    stats->suspicion_score += cfg->pps_score;        // +20

if (stats->bps > cfg->bps_threshold)
    stats->suspicion_score += cfg->bps_score;        // +20

if (stats->tcp_pps > cfg->tcp_pps_threshold)
    stats->suspicion_score += cfg->tcp_pps_score;    // +15

if (stats->udp_pps > cfg->udp_pps_threshold)
    stats->suspicion_score += cfg->udp_pps_score;    // +15

if (stats->icmp_pps > cfg->icmp_pps_threshold)
    stats->suspicion_score += cfg->icmp_pps_score;   // +25

if (stats->syn_pps > cfg->syn_pps_threshold)
    stats->suspicion_score += cfg->syn_pps_score;    // +30
```

A single packet type can trigger multiple scores simultaneously. For example, a SYN flood also counts toward PPS, TCP PPS, and SYN PPS — potentially triggering all three for a total of `20 + 15 + 30 = 65` points per window.

### Window-based detection

Detection runs on two triggers:

1. **Window reset** (1-second interval) — counters become rates, suspicion decays, scores are checked
2. **Per-packet sampling** (every 256th packet: `pkt_count & 0xFF == 0`) — mid-window check for fast rate violations

```c
// Only check on window reset OR every 256th packet
if (!window_reset && (stats->pkt_count & 0xFF) != 0)
    return STAGE_PASS;  // Skip check
```

### Sampling optimization

The 256-packet sampling (`& 0xFF`) reduces per-packet overhead. Without it, every packet would trigger a multi-threshold comparison (6 thresholds × branching = significant BPF instruction count). With sampling, only ~0.4% of packets (1 in 256) trigger the full threshold check. This keeps the common path fast while still catching rate violations within ~256 packets (~0.3ms at 850 PPS).

### Suspicion decay

Subtractive decay: `suspicion_threshold / 10` points subtracted each window (floor 5):

```c
u32 decay_amount = cfg->suspicion_threshold / 10;
if (decay_amount < 5) decay_amount = 5;
if (stats->suspicion_score > decay_amount)
    stats->suspicion_score -= decay_amount;
else
    stats->suspicion_score = 0;
```

### Ban insertion

When `suspicion_score >= effective_threshold`, a ban entry is created:

```c
// Effective threshold (repeat offenders)
u32 effective = cfg->suspicion_threshold;
if (stats->ban_count > 0) {
    effective = (cfg->suspicion_threshold * 2) / (2 + stats->ban_count);
    if (effective < 10) effective = 10;
}

if (stats->suspicion_score >= effective) {
    // Determine primary reason
    // Create ban entry with star-based duration
    // Insert into ban_map (or ban_map_v6)
    // Auto-escalate subnet if needed
    // Increment ban_count
    // Emit event
    return DROP_RATE_LIMITED;
}
```

### Scoring defaults

| Metric | Score | Config field |
|--------|-------|--------------|
| PPS violation | 20 | `pps_score` |
| BPS violation | 20 | `bps_score` |
| TCP PPS violation | 15 | `tcp_pps_score` |
| UDP PPS violation | 15 | `udp_pps_score` |
| ICMP PPS violation | 25 | `icmp_pps_score` |
| SYN PPS violation | 30 | `syn_pps_score` |

## Token bucket mode

A per-IP token bucket with configurable fill rate and burst size:

```c
// Refill tokens based on elapsed time
u64 elapsed = now - stats->token_refill_ns;
if (elapsed > WINDOW_NS) elapsed = WINDOW_NS;  // Cap to prevent overflow
u64 refill = elapsed * cfg->token_rate / NS_PER_SEC;
stats->tokens += refill;
if (stats->tokens > cfg->token_burst)
    stats->tokens = cfg->token_burst;

// First packet seeds the bucket
if (first_packet) {
    stats->tokens = cfg->token_burst;
}

// Drain and check
if (stats->tokens < 1)
    return DROP_RATE_LIMITED;
stats->tokens--;
```

### Token bucket properties

| Property | Description |
|----------|-------------|
| **Rate enforcement** | Hard limit: packets beyond `token_rate` are dropped |
| **Burst tolerance** | Up to `token_burst` packets can arrive simultaneously |
| **No suspicion tracking** | Token bucket doesn't use `suspicion_score` or trigger bans |
| **No state accumulation** | No repeat-offender tracking; each window is independent |
| **Proportional refill** | Tokens refill based on actual elapsed nanoseconds, not fixed windows |

::: tip Token bucket vs threshold scoring
Token bucket provides **predictable, hard rate limits** — ideal for protecting a service with a known capacity. Threshold scoring provides **adaptive, behavior-based protection** — better for mixed-traffic environments where burst patterns vary.
:::

## Configuration reference

```yaml
static:
  # Rate limit mode
  rate_limit_mode: threshold                  # threshold | token_bucket

  # Threshold scoring
  pps_threshold: 850
  bps_threshold: 8912896
  tcp_pps_threshold: 680
  udp_pps_threshold: 425
  icmp_pps_threshold: 85
  syn_pps_threshold: 170
  pps_score: 20
  bps_score: 20
  tcp_pps_score: 15
  udp_pps_score: 15
  icmp_pps_score: 25
  syn_pps_score: 30
  suspicion_threshold: 100
  ban_duration: 3600
  suspicion_decay: "0.5"                    # Note: subtractive, not multiplicative

  # Token bucket
  token_rate: 1000                           # Tokens/s per IP
  token_burst: 2000                          # Max burst tokens

  # Attack mode threshold tightening
  # (dynamic section)
  attack_threshold_multiplier: 0.5           # 50% of normal thresholds during attack
```

## Related pages

[Ban System](/openshield-xdp/mitigation/bans) · [Whitelist](/openshield-xdp/mitigation/whitelist) · [Rate-Based Detection](/openshield-xdp/detection-engine/rate-based)
