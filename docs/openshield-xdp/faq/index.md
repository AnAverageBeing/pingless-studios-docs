# FAQ

## What kernel version?

Linux ≥ 5.15. freplace is opt-in (`make FREPLACE=1`, kernel ≥ 6.10).

## Does this replace iptables?

No. XDP layer (before skb allocation) vs Netfilter (much later). Complementary.

## Performance overhead?

~300–500 ns normal. ~1–2 μs under attack. ~50–70% single-core at 10M PPS.

## Can SYNPROXY break connections?

Off by default. It's a scalar, non-terminal SYN gate — it never drops legitimate traffic itself; SYN-flood mitigation is handled by the per-IP `syn_pps_threshold` rate limiter. No cookies, no SYN-ACK rewriting, so normal handshakes are untouched.

## Hardware offload?

`xdp_mode: auto` tries offload → native → generic. Requires smart NIC.

## TUI stuck at Loading?

`sudo openshield fix && sudo openshield load`

## Verifier fails on some kernels?

Run `sudo openshield fix`. Stale pins from old versions are the most common cause.

