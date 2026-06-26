# Detection Overview

OpenShield classifies packets at L2–L7 before the kernel processes them. The detection pipeline runs inside the XDP program — zero context switches, zero allocations.

## Detection categories

| Category | Vectors | Checks |
|----------|---------|--------|
| L2/L3/L4 validation | 12 | MAC filter, IP bogon, bogus TCP flags, malformed headers |
| Rate-based scoring | 6 | PPS, BPS, TCP, UDP, ICMP, SYN — per-IP, per-second |
| Connection tracking | 2 | Blind SYN-ACK, blind RST |
| Amplification | 9 | DNS + 8-port generic UDP reflection |
| L7 signature | 16 | Configurable port+protocol+mask rules |
| Statistical | 5 | SYN/FIN ratio, entropy, TTL, packet size, connection rate |
| SYNPROXY | 1 | Cookie-based SYN flood mitigation |

::: tip All features toggleable
Each detection vector has a corresponding `enabled` flag in the config. Disable any that produce false positives for your traffic profile.
:::

## Next steps
[Pipeline](/openshield-xdp/detection-engine/pipeline) · [L2/L3/L4 Detection](/openshield-xdp/detection-engine/l3-l4)

