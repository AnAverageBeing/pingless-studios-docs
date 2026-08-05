# User Guide — For Server Owners

This guide is for people who run game servers, hosting nodes, or web servers and want OpenShield-XDP to "just work" — without needing to be a network engineer. It walks you from install to a sensible first config, explains how the protection actually works, and points you at recipes for common server types.

If you want the full technical reference instead, see [Configuration Reference](/openshield-xdp/configuration/reference).

## The 10-minute setup

### 1. Install

```bash
cd OpenShield-XDP
sudo ./install.sh
```

The installer builds the BPF program and Go binaries, installs the systemd service, and runs the interactive profile wizard. Details: [Installation](/openshield-xdp/getting-started/installation).

### 2. Pick the right interface

OpenShield inspects traffic on **one network interface** — the one your public traffic arrives on. Find it with:

```bash
ip route | grep default
```

The interface name is at the end of the line (`dev eth0`, `dev ens18`, `dev eno1`, …). That's what goes into `interface:` in your config. On most VPS providers it's `eth0` or `ens3`; on bare metal it's often `eno1` or `enpXsY`.

### 3. Pick a workload preset

During install (or later with `sudo openshield reconfigure`) you choose a **protection profile**. This is the single most important decision — it tunes every threshold for your kind of traffic. In plain terms:

| Preset | Choose this if you run… | Personality |
|--------|------------------------|-------------|
| **Balanced** | A website, API, SaaS app — the default | Protective but forgiving |
| **Gaming** | Minecraft, FiveM, Rust, CS2, voice servers | Tolerates UDP bursts and many players |
| **Hosting** | A VPS node, Docker/Pterodactyl host, shared hosting | Assumes customer spikes are legit, hunts attack patterns |
| **Performance** | Streaming, downloads, big APIs, reverse proxies | High limits, blocks only clear attacks |
| **CDN Edge** | Very high bandwidth, ISP-like traffic | Highest limits |
| **Strict / Ultra Strict** | Small sites, admin panels, low-traffic apps | Aggressive; some false positives are OK |
| **Database** | DB servers, file storage, backup targets, mail | Careful with bulk transfers |

You can change presets any time with `sudo openshield reconfigure` — it re-tunes the numbers without touching your whitelist, license, or custom edits.

### 4. Load and verify

```bash
sudo openshield load        # interactive, with a 10-second safety prompt
sudo openshield status      # confirm XDP Program: LOADED
```

For production, use the systemd service so it starts on boot:

```bash
sudo systemctl enable --now openshield-loader
```

That's it — you're protected with sensible defaults. Everything below explains what the protection is actually doing, so you know when (and when not) to tune it.

## How the protection works, conceptually

OpenShield layers four defenses, in this order. Each one catches what the previous one can't.

### Layer 1 — Per-IP suspicion scoring (peacetime)

Every source IP gets its own packet counters. When an IP exceeds a rate limit (total packets/s, bytes/s, TCP, UDP, ICMP, or SYN packets/s) it gains **suspicion points**. Reach 100 points and the IP is banned for an hour.

This is deliberately forgiving: one fast second doesn't ban anyone. An IP has to sustain abusive rates for several seconds before the score adds up — that's why legit bursts (loading a heavy page, a game client syncing) survive and floods don't.

Since v2.0.0 there's an important exemption: **an IP that has completed a real TCP connection** (it sent actual data shortly after its SYN, like a real client does) is no longer scored on the plain PPS/BPS/TCP limits. This is what stops your own SFTP uploads and backups from getting you banned. Flood protections (SYN rate, connection rate, UDP/ICMP) still apply to everyone — a spoofed flood can't fake an established connection, so nothing is lost.

### Layer 2 — Attack mode (the flood alarm)

Per-IP scoring alone struggles with **distributed** floods: a million IPs each sending a little traffic, none of them individually suspicious. So OpenShield also learns your normal traffic level (the "baseline") and watches for global spikes. When total traffic jumps far above baseline and stays there for a few seconds, it declares **attack mode**:

- All per-IP thresholds tighten (default: halved)
- A hard per-IP PPS cap kicks in (`attack_per_ip_pps`)
- A **per-port cap** kicks in (`attack_port_pps`) — see Layer 3

When traffic settles back down, attack mode clears and everything relaxes again. You can watch this happen live in the TUI.

### Layer 3 — The per-port cap (rotation-proof)

Spoofed floods rotate through fake source IPs constantly, so per-IP counters stay cold. But the attacker **cannot rotate the destination port** — a flood aimed at your Minecraft server hits port 25565 no matter how many fake IPs it uses.

`attack_port_pps` caps the **total** packets/s allowed toward each destination port while an attack is active (presets: 10k hosting, 15k gaming, 25k CDN). The flood's hot port betrays it, and excess packets are dropped for everyone on that port until the attack clears. Legit players on the same port get throttled, **not banned** — they lag for the duration of the attack instead of losing the server entirely.

### Layer 4 — The behavior engine (slow-burn botnets)

Some attacks never spike: thousands of bots each sending a trickle, spread over hours. The behavior engine learns what your normal per-port traffic looks like (packet sizes, timing, source diversity) and groups sources into **clusters**. When a cluster of lookalike sources shows bot fingerprints — identical packet sizes, machine-paced timing, explosive growth — it's flagged with a confidence score.

Since v2.1.0, clusters at **≥85% confidence are auto-banned for 1 hour** (`behavior.auto_block`, on by default; set it to `false` for report-only mode). You can review everything in the TUI's behavior tab or with `sudo openshield behavior`.

::: info The engine freezes during attacks
While an attack is declared (Layer 2), the behavior engine stops learning so it doesn't "learn" the attack as normal. That means it's built for **slow-burn botnets and quiet recon**, not for mid-flood decisions — Layers 1–3 handle the loud stuff.
:::

### Proactive blocking — stop known-bad sources before they score

Since v2.2.0, two features sit in front of the four layers and drop known-bad traffic outright:

- **[Auto-fetch blocklists](/openshield-xdp/user-guide/auto-fetch)** — threat-intel feeds (C2s, botnets, scanners, brute-forcers) downloaded on a schedule and loaded into the ban maps. Fetched bans expire after 2× the fetch interval, so a broken feed never blocks anyone permanently. On by default.
- **[Geo blocking](/openshield-xdp/user-guide/geo-blocking)** — block entire countries from the TUI geo tab (key `0`); enforced as permanent subnet bans in the kernel LPM trie.

Both are enforced in the same XDP pass as everything else — no per-packet userspace cost.

### Attack geo analytics

When GeoIP data is available, attack-end Discord reports and forensics bundles include a **top-50 attacking-countries breakdown** (flag emoji, IP count, peak pps/Gbps, % share — legit and established sources excluded), and the daily/weekly/monthly reports show the top attacker and top legit-user countries. Controlled by `reports.geo_breakdown` (default: on) and `alerter.geo_breakdown`.

## What to read next

- [Config Values in Plain Language](/openshield-xdp/user-guide/config-values) — every important knob, what it means, and when to touch it
- [Auto-Fetch Blocklists](/openshield-xdp/user-guide/auto-fetch) — threat-intel feeds banned on a schedule (on by default)
- [Geo Blocking](/openshield-xdp/user-guide/geo-blocking) — block whole countries from the TUI
- [Recipes](/openshield-xdp/user-guide/recipes) — game server, hosting node, file/backup server, VPN
- [Troubleshooting](/openshield-xdp/user-guide/troubleshooting) — banned while uploading? attack shows but nothing dropped?
- [Metrics API](/openshield-xdp/user-guide/metrics-api) — feed your own dashboard
- [CLI Reference](/openshield-xdp/user-guide/cli) · [TUI Guide](/openshield-xdp/user-guide/tui) · [Full Config Reference](/openshield-xdp/configuration/reference)
