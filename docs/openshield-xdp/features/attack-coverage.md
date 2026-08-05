# Attack Coverage

Every attack class OpenShield-XDP detects and counters, and the exact mechanism that stops it. All of this runs in the XDP program at the NIC — no userspace round-trips on the drop path.

## Volumetric floods

### SYN flood
The classic. Countered in four layers:

1. **Per-IP SYN-PPS scoring** — a source over `syn_pps_threshold` accrues suspicion; the further over, the faster it scores (magnitude scaling up to 8× the base score). Ban follows quickly.
2. **SYN/FIN ratio** — healthy traffic finishes connections; a flood only starts them. A global ratio over `syn_fin_ratio_threshold` adds global anomaly signal.
3. **SYNPROXY gate** — rate-based SYN classification at XDP line rate, portable to every supported kernel (no version-gated helpers).
4. **Connection-rate limiter** — caps how many new connections one source may attempt per second (`conn_rate_limit`).

### UDP flood
Per-IP UDP-PPS threshold scoring, the attack-mode **per-port aggregate cap** (the one thing a rotating flood can't rotate is the port it hits), L7 payload signatures for known UDP attack patterns, and the behavior engine's clustering for botnets that randomize everything else.

### TCP flood (non-SYN / ACK floods)
TCP-PPS scoring per source, **blind-packet enforcement** (ACK/RST packets with no observed handshake are dropped on server ports), and the attack-mode hard per-IP cap.

### ICMP / ping flood
ICMP-PPS scoring with the **highest default score weight** of any metric — there is no legitimate reason for a source to send hundreds of ICMP packets per second, so detection is aggressive by default.

### CPU-exhaustion mega-floods
When raw packet rate threatens to overwhelm a core before any scoring can happen, the **panic circuit breaker** engages: any CPU over `panic_pps_rate` drops `panic_drop_ratio`% of packets *before map lookups*. A userspace coordinator watches the global rate and tightens further (÷10 rate, ≥90% drop) above `panic_global_pps_threshold`, restoring after 5 calm seconds.

## Reflection & amplification

### UDP amplification / reflection
Eight configurable reflection-prone ports with per-port payload minimums — DNS (53), NTP (123), SSDP (1900), Memcached (11211), QOTD (17), CHARGEN (19), RIP (520), TFTP (69) — plus DNS QR-bit verification so only actual *responses* are matched. Ships with curated L7 signatures for CLDAP, SNMP, WS-Discovery and more.

### SYN-ACK reflection
Connection tracking drops any SYN-ACK arriving with no prior SYN observed from that source — reflectors can't fake the handshake.

## Spoofed & distributed

### Spoofed / rotating-source floods
- **Entropy sketch** — a 16-bucket source-IP entropy measurement flags floods cycling through huge spoofed space (kernel ≥ 6.10 feature gate).
- **New-source flood temp-bans** — a sudden burst of never-seen sources is itself an attack signal; excess new sources are temp-banned (whitelisted sources are always skipped).
- **Per-port aggregate cap** — while an attack is active, the total packet rate per destination port is capped. Rotating a million spoofed IPs can't help: the port is the one constant. Established and pre-attack sources are exempt ([player protection](/openshield-xdp/features/silent-guardians#players-never-disconnect-mid-attack)).

### Carpet bombing / subnet attacks
When `auto_escalation_threshold` (default 5) bans come from the same /24 (IPv4) or /64 (IPv6), the whole prefix is banned in the LPM trie at 2× duration — automatically, at line rate.

## Protocol abuse

### TCP flag abuse & scans
Bogus flag combinations are dropped on sight: SYN+FIN, SYN+RST, FIN+RST, all-flags-set, NULL packets, and impossible TCP data offsets.

### Malformed / truncated packets
L3 validation (IP version, IHL, total length, extension-header overflow) and strict L4 bounds checks. `filter_malformed` drops anything that doesn't parse clean.

### Fragmentation attacks
`drop_fragments` drops IPv4 MF/offset fragments and IPv6 fragment extension headers right after parse.

### Bogon / spoofed source ranges
Source addresses from 11 IPv4 reserved ranges (0.0.0.0/8, 127.0.0.0/8, 224.0.0.0/4, …) and 6 IPv6 ranges are dropped — they can never legitimately arrive from the internet.

### Port scans
No single mechanism claims port scans, but the combination is hostile to them: new-source limits, connection-rate limiting, per-IP scoring, and TTL/packet-size anomaly suspicion make scanning noisy and short-lived.

## Application layer

### L7 pattern attacks
A 16-slot mask-and-compare signature engine matches 1–8 byte patterns at offsets 0–255 in the payload, with min/max payload size guards, per protocol and port (source or destination). Signatures ship for common attack tools, and the TUI can **promote a real attack's fingerprint into a live signature with one keypress**.

## Adaptive & slow attacks

### Low-and-slow / slow-climb attacks
Two dedicated guards:

- **Baseline-anchored partial scoring** — during an attack state, sources trending toward thresholds accrue partial suspicion (scaled by profile), so slow ramps are caught before crossing.
- **Learning ceiling** — the baseline learner never folds above-trigger traffic into its EMA, declared attack or not. A flood that slowly raises the baseline to hide itself simply never gets learned — this killed the "slow climb" bypass observed in live testing.

### Bot-like behavioral floods
The **behavior engine** learns per-port baselines (typical PPS and packet sizes), then clusters sources by similarity — packet size ±20%, TTL ±12, timing variance. Clusters gain confidence from candidate → suspicious (70%) → malicious (85%); malicious clusters are auto-banned (configurable). Fixed-size bots and inhuman timing regularity feed the confidence score.

## How attacks are classified

Live classification drives the alerts and forensics: **SYN_FLOOD, UDP_FLOOD, UDP_AMPLIFICATION, ICMP_FLOOD, TCP_FLOOD, AMPLIFICATION, MIXED**. Classification fires at trigger time (mid-ramp) and is **re-evaluated every 3 seconds** — if an attack morphs (starts SYN, goes UDP), the label corrects itself after two consecutive sightings with a 15-second anti-flap gap.

---

See also: [Detection Engine](/openshield-xdp/detection-engine/overview) for the internals, [Silent Guardians](/openshield-xdp/features/silent-guardians) for the protections that keep *legitimate* traffic safe while all of this runs.
