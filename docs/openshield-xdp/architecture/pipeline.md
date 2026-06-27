# Pipeline

OpenShield-XDP processes every packet through a fixed **16-stage pipeline**. Each stage is a discrete check; any stage can drop the packet (`XDP_DROP`). Once a packet passes all stages, it is passed to the kernel (`XDP_PASS`).

## Pipeline Order

```mermaid
flowchart LR
    A["NIC"] --> B["0. MAC Filter"]
    B --> C["1. Parse"]
    C --> D["2. SYNPROXY"]
    D --> E["3. Panic Breaker"]
    E --> F["4. Global Detect"]
    F --> G["5. Bloom WL"]
    G --> H["6. HASH WL"]
    H --> I["7. Ban Check"]
    I --> J["8. Validation"]
    J --> K["9. L4 Validation"]
    K --> L["10. UDP Amp"]
    L --> M["11. L7 Sigs"]
    M --> N["12. IP Stats"]
    N --> O["13. NewSrc Flood"]
    O --> P["14. Conn Track"]
    P --> Q["15. Window Reset"]
    Q --> R["16. Rate Limit"]
    R --> S["PASS"]

    style B fill:#4a4,stroke:#2a2,color:#fff
    style C fill:#44a,stroke:#22a,color:#fff
    style D fill:#a4a,stroke:#82a,color:#fff
    style E fill:#a44,stroke:#822,color:#fff
    style F fill:#a4a,stroke:#82a,color:#fff
    style G fill:#4aa,stroke:#288,color:#fff
    style H fill:#4aa,stroke:#288,color:#fff
    style I fill:#a84,stroke:#862,color:#fff
    style J fill:#44a,stroke:#22a,color:#fff
    style K fill:#44a,stroke:#22a,color:#fff
    style L fill:#a44,stroke:#822,color:#fff
    style M fill:#a44,stroke:#822,color:#fff
    style N fill:#4a4,stroke:#2a2,color:#fff
    style O fill:#a44,stroke:#822,color:#fff
    style P fill:#a84,stroke:#862,color:#fff
    style Q fill:#44a,stroke:#22a,color:#fff
    style R fill:#a84,stroke:#862,color:#fff
```

::: tip Legend
🟢 Green = early fast-pass / bookkeeping &nbsp; 🔵 Blue = validation &nbsp; 🟣 Purple = feature-gated &nbsp; 🔴 Red = detection &nbsp; 🟠 Orange = freplace-able stage
:::

## Stage Reference

| # | Stage | Action | Freplace? | Feature Gate |
|---|-------|--------|:---------:|:------------:|
| 0 | **MAC Filter** | Whitelist/blacklist by source MAC address (8-slot config). Drops immediately before any IP parsing. | — | — |
| 1 | **Parse** | Extract Ethernet, IP, and L4 headers into `struct packet_info`. Bails out on non-IP or malformed packets. | — | — |
| 2 | **SYNPROXY** | Cookie-based TCP SYN flood protection. Replies with SYN-ACK containing a cryptographic cookie. Valid ACKs with correct cookies are passed. | — | `OPENSHIELD_SYNPROXY` (≥ 5.15) |
| 3 | **Panic Breaker** | Per-CPU packet rate check with probabilistic drop. When a CPU exceeds `panic_pps_rate`, drops `panic_drop_ratio`% of packets. | — | — |
| 4 | **Global Detection** | Window-based entropy spoofing detection + SYN/FIN ratio anomaly check. Drops when source IP entropy is high (spoofed flood) or SYN:FIN ratio exceeds threshold. | — | `OPENSHIELD_GLOBAL_DETECT` (≥ 6.10) |
| 5 | **Bloom Whitelist** | Fast negative-check: if the Bloom filter says "definitely not present", skip the expensive HASH whitelist lookup. Saves ~60-100ns/pkt. | — | — |
| 6 | **HASH Whitelist** | Exact-match lookup in `whitelist_map` (IPv4) or `whitelist_map_v6` (IPv6). `WL_FULL_BYPASS` entries skip all further checks. Other flags disable specific stages (`WL_SKIP_BAN`, `WL_SKIP_VALIDATION`, `WL_SKIP_RATE`). | — | — |
| 7 | **Ban Check** | Lookup in `ban_map` + fallthrough to `subnet_ban_map` (LPM_TRIE) for CIDR bans. Also checks `prefix_ban_map` for auto-escalation. | ✅ | — |
| 8 | **Source Validation** | Private/bogon IP filtering (`10.0.0.0/8`, `127.0.0.0/8`, etc). Controlled by `enable_private_filter`. | — | — |
| 9 | **L4 Validation** | TCP flag sanity (`enable_bogus_tcp_filter`) and L4 bounds check (`enable_malformed_filter`). Drops SYN+FIN, null flags, and truncated L4 payloads. | — | — |
| 10 | **UDP Amplification** | Detects amplified DNS responses (`sport=53, QR=1, large payload`) and generic UDP reflection on configurable ports (8 slots). | ✅ | — |
| 11 | **L7 Signatures** | Byte-pattern matching at configurable offsets. Up to 16 signature slots (slot 0 always available; slots 1-15 require `OPENSHIELD_L7_MULTISLOT`). | ✅ | `OPENSHIELD_L7_MULTISLOT` (≥ 6.10) for slots 1-15 |
| 12 | **IP Stats Lookup** | Lookup or create `ip_stats` entry. New IPs get a fresh stats struct with token bucket pre-filled. | — | — |
| 13 | **New-Source Flood** | If the global new-source creation rate exceeds `new_source_limit`, bans new IPs for `new_source_ban_duration_sec`. Uses spinlock-protected `new_source_map`. | — | — |
| 14 | **Connection Tracking** | Detects blind TCP ACK/RST floods by tracking `last_syn_seen_ns`. Drops non-SYN TCP packets from IPs that haven't sent a SYN within `ct_syn_timeout_sec`. | ✅ | — |
| 15 | **Window Reset** | 1-second sliding window: resets per-second counters, decays suspicion scores, runs advanced per-window checks (TTL anomaly, packet size anomaly, connection rate). | — | — |
| 16 | **Rate Limiting** | Either threshold-scoring mode (adds to `suspicion_score` per violation) or token-bucket mode. Bans IPs exceeding `suspicion_threshold`. | ✅ | — |

## Feature-Gated Stages

Two stages are compile-time gated based on the running kernel version:

### SYNPROXY (`OPENSHIELD_SYNPROXY` — kernel ≥ 5.15)

```c
#ifdef OPENSHIELD_SYNPROXY
    int synproxy_ret = synproxy_dispatch(ctx, &info, cfg, now);
    if (synproxy_ret == XDP_TX)       return XDP_TX;   // SYN-ACK sent
    if (synproxy_ret == XDP_DROP)     return XDP_DROP;  // invalid cookie
    if (synproxy_ret == XDP_PASS)     return XDP_PASS;  // valid cookie ACK
#endif
```

Below kernel 5.15, the entire SYNPROXY block compiles away — the pipeline jumps directly from parse to panic breaker.

### L7 Multislot (`OPENSHIELD_L7_MULTISLOT` — kernel ≥ 6.10)

The base L7 filter uses slot 0 only. With `OPENSHIELD_L7_MULTISLOT`, slots 1-15 are also checked via an unrolled loop. Below kernel 6.10, slots 1-15 are silently ignored (the map entries exist but are never read).

::: warning Kernel Version Detection
The Makefile detects the running kernel via `uname -r` at build time. Feature gates are **compile-time only** — you must rebuild after a kernel upgrade to enable new features. See [Kernel Feature Gates](./kernel-gates.md) for details.
:::

## Early-Exit Optimization

The pipeline is organized for maximum early-drop efficiency:

1. **MAC filter** runs before any IP parsing — no packet metadata needed
2. **SYNPROXY** runs immediately after parse — SYN floods are the most common attack
3. **Panic breaker** protects CPU before expensive per-IP lookups
4. **Bloom filter** skips expensive HASH whitelist lookup for non-whitelisted IPs
5. **`bans_empty` / `whitelist_empty`** flags skip entire lookup blocks when maps are empty
