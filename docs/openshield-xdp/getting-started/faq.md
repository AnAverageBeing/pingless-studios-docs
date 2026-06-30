# FAQ

## What kernel version do I need?

Linux ≥ 5.15 (loads on every kernel from 5.15 to latest with zero fixes). freplace hot-patching is opt-in: build with `make FREPLACE=1` on kernel ≥ 6.10 with `CONFIG_DEBUG_INFO_BTF=y`.

## Does this replace iptables/nftables?

No. OpenShield operates at the XDP layer (before kernel skb allocation). iptables/nftables operate at Netfilter hooks much later in the stack. They complement each other.

## What's the performance overhead?

~300–500 ns per packet under normal traffic. ~1–2 μs with all modules active. A single core handles 10M PPS at ~50–70% utilization.

## Can SYNPROXY break legitimate connections?

SYNPROXY is off by default and is a **scalar, non-terminal** gate — it never drops legitimate traffic itself. It only accounts SYNs and lets the connection continue; SYN-flood mitigation is handled by the per-IP `syn_pps_threshold` rate limiter, so normal handshakes are untouched. There are no cookies, no SYN-ACK rewriting, and no TCP-option loss.

## Does this support XDP hardware offload?

`xdp_mode: auto` tries hardware offload first, then native, then generic. Requires smart NIC (Netronome, Intel E810, Mellanox ConnectX with upstream driver).

## How do I test without a real attack?

```bash
# SYN flood
hping3 -S --flood -p 80 <target>

# UDP flood
hping3 --udp --flood -p 53 <target>

# Watch the dashboard
openshield-tui
```

## Why does the verifier reject on some kernels?

Different kernel versions have different verifier strictness. The most common cause is stale pinned maps from a previous version. Run `sudo openshield fix`.

## Can I run this alongside a Kubernetes CNI?

Yes. XDP programs run on individual interfaces. They don't conflict with Cilium, Calico, or other CNIs that operate at different hook points.

## Next steps

- [Installation](/openshield-xdp/getting-started/installation)
- [Quick Start](/openshield-xdp/getting-started/quick-start)

