# FAQ

## What kernel version do I need?

Linux ≥ 5.8. For freplace support (hot-patching), ≥ 5.11 with `CONFIG_DEBUG_INFO_BTF=y`.

## Does this replace iptables/nftables?

No. OpenShield operates at the XDP layer (before kernel skb allocation). iptables/nftables operate at Netfilter hooks much later in the stack. They complement each other.

## What's the performance overhead?

~300–500 ns per packet under normal traffic. ~1–2 μs with all modules active. A single core handles 10M PPS at ~50–70% utilization.

## Can SYNPROXY break legitimate connections?

SYNPROXY is off by default. When enabled, it intercepts only the initial SYN and returning ACK. The kernel completes the real handshake once the cookie is verified. TCP options are preserved.

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

