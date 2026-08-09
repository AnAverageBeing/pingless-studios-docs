# What's New — v2.0 to v2.13.1

The feature changelog for the 2.x line. For the complete feature map see [Everything OpenShield-XDP Does](/openshield-xdp/features/).

## v2.13.1 — license enforcement hardening

- The license check's feature switch now lives inside the loaded firewall program itself (frozen at load) instead of a settings area that admin-level tools could edit — tampering with it no longer has any effect.
- Shipped program package no longer carries source-level debug info.
- License tier changes apply live with zero protection gap and no loss of learned state.

## v2.13.5 — live map sizing

- `maps.ban_max`, `maps.ip_stats_max`, `maps.whitelist_max` are now real, live settings (TUI config tab / control API). Changes apply immediately with a state-preserving reload — active bans survive the resize.

## v2.13.4 — self-healing config values

- A config value written by an older version could fail validation and block every `openshield reload` permanently. Config load now repairs out-of-range values automatically and persists the fix on the next save.

## v2.13.3 — bans tab upgrade

- Search (`/`) by IP or ban reason, row scrolling (j/k/arrows, g/G), and **instant unban** — select a row, press `u`, confirm.

## v2.13.2 — older-kernel compatibility fix

- Fixes an install failure on kernels before 6.9 ("BPF program is too large"): the newest analysis features are intensive for older kernel verifiers, so the release now ships two program builds — full on 6.9+, a lighter (fully protection-equivalent) build on 5.15–6.8 — and picks automatically at load.

## v2.13.1 — license enforcement hardening

- **One-click network optimization in the installer, detection-first** — it probes your NIC and only applies what's missing: queue count matched to your vCPUs, larger RX/TX ring buffers for flood bursts, IRQ spread (skipped when irqbalance manages it), txqueuelen, fq_codel queueing, LRO off. You see the exact change list before saying yes.
- **Safe on every host type** — unsupported items are skipped per-item, so VPSes (virtio), dedicated boxes, and multi-tenant hosts all get exactly what their hardware supports and nothing breaks.
- New `doctor` check reports pending optimizations; the TUI `nic_tuning` toggle applies the same smart set.

## v2.12.1 — false-attack flapping fix

- **Quiet servers no longer flap** — the new changepoint detector could declare attacks below your configured `attack_min_pps`/`attack_min_bps` floors, producing hundreds of 1-2s phantom attacks a day on low-traffic boxes. It now respects the floors.
- **Junk-record guard** — an "attack" whose traffic never crossed your own floors is suppressed entirely (no history entry, no webhook, no forensics) and counted in the log. Detector noise can never spam your attack history again.

## v2.12.0 — connection-state tracking, season-aware detection, per-tenant visibility 🆕

Kernel & protection:

- **Connection-state tracking** — the firewall now follows every connection individually: replies to your own outbound connections (apt, curl, updates) are recognized precisely instead of heuristically, and blind ACK/RST floods are judged against the actual state of each connection. No configuration needed.
- **Flood-proof offender records** — repeat offenders can no longer wash out their history during a flood; ban history lives in flood-proof storage, so the escalating 1-day / 7-day tiers engage reliably even against million-source rotating floods.
- **Small-packet floods now escalate to long bans** — the heavy-evidence bar was unreachable for 64-byte-packet floods; extreme packet rate alone now qualifies for the escalating ban tiers.
- **Established connections during attacks** — peacetime behavior is unchanged (proven connections are never banned); while an attack is actively declared, a once-connected source pushing flood-grade rates now accrues suspicion gradually instead of being fully exempt.
- **Rotating-source floods without slowdown** — per-source counting is now lock-free, so million-source rotating floods are handled with no core slowdown.

Detection intelligence:

- **Poison-resistant baselines** — the 30-day baseline history is now merged with robust statistics (median + deviation), so a slow multi-day traffic ramp can't train the baseline upward. Tunable via `dynamic.baseline_mad_k` (default 3.5). [Baseline guide](/openshield-xdp/user-guide/baseline-ml)
- **Season-aware thresholds** — the firewall learns your hour-of-day pattern and automatically relaxes the trigger band during predictably busy hours. Needs ~7 days to warm up per hour, and only ever relaxes — never tightens.
- **Faster attack onset** — a changepoint detector declares sharp onsets 1–2 seconds earlier than the spike trigger alone.
- **Smarter attack classification** — spoof-distribution, FIN-heavy, payload-shape (randomized vs structured) and port-share hints now refine the attack subtype in reports and forensics; forensics bundles show per-source TCP stack consistency.
- **Per-tenant visibility on dedicated hosts** — every hosted IP gets a `normal` / `elevated` / `under_attack` state in the TUI targets panel, attack reports, and `GET /metrics/targets`. Auto-detected: activates only on multi-IP dedicated hosts — single-IP VPS installs are never treated as dedicated. New knob `tenant.mode` (`auto` / `on` / `off`). [Metrics API](/openshield-xdp/user-guide/metrics-api)

Ops:

- **Ban-storage pressure protection** — if ban storage approaches full, OpenShield warns you (dashboard + webhook), reaps expired entries immediately, and as a last resort reclaims blocklist-feed entries (they re-fetch automatically). Attack-driven bans are never pressure-deleted.
- **`openshield doctor`** — one-command environment health check: kernel, BTF, XDP attach, NIC driver, config, forensics disk, and license. `--json` output for support tickets. [CLI reference](/openshield-xdp/user-guide/cli)
- **Generic JSON webhook** — set `alerter.generic_webhook_url` and every event also posts a JSON envelope (`{product, version, event, host, timestamp, data}`) to your endpoint — same pacing and rate-limit handling as Discord; embeds and attachments stay Discord-only. [Alerter docs](/openshield-xdp/configuration/alerter)

## v2.11.0 — OVH edge-mitigation module

- **Drop attacks at OVH's edge** — optional module (installer opt-in, marked NEW): banned attacker IPs are pushed to OVH's network firewall (VAC) so flood traffic never reaches your NIC.
- **Guided setup** — API region → app credentials → one browser authorization → service auto-detection (the service routing this machine's main IPv4 is pre-marked) → pick the service's IPs to protect. Back navigation on every step.
- **Two push modes** — `confirmed` (verified-heavy / repeat offenders only, near-zero false positives) or `all` (every detected attacker). Blocklist-feed bans are never pushed.
- **OVH limits respected** — 20 rule slots per IP (worst offenders first), token-bucket API pacing with 429 backoff, all configurable. Runtime toggle in live settings; status on `GET /metrics/ovh`.

## v2.10.0 — forensics disk guard

- **Custom forensics directory** (`forensics.dir`) and a **disk cap** (`forensics.max_size_mb`, default 30 GB) with automatic oldest-first cleanup of completed attack bundles (`cleanup_percent`, default 50) — whole bundles only, never half a forensics dir.
- **Disk-pressure halt/resume** — if a live capture alone exceeds the cap, collection pauses (pcap stops, future attacks skip forensics) and auto-resumes when space recovers. A manual `forensics.collect: false` is never overridden; the toggle is in live settings (TUI config tab / control API) and persisted.
- **`GET /metrics/forensics`** — dir, size vs cap, collecting/halted state, cleanup counters.

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
