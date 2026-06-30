# Overview

OpenShield-XDP is an XDP-native DDoS mitigation engine that inspects and drops attack traffic inside the NIC driver — before the kernel allocates an skb, before iptables runs.

## Why XDP?

XDP operates at the earliest point in the Linux stack: directly on DMA packet buffers, with zero per-packet allocation, zero sk_buff overhead, and zero context switches. A single core processes 10M+ PPS.

## When to use

Game servers under UDP reflection floods. Web servers under SYN floods. DNS resolvers under amplification attacks. Any public-facing service at risk of L3/L4 DDoS.

## What it does

42 detection vectors across L2–L7. Suspicion scoring, rate-based SYN-flood mitigation, rate limiting, subnet bans, Bloom filter for fast whitelist lookups, freplace hot-patching for modular BPF logic. 7-screen TUI dashboard with braille-resolution charts and config editor. Webhook alerts (Discord/Slack).

## What it doesn't do

Doesn't replace iptables (different layer). Doesn't intercept TLS (L2–L4 only). Isn't a WAF.

## Kernel requirements

| Requirement | Minimum | Recommended |
|-------------|---------|-------------|
| Linux kernel | 5.15 | 6.10+ |
| BTF support | `CONFIG_DEBUG_INFO_BTF=y` | `CONFIG_DEBUG_INFO_BTF=y` |
| freplace | 5.15+ | 6.10+ (full feature set) |

::: tip Kernel feature gates
Some features require newer kernels:
- **Bloom filter map** — kernel 5.16+
- **freplace (BPF hot-patching)** — kernel 5.15+, but stable on 6.10+
- **BPF timers** (connection tracking TTL) — kernel 5.15+
- **XDP generic/skb modes** — any kernel with XDP support

OpenShield-XDP auto-detects available kernel features at load time and disables unsupported features gracefully. Run `openshield status` to see which features are active.
:::

## Next steps

[Installation](/openshield-xdp/getting-started/installation) · [Quick Start](/openshield-xdp/getting-started/quick-start)
