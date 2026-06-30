# Mitigation Overview

When an IP's suspicion score reaches the effective threshold, OpenShield automatically bans it. Multiple escalation mechanisms tighten response for repeat offenders and subnet-level attacks. The **Bloom filter** accelerates whitelist lookups, and **freplace hot-patching** enables live updates to mitigation stages without reloading the XDP program.

## Ban types

| Type | Mechanism | Duration |
|------|-----------|----------|
| Single-IP | Inserted when `suspicion_score ≥ effective_threshold` | `ban_duration * star_multiplier` (default 1 hour) |
| LPM subnet | CIDR-level via longest-prefix-match trie | `subnet_ban_duration` (default 2 hours) |
| Auto /24 escalation | After N single-IP bans per /24 | `ban_duration * 2` |
| Auto /64 escalation | After N single-IP bans per /64 (IPv6) | `ban_duration * 2` |
| Star (repeat) | 6 offense levels, multipliers ×1–×32 | `ban_duration * star_multiplier` |

## Ban reason codes

| Code | Trigger | Description |
|------|---------|-------------|
| 1 | `BAN_REASON_PPS` | Packets/s exceeded |
| 2 | `BAN_REASON_BPS` | Bytes/s exceeded |
| 3 | `BAN_REASON_TCP_PPS` | TCP packets/s exceeded |
| 4 | `BAN_REASON_UDP_PPS` | UDP packets/s exceeded |
| 5 | `BAN_REASON_ICMP_PPS` | ICMP packets/s exceeded |
| 6 | `BAN_REASON_SYN_PPS` | SYN packets/s exceeded |
| 7 | `BAN_REASON_NEW_SOURCE` | New source flood |
| 8 | `BAN_REASON_BOGUS_TCP` | Bogus TCP flags |
| 9 | `BAN_REASON_CONN_RATE` | Connection rate limit |
| 10 | `BAN_REASON_TTL_ANOMALY` | TTL anomaly |
| 11 | `BAN_REASON_PKT_ANOMALY` | Packet size anomaly |
| 12 | `BAN_REASON_ENTROPY` | Entropy spoofing |
| 13 | `BAN_REASON_SYN_FIN` | SYN/FIN ratio |

The primary reason is determined by highest-weighted violation: SYN > ICMP > UDP > TCP > BPS > PPS.

## Star system: repeat offender escalation

Six star levels with geometric duration multipliers:

| Star level | `ban_count` | Duration multiplier | Effective ban |
|------------|-------------|---------------------|---------------|
| 0 (first) | 0 | ×1 | 1 hour |
| 1 | 1 | ×2 | 2 hours |
| 2 | 2 | ×4 | 4 hours |
| 3 | 3 | ×8 | 8 hours |
| 4 | 4 | ×16 | 16 hours |
| 5 (max) | 5+ | ×32 | 32 hours |

### Star decay

Stars decay by 1 level after a configurable clean period:

```
star_decay_seconds = 3600 per star level
```

Example: A star-3 (×8) IP that stays clean for 3 × 3600 = 10,800 seconds (3 hours) decays to star-2 (×4), then continues decaying hourly. The userspace ban manager handles star decay on its 5-second poll cycle.

## Panic circuit breaker

A **per-CPU probabilistic drop** that activates when packet rate exceeds `panic_pps_rate` on any CPU:

```c
// Per-CPU panic bucket (PERCPU_ARRAY, no contention)
if (pb->last_second != this_sec) {
    pb->pkt_count = 0;           // Reset window
    pb->last_second = this_sec;
}
pb->pkt_count++;
if (pb->pkt_count > cfg->panic_pps_rate) {
    // Probabilistic drop at panic_drop_ratio %
    if (cfg->panic_drop_ratio >= 100 ||
        (pb->pkt_count % 100) < cfg->panic_drop_ratio) {
        return XDP_DROP;
    }
}
```

| Config field | Default | Description |
|-------------|---------|-------------|
| `panic_pps_rate` | 200,000 | Per-CPU PPS trigger (0 = disabled) |
| `panic_drop_ratio` | 80 | Percentage of packets to drop in panic mode |
| `panic_global_pps_threshold` | 5,000,000 | Global PPS threshold for coordinated panic (userspace-managed) |
| `panic_coordination_enabled` | true | Enable cross-CPU panic coordination |

The panic breaker runs before any per-IP checks (stage 3 in the pipeline). It acts as a **last-resort bulkhead**: when the CPU is overwhelmed, drop packets probabilistically rather than trying to track per-IP state (which would add overhead during overload).

::: warning Panic breaker drops indiscriminately
Panic drops are *not* tracked per-IP. Legitimate traffic is dropped alongside attack traffic. Use only as a fail-safe — tune per-IP rate thresholds first. Set `panic_pps_rate: 0` to disable.
:::

## freplace hot-patching

Five mitigation stages support **runtime replacement** via BPF freplace. This is **opt-in** (`make FREPLACE=1`, kernel ≥ 6.10, `CONFIG_DEBUG_INFO_BTF=y`); default builds inline these stages for universal kernel portability:

| Stage | freplace target | Can replace |
|-------|----------------|-------------|
| Ban check | `SEC("freplace/stage_ban_check")` | Single-IP + subnet ban logic, event emission |
| Rate limit | `SEC("freplace/stage_rate_limit")` | Threshold scoring or token bucket algorithm |
| Connection tracking | `SEC("freplace/stage_conn_track")` | Blind SYN-ACK/RST detection |
| UDP amplification | `SEC("freplace/stage_amp_check")` | Amplification detection rules |
| L7 filter | `SEC("freplace/stage_l7_filter")` | L7 signature matching |

An example ban check replacement at `ebpf/modules/ban_check_freplace.c` adds per-hit ringbuf event emission. To deploy a replacement:

1. Compile with `make -C ebpf/modules`
2. Attach via `FreplaceManager.AttachFreplace("stage_ban_check", "path/to/ban_check.o")`

The main XDP program is **never unloaded** — freplace swaps the subprogram pointer atomically via `bpf_link`.

## Whitelist

Per-IP flags with granular bypass:

| Flag | Value | Effect |
|------|-------|--------|
| `WL_FULL_BYPASS` | `0x0000` | Skip all checks, immediate `XDP_PASS` |
| `WL_SKIP_BAN` | `0x0001` | Skip ban + subnet ban lookup |
| `WL_SKIP_RATE` | `0x0002` | Skip rate threshold checks |
| `WL_SKIP_VALIDATION` | `0x0004` | Skip L3/L4 validation (private/bogon/bogus TCP) |

A **Bloom filter** (3 hashes, 150K u64 entries, ~1% FPR) is checked before the HASH whitelist lookup. If the Bloom filter says "definitely not present", the more expensive HASH lookup is skipped entirely, saving ~60–100ns per packet.

The `whitelist_empty` config flag skips ALL whitelist lookups when the map has 0 entries. Updated automatically after every config change.

::: tip Empty-map fast path
When 0 whitelist entries exist, the whitelist lookup is skipped entirely. Same for bans (`bans_empty` flag). Updated automatically after every config change.
:::

## Related pages

[Ban System](/openshield-xdp/mitigation/bans) · [Rate Limiting](/openshield-xdp/mitigation/rate-limiting) · [Whitelist](/openshield-xdp/mitigation/whitelist) · [Detection Engine](/openshield-xdp/detection-engine/overview)
