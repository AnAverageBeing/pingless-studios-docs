# Comparison: OpenShield-XDP vs Alternatives

## vs raw iptables / nftables

| | iptables / nftables | OpenShield-XDP |
|---|---------------------|----------------|
| **Where it runs** | Kernel netfilter (after skb allocation) | NIC driver XDP hook (before skb allocation) |
| **Throughput** | ~1-3 Mpps per core | **10M+ pps** per core |
| **CPU cost** | Per-packet context switch + skb alloc overhead | Zero-copy, no context switch — DMA ring direct access |
| **DDoS resistance** | Connection tracking table fills → kernel OOM | Drops at wire speed, kernel never sees the attack traffic |
| **State model** | `conntrack` table (limited, global) | Per-IP LRU map (100K entries, auto-eviction, no global bottleneck) |
| **Configuration** | Thousands of rules, fragile ordering | One YAML file, 34 thresholds, 70 presets |
| **Zero-tune setup** | No | Yes — workload-based profile recommendation |

## vs XDP-Firewall (Gamemann)

[XDP-Firewall](https://github.com/gamemann/XDP-Firewall) is a popular open-source XDP firewall written in C with libconfig. It's solid for basic IP/port filtering.

| | XDP-Firewall | OpenShield-XDP |
|---|-------------|----------------|
| **Detection vectors** | ~5 (IP/port allow/deny, basic rate limiting) | **42** across L2-L7 |
| **DDoS mitigation** | Simple PPS rate limiting per IP | Suspicion scoring, token bucket, L7 pattern matching, entropy spoofing, UDP amplification detection, blind SYN-ACK/RST, TTL anomaly, packet size anomaly |
| **SYN flood** | Basic SYN rate limit | Scalar rate-based SYN gate + per-IP `syn_pps_threshold` — no cookies, loads on all kernels |
| **Auto-config** | Manual config only | **10 profiles × 7 levels** — workload-based recommendations |
| **Kernel portability** | Needs per-kernel adjustments for verifier | Loads on 5.15 → latest with zero fixes — auto-generated vmlinux.h, scalar-only SYNPROXY |
| **Userspace** | C + libconfig | Go + cilium/ebpf, embedded BPF, no external library dependencies |
| **Hot-patching** | No | Opt-in freplace (kernel ≥6.10) — swap mitigation stages without unloading XDP |
| **Subnet auto-ban** | No | Auto-bans /24 subnets when multiple IPs in same prefix are banned |
| **Bloom filter** | No | 150K-entry Bloom filter for fast whitelist negative-check (~60-100ns saved per lookup) |
| **TUI dashboard** | No | 7-screen real-time dashboard with braille-resolution charts, config editor |
| **Webhook alerts** | No | Discord/Slack alerts on bans, attacks, config changes |

## vs xdp-filter (xdp-tools)

[xdp-filter](https://github.com/xdp-project/xdp-tools) is part of the official xdp-tools suite from the Linux kernel community. It's an ACL — allow/deny by IP, MAC, port, or protocol.

| | xdp-filter | OpenShield-XDP |
|---|-----------|----------------|
| **Purpose** | Access control (allow/deny list) | DDoS mitigation + access control |
| **Attack detection** | None — it's a static filter | 42 detection vectors with dynamic scoring and auto-ban |
| **Rate limiting** | No | Per-IP PPS/BPS, per-protocol, token bucket |
| **Behavioral detection** | No | Entropy, SYN/FIN ratio, TTL, packet size anomalies |
| **Amplification detection** | No | DNS + 8-port generic UDP reflection |
| **L7 filtering** | No | 16-slot byte-pattern matching with configurable offset/mask |
| **Configuration** | CLI flags per rule | YAML + interactive CLI wizard + 70 presets |
| **Installation** | Distribution package | One-line curl installer, auto-detects kernel features |

xdp-filter is the right tool if you need a simple "allow these IPs, drop everything else" rule at XDP speed. OpenShield is for DDoS protection — it identifies and blocks attack patterns automatically.

## vs kernel SYNPROXY (`tcp_syncookies`)

Linux's built-in SYN cookie mechanism (`sysctl net.ipv4.tcp_syncookies=1`) is defense-in-depth that runs inside the kernel TCP stack. OpenShield's SYN gate runs at XDP, earlier in the pipeline.

| | Kernel `tcp_syncookies` | OpenShield SYNPROXY |
|---|------------------------|---------------------|
| **Runs at** | TCP stack (after XDP, after skb alloc) | XDP — before kernel sees the packet |
| **Drops SYNs** | No — responds with SYN-ACK cookies | Rate-limits per source IP directly |
| **Protects connection table** | Eventually (table can still fill before cookie exchange) | Immediately — SYN flood sources are banned before conntrack is touched |
| **CPU cost** | Cookie generation + TCP processing overhead | ~30 BPF instructions (scalar comparison) |
| **Recommended** | Always enable as a second layer | Primary SYN flood defense at line rate |

**Enable both.** OpenShield handles the volumetric attack at XDP; `tcp_syncookies` handles whatever gets through as a safety net.

## vs commercial DDoS protection (Cloudflare, Akamai, Voxility, Path.net)

| | Commercial scrubbing | OpenShield-XDP |
|---|---------------------|----------------|
| **Cost** | $2,000 – $20,000+/month | **Free** (GPL-2.0) |
| **Latency** | +1-10ms (BGP redirection to scrub center) | **0ms** (runs on your NIC) |
| **Throughput cap** | Limited by scrub center capacity | Limited by your NIC hardware (~10 Mpps/core) |
| **Volumetric floods (>10 Gbps)** | ✅ Handled upstream | ❌ Your uplink saturates before XDP runs |
| **Application-layer attacks** | Signature-based (delayed) | L7 pattern matching at line rate (instant) |
| **Setup time** | Days (BGP announcement + configuration) | **≈60 seconds** (curl | bash + interactive wizard) |
| **Privacy** | All traffic routed through third party | All traffic stays on your server |

**The right strategy:** Use OpenShield for everything below your uplink capacity. For floods that exceed your bandwidth, you still need upstream filtering (ISP null-routing or a commercial scrubber). But OpenShield eliminates the need for a paid service for **99% of attacks** — the vast majority of DDoS attacks are well under 10 Gbps.

## When to use what

| Your scenario | Recommendation |
|---------------|---------------|
| Simple IP allow/deny at wire speed | xdp-filter |
| Basic port/IP filtering with some rate limiting | XDP-Firewall (Gamemann) |
| **Full DDoS protection with zero-tune setup** | **OpenShield-XDP** |
| >10 Gbps sustained volumetric floods | ISP null-routing + commercial scrubber |
| Defense-in-depth (all of the above) | OpenShield at XDP + kernel `tcp_syncookies` + fail2ban at application layer |
