# Detection Overview

42 attack vectors across 7 layers.

## L2 — Ethernet

- MAC blacklist (8 entries)
- MAC whitelist
- 802.1Q / 802.1ad / QinQ (2 stacked tags)

## L3 — IP Validation

- IPv4 private/bogon: 7 ranges
- IPv6 private/bogon: 6 ranges
- Malformed L3: version, IHL, total_len, ext-header overflow

## L4 — TCP/UDP

- Bogus TCP flags: 5 impossible combos
- Malformed L4: header bounds

## Rate-Based (per IP)

6 metrics with additive suspicion scoring. Decays 50%/s.

## Connection Tracking

- Blind SYN-ACK, blind RST

## Amplification & L7

- DNS, generic UDP (8 ports), 16 L7 signature rules

## Statistical

- SYN/FIN ratio, entropy spoofing, TTL anomaly, packet size anomaly, connection rate

## SYNPROXY

- Cookie-based SYN flood mitigation at XDP

## Dynamic/Global

- New source flood, panic circuit breaker, EMA baseline learning

