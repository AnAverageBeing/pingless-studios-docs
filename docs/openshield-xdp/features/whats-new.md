# What's New — v2.0 to v2.9.1

The feature changelog for the 2.x line. For the complete feature map see [Everything OpenShield-XDP Does](/openshield-xdp/features/).

## v2.9.1 — target-list hygiene

- Multicast/broadcast destinations no longer appear in Top Targeted IPs / `/metrics/targets`.

## v2.9.0 — targeted-IP visibility

- **Which VPS IP is being attacked** — per-destination-IP counters at wire speed; the TUI dashboard gets a *Top Targeted IPs* panel (live pps/bps/share), attack-end webhook reports get a *Top Targeted IPs* field, and the metrics API gains `GET /metrics/targets`. Built for dedicated hosts with routed/bridged VMs. [Deployment models](/openshield-xdp/getting-started/vps-deployment)

## v2.8.3 — audit hardening pass

- **Security:** TCP `doff<5` rejected (a doff=0 ACK could mint the established-connection mark without a real session); null-flag and Xmas scans now actually reach the flag validator; baseline anchor u64 wrap on busy links fixed; blind RSTs enforce the freshness window; API guard no longer drops multi-MSS request bodies or locks out IPv6 in allowlist-only mode.
- **Correctness:** IPv6 amp check honors extension headers; L7 runtime-promoted rules (slots 1-15) were silently inert; TUI ban countdown clock-domain mix; fetcher apply errors swallowed; config-reload RMW race; panic recovery reverting runtime edits; `spike_recovery_time`/`baseline_update_interval` validation (flap/panic paths).
- **Performance:** ban sweep loses ~400k syscalls/5s on feed-loaded hosts; bounded top-N map iterators; rate-limited new-source events with an exact kernel counter; async capped attacks.json persistence; no snapshot marshal with zero clients.

## v2.8.2 — new-source metric fix

- **New Src/s was stuck at 0** — the userspace reader queried the single-entry new-source map with a per-CPU slice lookup, which always failed silently. The kernel now keeps a monotonic total alongside the 1s windowed count; the displayed rate is exact at any poll interval. The new-source temp-ban rule itself was verified firing live (400–540k new src/s during a rotating-spoof flood).

## v2.8.1 — repeat-offender hardening, all-port coverage

- **Repeat-offender hardening** — bans backed by *verified* heavy evidence (both PPS and BPS ≥ 3× threshold, no established TCP session) accrue a separate heavy-hit count: 2nd verified heavy ban = **1 day**, 3rd+ = **7 days** (`static.repeat_ban_duration_2/3`). Bulk transfers can never collect heavy marks; borderline crossers keep the normal ladder.
- **All-port protection** — `ct_server_port_max` default 65535: services on high ports (>30000) are fully covered; outbound connections (apt/curl) still work via the SYN-ACK bootstrap.
- **Scoring determinism fix** — an odd `bpf_ktime` low bit was decoded as a spurious window reset on ~half of all packets; sampling and scoring are now exact.
- **Heavy-evidence measurement fix** — fast floods banned on 256-packet samples now have their *true* arrival rate extrapolated, so hardening actually engages on real floods.
- **Port-cap starvation fix** — attack-capped sources accrue suspicion before the cap drop (previously throttled forever, never banned).
- **Ban-expiry clock fix** — bans on hosts that suspend (laptops, suspended/migrated VMs) were reaped as instantly-expired; userspace now reads the same CLOCK_MONOTONIC as the kernel.

## v2.8.0 — smarter classification, XDP trace, API guard, fixed TUI chrome

- **Multi-signal classifier** — new types (ACK_FLOOD, SYNACK_REFLECTION, FRAG_FLOOD, CARPET_BOMB, PORT_SCAN), UDP_AMPLIFICATION revived with subtypes (dns/ntp/ssdp/…), driven by new kernel counters (TCP flags, fragments, 12-slot reflector source-port histogram). Research-backed rules (FastNetMon, CICDDoS2019, Kitsune).
- **XDP decision trace** — every attack's forensics dir now has xdp-trace.log: each verdict with ns-accurate timestamps, sampled 1/64 per CPU, zero peacetime cost.
- **API port guard** — basic L7 for the metrics/control port: TCP-only + HTTP-method payloads + its own allowlist (metrics.whitelist), synced live.
- **TUI fixed chrome** — status/nav pinned top, keybind footer pinned bottom, every screen scrolls in a bounded viewport with scrollbars.
- **Behavior engine**: port fan-out scan detection. **Baseline**: anomalous days auto-flagged. Whitelisted bulk traffic no longer declares attacks.

## v2.7.0 — full management API + player protection hardened

- **Management API** — new read endpoints (/metrics/baseline, /metrics/geo, /metrics/alerter, /metrics/autofetch, /metrics/access, /metrics/schedule) and a `control_enabled`-gated control API: config get/set, whitelist/blacklist, geo toggle, baseline export/import/delete-day, autofetch, schedule, block-pattern, attack bulk-ban jobs. Everything the TUI does, over HTTP. [API reference](/openshield-xdp/user-guide/metrics-api)
- **Player protection, flood-tested** — the protected-source snapshot now fills in ~0.5s via batch map ops (plain iteration finished after the attack) and protects only proven pre-attack sources (established or first-seen ≥15s before declaration) — verified live: players flat through a rotating flood.

## v2.6.0 — adaptive granularity, live NIC-tuning toggle, baseline day summaries

- `attack_poll_divisor` (default 4): polling jumps to 250ms during attacks only — zero peacetime CPU cost; `poll_interval` accepts fractional seconds.
- NIC tuning toggle (`T` in the TUI) applies/reverts instantly, with the jitter tradeoff explained in the confirmation.
- Baseline history rows show TCP/UDP splits and ▲/▼ deviation markers vs your median day.

## v2.5.x — UDP player protection, geo UX, webhook health, jitter fix

- **v2.5.0** — protected-source snapshot map (Bedrock/UDP players survive floods), geo tab live job progress, webhook delivery panel in the Status tab, keybind pills + segmented status bar.
- **v2.5.1** — NIC tuning became opt-in (`nic_tuning`, default off): the coalescing it applied was the dedicated-host jitter source.

## v2.4.x — baseline memory (ML tab), smart preset blending, honest reports

- **30-day baseline memory** — daily snapshots merged recency-weighted with the live EMA; one weird day can't tilt detection. TUI ML tab (`m`): learning state, live vs merged, thresholds, full history. [Guide](/openshield-xdp/user-guide/baseline-ml)
- **Delete-a-day reconfiguration** — a poisoned day (attack bypassed detection) can be deleted; the baseline reconfigures instantly. `D` resets today's live baseline for same-day bypasses.
- **Baseline import/export** — move trained baselines between servers.
- **Smart multi-profile blending** — multiple workload selections merge by semantics, not averages: rate ceilings = union of legit needs, scoring = strictest, FP-prone detections only where all agree.
- **Preset retune** — Balanced actually bans sustained 2× abuse; Hosting/Performance/Database bypass classes closed.
- **Honest attack reports** — median-based recovery (3s spikes no longer linger for minutes), real attacker IP counts (no more 100k phantom IPs), geo breakdown only from elevated intervals, Mbps/Kbps formatting.
- **Alert pipeline overhaul** — attack-end reports can't be lost, lifecycle alerts get queue priority, Discord 429 handling, embedded banner.
- **Behavior engine race fixed**; `attack_start_mono` preservation (the MC disconnect bug).

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
