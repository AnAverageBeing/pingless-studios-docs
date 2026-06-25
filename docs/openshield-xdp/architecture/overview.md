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
        L[loader] -->|pin / unpin| BPF[/sys/fs/bpf/openshield/]
        C[collector] -->|read ringbuf| M8
        C -->|poll every 1s| M6
        B[baseline] -->|write every 5s| M7
        BM[ban mgr] -->|cleanup every 5s| M4
        T[TUI] --> S[Unix socket]
    end

    M8 --> C
```

## Key Concepts

**XDP** — Programs attach to the NIC driver. Process packets before the kernel allocates an skb. No memory allocation per packet, direct DMA access.

**BPF Maps** — 13 maps pinned to `/sys/fs/bpf/openshield/`. Survive restarts and crashes.

**PERCPU** — Four maps use per-CPU arrays. Each CPU writes to its own copy. Zero lock contention.

**LRU Auto-Eviction** — ip_stats, ban, and syn_cookie maps use LRU hashing. Under spoofed-source floods, oldest entries evicted automatically.

## Component Roles

| Component | Language | Role |
|-----------|----------|------|
| XDP program | C → BPF | Packet inspection, rate tracking, cookie generation, ban insertion |
| Loader | Go | BPF loading, map init, XDP attachment |
| Collector | Go | Per-second stats, ring buffer reading, webhook dispatch |
| TUI | Go (Bubbletea) | Terminal dashboard, 7 screens |
| Baseline learner | Go | EMA smoothing, attack classification |
| Ban manager | Go | Expired ban cleanup, star decay |
| Panic coordinator | Go | Cross-CPU panic detection |
