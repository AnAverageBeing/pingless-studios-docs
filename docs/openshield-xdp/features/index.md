# Everything OpenShield-XDP Does

This is the complete map of the product — every attack class it stops, every mitigation mechanism, every operator tool, and every silent guardian that protects you without ever asking for attention. Nothing is held back; if a feature exists in the binary, it's on this page.

OpenShield-XDP inspects and drops attack traffic **inside the NIC driver** — before the kernel allocates an skb, before iptables, before your application sees anything. One attached core handles **10M+ packets/sec** at ~300–500ns per packet on the normal path.

---

## Attack coverage — what it stops

Every attack class below is detected and countered at XDP line rate. Details per class: [Attack Coverage](/openshield-xdp/features/attack-coverage).

| Attack class | How it's countered |
|---|---|
| **SYN flood** | Per-IP SYN-PPS scoring (magnitude-scaled up to 8×), SYN/FIN ratio check, rate-based SYNPROXY, connection-rate limiter |
| **UDP flood** | Per-IP UDP-PPS scoring, per-port attack cap, L7 signatures, behavior engine |
| **TCP flood (non-SYN)** | TCP-PPS scoring, blind-packet enforcement, attack-mode per-IP hard cap |
| **ICMP / ping flood** | ICMP-PPS scoring (highest default score weight — ICMP has no legit high-rate use) |
| **UDP amplification / reflection** | 8 configurable reflection ports (DNS, NTP, SSDP, Memcached, QOTD, CHARGEN, RIP, TFTP) with payload minimums + DNS QR-bit verification, plus curated L7 signatures (CLDAP, SNMP, WS-Discovery…) |
| **SYN-ACK reflection** | Connection tracking drops SYN-ACKs with no prior SYN |
| **Blind ACK / RST floods** | Conn-track enforcement: RST or expired-SYN packets to server ports are dropped |
| **Spoofed / rotating-source floods** | 16-bucket source-IP entropy sketch, new-source flood temp-bans, rotation-proof per-destination-port aggregate cap |
| **Carpet bombing / subnet attacks** | Automatic /24 (IPv4) and /64 (IPv6) subnet escalation into the LPM trie at 2× ban duration |
| **Fragmentation attacks** | Optional drop of all fragmented packets (v4 MF/offset + v6 fragment headers) |
| **TCP flag abuse / scans** | Bogus-flag validation (SYN+FIN, SYN+RST, FIN+RST, all-flags, NULL, bad data offset) |
| **Malformed / truncated packets** | L3 checks (version, IHL, length, extension-header overflow) + L4 bounds |
| **Bogon / spoofed ranges** | 11 IPv4 + 6 IPv6 reserved-range source filters |
| **L7 pattern attacks** | 16-slot mask-and-compare signature engine (1–8 byte patterns, offset 0–255, payload-size guards) |
| **Port scans** | New-source limits, connection-rate limit, per-IP scoring, TTL/size anomaly suspicion |
| **Low-and-slow / slow climbs** | Baseline-anchored partial scoring during attacks + a baseline-learning ceiling that refuses to learn attack traffic (kills the "slow climb" bypass) |
| **Bot-like behavioral floods** | Behavior engine: per-port baselines, source clustering by packet size/TTL/timing similarity, confidence-scored auto-blocking |
| **CPU-exhaustion mega-floods** | Per-CPU panic circuit breaker with userspace cross-CPU coordination |

Attacks are classified live as **SYN_FLOOD, UDP_FLOOD, UDP_AMPLIFICATION, ICMP_FLOOD, TCP_FLOOD, AMPLIFICATION, or MIXED** — with automatic re-classification if the attack morphs mid-flight.

---

## Mitigation engine

- **Suspicion scoring** — six per-IP metrics (PPS, BPS, TCP, UDP, ICMP, SYN) add to a decaying score; the higher above threshold a source is, the faster it scores (up to 8×). Score crosses the limit → banned.
- **Ban system** — 2M-entry IPv4 + 200K IPv6 ban maps. Repeat offenders get lower effective thresholds and 7-level star durations (×1 → ×32). Userspace decays stars after a clean period.
- **Subnet escalation** — too many bans from one prefix → the whole /24 (or /64) is banned in the LPM trie, automatically.
- **Rate limiting, two modes** — threshold scoring (burst-shaped) or token bucket (smooth, burst-tolerant).
- **Attack mode** — on a declared attack: all thresholds tighten (configurable multiplier), a hard per-IP PPS cap engages, and a **per-destination-port aggregate cap** stops rotating floods that keep every per-IP counter cold — with player protection so legitimate clients stay connected.
- **Panic circuit breaker** — per-CPU probabilistic bulk drop when a core exceeds its PPS rate, coordinated globally for extreme floods.
- **SYNPROXY** — rate-based SYN flood gate, portable to every supported kernel.
- **Connection tracking** — handshake observation with blind-packet enforcement; long-lived connections are kept alive by sliding liveness.
- **L7 signatures** — 16 slots; new signatures can be promoted from real attack fingerprints with one keypress in the TUI.
- **Geo blocking** — block or allow-list entire countries; ranges resolve from MaxMind GeoLite2 and enforce as subnet bans. [Guide](/openshield-xdp/user-guide/geo-blocking)
- **Blocklists** — manual bans (with optional notes), file imports, and **auto-fetch feeds** (11 curated categories + your own URLs) with `vps`/`dedicated` modes — dedicated mode skips cloud-provider ranges so your customers' legit nodes are never feed-banned. [Guide](/openshield-xdp/user-guide/auto-fetch)
- **Validation filters** — bogon/private ranges, bogus TCP flags, malformed packets, fragments, MAC filter (blacklist/whitelist mode, ARP always exempt).
- **Statistical anomaly detection** — TTL anomalies, packet-size anomalies, connection-rate spikes, SYN/FIN ratio, entropy spoofing.
- **Whitelist** — per-IP flags (full bypass, skip-ban, skip-rate, skip-validation) with Bloom-filter acceleration.

---

## Silent guardians

The protections you never configured and never notice — until you learn they're there. Full stories: [Silent Guardians](/openshield-xdp/features/silent-guardians).

- **Your SFTP uploads never get you banned** — proven TCP connections (real handshake + real data) are exempt from rate scoring. Bulk transfers are indistinguishable from floods by rate alone; OpenShield proves the connection instead.
- **Your own downloads never fake an attack** — replies to the server's own outbound connections (apt, GeoIP updates, blocklist fetches, backups) skip rate limiting *and* attack detection.
- **Your admin IP whitelists itself** — the IP you SSH in from is auto-whitelisted on every load and persisted across reboots.
- **Players never disconnect mid-attack** — established and pre-attack sources are exempt from the per-port attack cap.
- **The baseline can't be poisoned** — learning freezes during attacks and refuses above-trigger traffic even when no attack is declared.
- **No false attack storms** — declaration hysteresis, recovery bands, re-trigger cooldowns, anti-flap re-classification, and a startup warmup window.
- **The firewall protects itself** — log flood pauses, BPF event rate limits, alert queues that drop rather than block the datapath.
- **Crash-proof state** — bans, baseline, geo blocks, ban notes and schedules survive restarts; the TUI never takes the firewall down when you close it.
- **Fail-open where it matters** — no config loaded = pass all; empty MAC whitelist = pass; broken feeds never perma-block.

---

## Observability

- **TUI dashboard** (`openshield stats`) — 10 screens: live graphs, traffic analysis, bans, logs, system status, a **live config editor**, attack history with one-key bulk-blacklist and fingerprints, access management, and geo blocking. Closing it never stops protection.
- **CLI** — every operation scriptable: `load`, `unload`, `status`, `stats`, `reload`, `whitelist`, `blacklist`, `license`, `key`, `report`, `behavior`, `schedule`, `fix`, `upgrade`, `reconfigure`… with per-command help (`openshield help <command>`). [CLI reference](/openshield-xdp/user-guide/cli)
- **Metrics HTTP API** — optional, off by default; everything the TUI shows as JSON, API-key guarded, rate-limited, allowlist-able. [Metrics API](/openshield-xdp/user-guide/metrics-api)
- **Discord/Slack webhooks** — attack start, growing-cadence progress updates, and a full end report: peak/avg/P95 PPS & Gbps, IPs involved, mitigation time, **per-country breakdown with flags**, graph banner, and the forensics bundle attached.
- **Forensics** — every attack gets a directory: report, involved IPs, traffic fingerprint (with a suggested L7 rule), config snapshot, and PCAP (attack-triggered or a rolling ~3-minute ring).
- **Reports** — daily/weekly/monthly aggregates with capacity prediction and geo breakdowns, optionally dispatched to your webhook.

---

## Configuration

- **Fully annotated YAML** — every setting documented inline with safe ranges and trade-offs.
- **Live editing** — `openshield reload` and the TUI editor apply runtime-safe fields instantly and persist them; read-only fields explain why.
- **70 presets × 25 workload types** — from Minecraft to CDN edge to database; the installer recommends one from your workload mix. [Profiles](/openshield-xdp/configuration/profiles)
- **Per-port threshold overrides** — custom PPS/BPS limits for specific ports or ranges (e.g. relaxed SFTP, strict game port).
- **Boot autostart** — `openshield load -always` enables the hardened systemd unit (network-online ordering, infinite restart) so protection comes back after every reboot.

---

## Licensing

- HWID-bound license keys validated against the Altis license server, with offline grace and cached-HWID tolerance.
- `enforce` + `hard_fail` — unlicensed installs refuse to load; a failed refresh unloads.
- Feature gating happens in the BPF config map — re-licensing restores exactly the features that were gated, automatically.

---

## Platform

- **Dual-stack** IPv4/IPv6 with separate maps, extension-header walking, and v6 /64 escalation.
- **XDP native / generic / skb** modes — runs on virtio, Xen, Realtek and everything else.
- **Kernel 5.15 → latest** with zero user fixes — the core promise; compile-time feature gates, freplace hot-patching as an opt-in on 6.10+.
- **Map sizing** for your RAM: ban maps already scale to 2M sources on ~1GB.
- **Obfuscated prebuilt releases** (garble) — zero source in the production zip; source zip available separately.

---

## Performance

| Stage | Latency |
|-------|---------|
| Normal path (all checks pass) | ~300–500 ns |
| Attack path (all modules active) | ~1–2 µs |
| At 10M PPS | ~50–70% single-core utilization |

Deep dive: [Architecture](/openshield-xdp/architecture/overview) · [Performance](/openshield-xdp/performance/overview)
