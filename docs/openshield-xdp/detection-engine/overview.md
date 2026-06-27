# Detection Overview

OpenShield classifies packets at L2–L7 before the kernel processes them. The detection pipeline runs inside the XDP program — zero context switches, zero allocations. A **Bloom filter** accelerates whitelist lookups by skipping the HASH map when an IP is definitely not whitelisted, saving ~60–100ns per packet on the common path.

## Detection categories

| Category | Vectors | Checks |
|----------|---------|--------|
| L2/L3/L4 validation | 12 | MAC filter, IPv4 bogon (7 ranges), IPv6 bogon (6 ranges), bogus TCP flags (5 combos), malformed headers |
| Rate-based scoring | 6 | PPS (850), BPS (8.5 MB/s), TCP (680), UDP (425), ICMP (85), SYN (170) — per-IP, per-second |
| Connection tracking | 2 | Blind SYN-ACK, blind RST |
| Amplification | 9 | DNS (QR-bit check) + 8-port configurable generic UDP reflection |
| L7 signature | 16 | Configurable port+protocol+mask rules |
| Statistical | 5 | SYN/FIN ratio, entropy (16 buckets), TTL, packet size, connection rate |
| SYNPROXY | 1 | SplitMix64 cookie-based SYN flood mitigation |

::: tip All features toggleable
Each detection vector has a corresponding `enabled` flag in the config. Disable any that produce false positives for your traffic profile.
:::

## Next steps

[Pipeline](/openshield-xdp/detection-engine/pipeline) · [L2/L3/L4 Detection](/openshield-xdp/detection-engine/l3-l4) · [Rate-Based Detection](/openshield-xdp/detection-engine/rate-based)
