# Overview

RouteX is a high-performance TCP/UDP reverse proxy designed for production infrastructure handling thousands of concurrent connections. It combines kernel-level iptables rate limiting with an in-process L7 protection engine.

## Design Philosophy

- **Isolation**: Each proxy config is independent. One config failing validation never affects others.
- **Defense in Depth**: L3/L4 kernel rules catch volumetric attacks. L7 Go engine catches application-layer abuse.
- **API-First**: Everything is manageable via REST API. No config file editing required for runtime changes.
- **Observability**: Multi-format metrics, structured logging, per-connection access logs.

## Protocol Support

| Protocol | Mode | Description |
|----------|------|-------------|
| TCP | Full proxy | Bidirectional streaming, connection tracking |
| UDP | Session-based | Per-client session affinity, idle timeout |
| TCP+UDP | Dual | Both protocols on the same port range |

## Security Layers

| Layer | Mechanism | Scope |
|-------|-----------|-------|
| 1 | Global ACL | Block/allowed CIDRs before any proxy |
| 2 | Per-Proxy ACL | Fine-grained per-service rules |
| 3 | iptables Rate Limiting | PPS, SYN flood, RST flood, connlimit |
| 4 | L7 Payload Inspection | Protocol validation for game traffic |
| 5 | Behavioral Scoring | Per-IP threat scoring → auto-ban |
| 6 | Connection Cycling Detection | Rapid open/close abuse |
| 7 | Payload Rate Limiting | Per-IP byte rate enforcement |
| 8 | Bandwidth Quotas | Hourly/daily/weekly/monthly limits |
