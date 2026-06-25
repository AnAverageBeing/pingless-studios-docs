# Mitigation Overview

## Ban System

- **Single-IP bans** — inserted when suspicion reaches threshold. 13 reason codes.
- **LPM subnet bans** — CIDR-level via longest-prefix-match trie. IPv4: 1,024, IPv6: 512.
- **Auto /24 escalation** — after N single-IP bans in a /24, auto-inserts subnet ban (default N=5).
- **Star system** — 6 repeat-offender levels, multipliers ×1 to ×32.
- **Effective threshold** → `suspicion_threshold * 2 / (2 + ban_count)`, floor 10.

## Rate Limiting

- **Threshold scoring** (default) — additive suspicion per violation, cumulative ban
- **Token bucket** — per-IP, configurable rate + burst, 1 token/packet

## Whitelist

Per-IP flags: full bypass, skip ban, skip rate, skip validation. Empty-map fast path.

## SYNPROXY

SYN → cookie → XDP_TX SYN-ACK → ACK → verify → XDP_PASS.

