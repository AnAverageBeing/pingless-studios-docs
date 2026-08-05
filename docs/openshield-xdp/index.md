# OpenShield-XDP

XDP-native DDoS mitigation at line rate.

Inspects and drops attack traffic inside the NIC driver — before the kernel allocates an skb, before iptables runs, before your application sees anything.

A single attached core handles **10M+ packets per second**. Suspicion scoring, rate-based SYN-flood mitigation, L7 pattern matching, UDP amplification detection, entropy-based spoofing, and autonomous subnet escalation all run without a context switch.

```bash
OpenShield-XDP is proprietary software. Contact [Pingless Studios](https://studio.pingless.org) for licensing and access.
```

## Detection Surface

OpenShield classifies **42 attack vectors** across 7 layers.

| Layer | Vectors |
|-------|---------|
| L2 — Ethernet / MAC | Blacklist, whitelist, 802.1Q / 802.1ad / QinQ |
| L3 — IP validation | IPv4 private/bogon (7 ranges), IPv6 private/bogon (6 ranges), malformed headers |
| L4 — TCP/UDP flags | Bogus flags (5 combos), L4 header bounds, TCP doff validation |
| Rate-based per IP | PPS, BPS, TCP, UDP, ICMP, SYN — 6 metrics with additive scoring |
| Connection tracking | Blind SYN-ACK, blind RST, per-IP SYN timestamp |
| Amplification & L7 | DNS, generic UDP (8 ports), L7 signature matching (16 rules) |
| Statistical anomaly | SYN/FIN ratio, entropy spoofing, TTL anomaly, packet size anomaly, connection rate |

## Mitigation

- **Ban system** — single IP, LPM subnet, auto /24 escalation, 6-level star system
- **Rate limiting** — threshold scoring or token bucket, with per-port threshold overrides and an established-connection exemption for proven TCP clients
- **Attack mode** — baseline spike detection with tightened thresholds, hard per-IP caps, and a rotation-proof per-destination-port PPS cap
- **Behavior engine** — learns per-port baselines and auto-bans lookalike bot clusters (≥85% confidence)
- **Whitelist** — per-IP flags (full bypass, skip ban, skip rate, skip validation), persisted to config from the CLI
- **SYNPROXY** — scalar, rate-based SYN flood mitigation at XDP line rate (loads on every supported kernel)
- **Panic circuit breaker** — per-CPU probabilistic bulk drop

## Observability

- 7-screen TUI dashboard with braille-resolution charts and a live config editor
- **Metrics API** (optional, off by default) — HTTP JSON endpoint with everything the TUI shows, API-key guarded
- Webhook alerts (Discord/Slack) and per-attack forensics bundles with config snapshots

## Performance

| Stage | Latency |
|-------|---------|
| Normal path (all passes) | ~300–500 ns |
| Attack path (all modules active) | ~1–2 μs |
| At 10M PPS | ~50–70% single-core utilization |

[Contact for Access](https://studio.pingless.org) · [Discord](https://discord.gg/qgBMREWWgp)
