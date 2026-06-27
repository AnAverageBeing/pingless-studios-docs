# Architecture Overview

OpenShield-XDP is an XDP eBPF firewall written in C (BPF) and Go (userspace). It attaches to a network interface at the earliest possible point in the Linux networking stack and makes drop/pass decisions before the kernel allocates an SKB.

## Architecture Diagram

```mermaid
flowchart TB
    subgraph Userspace["Userspace (Go)"]
        CLI["OpenShield CLI"]
        TUI["Terminal UI"]
        Loader["BPF Loader"]
        FM["FreplaceManager"]
        Alerter["Alerter Engine"]
    end

    subgraph Kernel["Kernel (eBPF/XDP)"]
        direction TB
        NIC["NIC Driver"] --> XDP["XDP Hook"]
        XDP --> MAC["0. MAC Filter"]
        MAC --> PARSE["1. Parse Packet"]
        PARSE --> SYNPROXY["2. SYNPROXY<br/>(kernel ≥ 5.15)"]
        SYNPROXY --> PANIC["3. Panic Breaker"]
        PANIC --> GLOBAL["4. Global Detection<br/>entropy · SYN/FIN ratio"]
        GLOBAL --> BLOOM["5. Bloom Filter<br/>fast negative check"]
        BLOOM --> WL["6. HASH Whitelist"]
        WL --> BAN["7. Ban Check<br/>(prefix + subnet)"]
        BAN --> VAL["8. Source Validation"]
        VAL --> L4VAL["9. L4 Validation"]
        L4VAL --> AMP["10. UDP Amp Check"]
        AMP --> L7["11. L7 Signatures"]
        L7 --> IPSTATS["12. IP Stats Lookup"]
        IPSTATS --> NEWSRC["13. New-Source Flood"]
        NEWSRC --> CT["14. Connection Track"]
        CT --> WIN["15. Window Reset"]
        WIN --> RATE["16. Rate Limiting"]
        RATE --> PASS["XDP_PASS"]
    end

    subgraph Freplace["freplace Modules (kernel ≥ 5.11)"]
        FR1["stage_ban_check.o"]
        FR2["stage_conn_track.o"]
        FR3["stage_amp_check.o"]
        FR4["stage_l7_filter.o"]
        FR5["stage_rate_limit.o"]
    end

    subgraph Maps["BPF Maps (pinned to /sys/fs/bpf)"]
        MAPS["config_map · whitelist_map · bloom_map<br/>ban_map · ip_stats_map · global_stats_map<br/>syn_cookie_map · l7_sig_map · baseline_map<br/>subnet_ban_map · prefix_ban_map · panic_bucket_map<br/>new_source_map · prof_map · events_map"]
    end

    CLI --> Loader
    TUI --> Loader
    Loader --> XDP
    FM --> Freplace
    Freplace -. "hot-patch" .-> BAN
    Freplace -. "hot-patch" .-> CT
    Freplace -. "hot-patch" .-> AMP
    Freplace -. "hot-patch" .-> L7
    Freplace -. "hot-patch" .-> RATE
    Alerter --> MAPS
```

## Key Concepts

| Concept | Description |
|---------|-------------|
| **16-stage pipeline** | Packets flow through ~16 ordered stages; any stage can drop the packet. |
| **Bloom filter acceleration** | A 150K-entry Bloom filter does a fast negative-check before the HASH whitelist lookup, saving ~60-100ns per packet for non-whitelisted traffic. |
| **freplace hot-patching** | Five pipeline stages are declared as `__attribute__((noinline))` global functions — they can be replaced at runtime without unloading the XDP program. |
| **Dual-stack** | IPv4 and IPv6 are handled in separate paths with parallel map sets (`ban_map` / `ban_map_v6`, etc). |
| **Per-CPU zero-lock** | `global_stats_map`, `prof_map`, and `panic_bucket_map` use `BPF_MAP_TYPE_PERCPU_ARRAY` — atomic increments without lock contention. |
| **Map pinning** | All maps are pinned to `/sys/fs/bpf/openshield/` — they survive loader restarts. |
| **Compile-time feature gating** | `OPENSHIELD_SYNPROXY`, `OPENSHIELD_L7_MULTISLOT`, `OPENSHIELD_GLOBAL_DETECT`, and `OPENSHIELD_ENTROPY` are enabled based on kernel version detection in the Makefile. |
| **Spinlock-protected global state** | `new_source_map` uses `struct bpf_spin_lock` for safe concurrent access to the new-source flood counter. |

## Map Catalog

| Map | Type | Max Entries | Purpose |
|-----|------|------------|---------|
| `config_map` | ARRAY | 1 | Runtime configuration (written by userspace, read per-packet) |
| `whitelist_map` | HASH | 10K | IPv4 whitelist with per-IP flags |
| `whitelist_map_v6` | HASH | 10K | IPv6 whitelist |
| `ip_stats_map` | LRU_HASH | 100K | Per-IPv4 rate counters & suspicion scores |
| `ip_stats_map_v6` | LRU_HASH | 100K | Per-IPv6 rate counters |
| `ban_map` | LRU_HASH | 50K | Active IPv4 bans with expiry |
| `ban_map_v6` | LRU_HASH | 50K | Active IPv6 bans |
| `subnet_ban_map` | LPM_TRIE | 1K | IPv4 CIDR bans (longest-prefix match) |
| `subnet_ban_map_v6` | LPM_TRIE | 512 | IPv6 CIDR bans |
| `prefix_ban_map` | LRU_HASH | 1K | Per-/24 ban counter for auto-escalation |
| `prefix_ban_map_v6` | LRU_HASH | 512 | Per-/64 ban counter for auto-escalation |
| `new_source_map` | ARRAY | 1 | Spinlock-protected global new-source flood counter |
| `global_stats_map` | PERCPU_ARRAY | 1 | Global packet/byte counters (per-CPU) |
| `baseline_map` | ARRAY | 1 | Dynamic mitigation baseline & attack state |
| `prof_map` | PERCPU_ARRAY | 27 | Profiling path counters (hot-path profiling) |
| `panic_bucket_map` | PERCPU_ARRAY | 1 | Per-CPU panic circuit breaker counters |
| `events_map` | RINGBUF | 256 KB | Event ring buffer for userspace alerts |
| `syn_cookie_map` | LRU_HASH | 100K | SYNPROXY cookie store (kernel ≥ 5.15) |
| `l7_sig_map` | ARRAY | 16 | L7 byte-pattern signature slots |
| `bloom_map` | ARRAY | 150K | Bloom filter for fast whitelist membership test |

**Total memory footprint: ~37 MB** (dominated by `ip_stats_map` + `ip_stats_map_v6` at ~17 MB each for 100K LRU_HASH entries).

## Fast-Path Flags

Two boolean flags in the `config` struct skip expensive lookups when maps are empty:

- **`bans_empty`** — skip `ban_map`, `subnet_ban_map`, and `prefix_ban_map` lookups
- **`whitelist_empty`** — skip `whitelist_map` and Bloom filter checks

These are set by the Go loader after reading current map sizes and reloaded on config changes.

## Performance

| Metric | Value |
|--------|-------|
| Target PPS | 10M+ pps per core |
| Bloom filter overhead | ~60-100ns/pkt (saves 100-200ns when it skips HASH lookup) |
| HASH whitelist lookup | ~100-200ns |
| Per-CPU counter increment | ~10ns (no lock) |
| Pipeline stage count | ~16 stages |

## Further Reading

- [Pipeline Details](./pipeline.md) — stage-by-stage walkthrough
- [Map Layout](./maps.md) — complete map catalog with sizes and access patterns
- [Bloom Filter](./bloom-filter.md) — fast whitelist membership testing
- [freplace Hot-Patching](./freplace.md) — runtime stage replacement
- [Kernel Feature Gates](./kernel-gates.md) — compile-time kernel version detection
