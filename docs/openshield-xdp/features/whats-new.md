# What's New — v2.0 to v2.4.0

The feature changelog for the 2.x line. For the complete feature map see [Everything OpenShield-XDP Does](/openshield-xdp/features/).

## v2.4.0 — Baseline memory (ML tab), smart preset blending, alert pipeline hardening

- **30-day baseline memory** — the learned baseline is now snapshotted daily (30 days kept) and the detector runs on a recency-weighted merge of live + history. One weird day can't tilt your protection. See it all in the new **TUI ML tab** (`m`): learning state, live vs merged baseline, thresholds, and the full history. [Guide](/openshield-xdp/user-guide/baseline-ml)
- **Delete-a-day reconfiguration** — an attack that bypassed detection poisons a day's learning; delete that day (`d` in the ML tab, or `openshield baseline delete <date>`) and the merged baseline reconfigures instantly. `D` / delete-today resets the live baseline for same-day bypasses.
- **Baseline import/export** — move trained baselines between servers; imported history seeds cold starts in seconds.
- **Smart multi-profile blending** — picking several workloads no longer averages their presets into a mush that protects none. Rate ceilings take the union of legitimate needs (max), scoring takes the strictest profile, false-positive-prone detections run only where every profile agrees, and the wizard explains the blend in plain language.
- **Preset retune (equilibrium-driven)** — Balanced now actually bans sustained 2× single-source abuse (~20s) instead of never, while 1.5× bursts stay safe forever; Hosting/Performance/Database score geometry fixed so 3–4× single-source floods can no longer cruise unbanned.
- **Alert pipeline hardening** — attack-end reports can no longer be lost (loader-stop mid-attack now sends them, and the queue drains on shutdown); lifecycle alerts get queue priority over ban batches; Discord 429s are handled with pacing + requeue; the PingLess banner is embedded in the binary (no more missing image); reports retry and remember what they dispatched.
- **Behavior engine race fixed** — cluster callbacks now receive snapshots (production data race, race-detector clean).
- **Player protection restored mid-attack** — a 5-second baseline write was zeroing `attack_start_mono`, silently disabling the port-cap player exemption during attacks (the "players disconnect when the game port is flooded" bug).

## v2.3.3 — Boot autostart & crash-immunity

- **`openshield load -always`** — one flag enables auto-load on every boot via the systemd unit. Self-heals a missing unit file from the pristine copy in `/opt/openshield/lib`, and verifies the enable actually took.
- **Admin IP protection, guaranteed** — the loader binary (what systemd runs at boot) now also auto-whitelists your SSH source IP; the persisted entry is re-applied on every boot before the first packet is judged.
- **Hardened systemd unit** — waits for `network-online.target` (no more racing the interface at boot), and `StartLimitIntervalSec=0` means a crash loop never puts the firewall into a permanent failed state.
- **Silent-crash immunity baked into every binary** — on some kernels/hypervisors the Go runtime's async preemption killed the loader instantly with no output. All binaries now self-apply the documented workaround (`GODEBUG=asyncpreemptoff=1`) via a transparent re-exec, so manual runs are as safe as the systemd unit.

## v2.3.2 — CLI help system & TUI bugfix sweep

- **Per-command help pages** — `openshield help <command>` / `--help` anywhere, driven by one registry so overall and per-command help can never drift.
- **18 TUI fixes** — geo-tab crash on empty search, never-block input digit handling, traffic screen wraps below 140 columns, typed `config_update` replies (live config edits no longer look lost), confirm dialogs honor Ctrl+C, uptime-based health badges, narrow-terminal layout, scrollable help overlay, complete keybind docs, input validation, and more.

## v2.3.1 — Self-traffic exclusion & startup warmup

- **Your own downloads no longer fake attacks** — replies to the server's outbound connections (GeoIP updates, blocklist fetches, apt) are excluded from attack-detection and baseline-learning rates. Root-caused: the global counters ran before every exemption. [How it works](/openshield-xdp/features/silent-guardians#your-own-downloads-never-fake-an-attack)
- **`attack_warmup_sec`** (default 20) — no attack declaration in the first seconds after loader start; per-IP mitigation unaffected.

## v2.3.0 — Smarter feeds, bigger maps

- **Auto-fetch `vps` / `dedicated` modes** — dedicated mode skips known cloud/hosting provider ranges (Cloudflare, AWS, GCP live lists + offline fallback) so customer nodes on a dedicated box are never feed-banned.
- **List hygiene** — whitelabel (never-block) syncing with the whitelist, blacklist↔whitelist conflict resolution.
- **2M-entry ban maps** (IPv4) — million-IP botnets fit with headroom (~1 GB).

## v2.2.x — Geo blocking & alert quality

- **Geo country blocking** — one keypress blocks a country; ranges resolve from MaxMind GeoLite2 into permanent subnet bans, with persisted records and one-keypress unblock. Geo analytics (top attacking countries with flags, IPs, PPS, Gbps, share %) in attack-end reports and daily/weekly/monthly reports.
- **Ban notes** — optional notes on every ban; geo blocks use them for surgical unblocking.
- **Alert cadence rework** — growing-interval progress updates, guaranteed end-of-attack delivery with the full report, oversized-forensics fallback message.
- **Port-cap player protection** — established and pre-attack sources exempt from the per-port attack cap.

## v2.1.x — Metrics, obfuscation, rotation-proof caps

- **Metrics HTTP API** — optional endpoint with everything the TUI shows; API key (yours or auto-generated), rate limits, allowlist.
- **Obfuscated prebuilt releases** — garble-built binaries, zero source in the production zip; dual packaging (bin + src).
- **Attack per-port aggregate cap** — the rotation-proof answer to spoofed floods.
- **New-source temp bans** — replaces drop-only handling of source bursts.
- **Forensics config evidence** — every attack bundle includes the config (with change timestamps) active during it.
- **Runtime config edits persist** — TUI/live edits write through to the YAML.

## v2.0.0 — The SFTP fix

- **Established-connection exemption (A2)** — proven TCP connections (handshake + real data) are exempt from rate scoring. Bulk transfers — SFTP uploads, backups, replication — never get banned again. [The full story](/openshield-xdp/features/silent-guardians#your-sftp-uploads-never-get-you-banned)
- **Per-port threshold overrides (C)** — custom PPS/BPS limits for specific ports or port ranges, replacing both normal and attack-mode thresholds on those ports only.
