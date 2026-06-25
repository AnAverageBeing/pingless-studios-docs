# FAQ

## What kernel version?

Linux ≥ 5.8. ≥ 5.11 for freplace.

## Does this replace iptables?

No. XDP layer (before skb allocation) vs Netfilter (much later). Complementary.

## Performance overhead?

~300–500 ns normal. ~1–2 μs under attack. ~50–70% single-core at 10M PPS.

## Can SYNPROXY break connections?

Off by default. When enabled, only intercepts SYN + ACK. Kernel completes real handshake once cookie verified.

## Hardware offload?

`xdp_mode: auto` tries offload → native → generic. Requires smart NIC.

## TUI stuck at Loading?

`sudo openshield fix && sudo openshield load`

## Verifier fails on some kernels?

Run `sudo openshield fix`. Stale pins from old versions are the most common cause.

