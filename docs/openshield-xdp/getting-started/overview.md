# Overview
OpenShield-XDP is an XDP-native DDoS mitigation engine that inspects and drops attack traffic inside the NIC driver — before the kernel allocates an skb, before iptables runs.

## Why XDP?
XDP operates at the earliest point in the Linux stack: directly on DMA packet buffers, with zero per-packet allocation, zero sk_buff overhead, and zero context switches. A single core processes 10M+ PPS.

## When to use
Game servers under UDP reflection floods. Web servers under SYN floods. DNS resolvers under amplification attacks. Any public-facing service at risk of L3/L4 DDoS.

## What it does
42 detection vectors across L2–L7. Suspicion scoring, SYNPROXY cookies, rate limiting, subnet bans. 7-screen TUI dashboard. Webhook alerts (Discord/Slack).

## What it doesn't do
Doesn't replace iptables (different layer). Doesn't intercept TLS (L2–L4 only). Isn't a WAF.

## Next steps
[Installation](/openshield-xdp/getting-started/installation) · [Quick Start](/openshield-xdp/getting-started/quick-start)

