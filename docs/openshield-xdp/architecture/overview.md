# Architecture Overview

```mermaid
graph LR
    subgraph "Kernel (XDP)"
        X[openshield_xdp] --> M1[config_map]
        X --> M2[whitelist_map]
        X --> M3[ip_stats_map]
        X --> M4[ban_map]
        X --> M5[subnet_ban_map]
        X --> M6[global_stats_map]
        X --> M7[baseline_map]
        X --> M8[events_map]
        X --> M9[panic_bucket_map]
        X --> M10[prof_map]
        X --> M11[l7_sig_map]
        X --> M12[prefix_ban_map]
        X --> M13[syn_cookie_map]
    end

    subgraph "Userspace (Go)"
        L[loader] -->|pin/unpin| BPF[/sys/fs/bpf/openshield/]
        C[collector] -->|read ringbuf| M8
        C -->|poll 1s| M6
        B[baseline] -->|write 5s| M7
        BM[ban mgr] -->|cleanup 5s| M4
        T[TUI] --> S[Unix socket]
    end
```

## Key concepts

**XDP** — programs attach to the NIC driver. Zero per-packet allocation, zero sk_buff overhead.

**PERCPU** — 4 maps use per-CPU arrays. Each CPU writes independently. Userspace aggregates by summing.

**LRU auto-eviction** — ip_stats, ban, and syn_cookie maps auto-evict oldest entries under memory pressure.

## Component roles

| Component | Language | Role |
|-----------|----------|------|
| XDP program | C → BPF | Packet inspection, rate tracking, cookie generation, ban insertion |
| Loader | Go | BPF loading, map init, XDP attachment, config population |
| Collector | Go | Per-second stats polling, ring buffer reading, webhook dispatch |
| TUI | Go (Bubbletea) | 7-screen terminal dashboard |
| Baseline learner | Go | EMA smoothing, attack classification, threshold adjustment |
| Ban manager | Go | Expired ban cleanup, star decay, map maintenance |
| Panic coordinator | Go | Cross-CPU panic detection and response |

## Map reference

| Map | Type | Entries | RW |
|-----|------|---------|-----|
| `config_map` | ARRAY | 1 | userspace write, kernel read |
| `whitelist_map` / `_v6` | HASH | 10K | userspace write, kernel read |
| `ip_stats_map` / `_v6` | LRU_HASH | 100K | kernel R/W, userspace read |
| `ban_map` / `_v6` | LRU_HASH | 50K | kernel write, userspace R/W |
| `subnet_ban_map` / `_v6` | LPM_TRIE | 1K/512 | userspace write, kernel read |
| `prefix_ban_map` | PERCPU_ARRAY | 256 | kernel R/W |
| `global_stats_map` | PERCPU_ARRAY | 1 | kernel write, userspace read |
| `baseline_map` | ARRAY | 1 | userspace write, kernel read |
| `panic_bucket_map` | PERCPU_ARRAY | 1 | kernel R/W |
| `events_map` | RINGBUF | 256KB | kernel write, userspace read |
| `prof_map` | PERCPU_ARRAY | 27 | kernel write, userspace read |
| `l7_sig_map` | ARRAY | 16 | userspace write, kernel read |
| `syn_cookie_map` | LRU_HASH | 100K | kernel R/W |

## Related pages

[Pipeline](/openshield-xdp/detection-engine/pipeline) · [Map Layout](/openshield-xdp/architecture/maps) · [Developer Guide](/openshield-xdp/developer-guide/overview)
