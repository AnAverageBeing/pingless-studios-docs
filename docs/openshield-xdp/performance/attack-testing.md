# Attack Testing & Detection Analysis

This page documents the results of live attack testing against OpenShield-XDP, the bugs that testing uncovered, and how the dynamic-detection configuration values change firewall behavior in practice. Use it to tune `dynamic:` thresholds for your own traffic profile.

## Test Methodology (and Its Pitfalls)

Live DDoS simulation against your own server is harder than it looks. Three traps we hit — you will hit them too:

### 1. Docker/bridge traffic never reaches XDP

Packets sent from a local Docker container to the host's **own public IP** are delivered locally through the Docker bridge (`pterodactyl0`, `docker0`, ...). The kernel sees the destination is local and hands the packet to the local stack — it **never ingresses the physical interface**, so an XDP program attached to `eth0`/`enp3s0` cannot see it, let alone count or drop it.

```
container → veth → pterodactyl0 → (local delivery) → host stack
                                  ✗ enp3s0 XDP sees nothing
```

This is expected XDP behavior (XDP hooks are per-interface, at driver ingress), not a firewall bug. Consequence: **container-based attack tests against your own IP are invalid** — you are testing nothing. The same applies to any locally-routed traffic.

### 2. Spoofed-source floods are filtered by the *sender's* provider

`hping3 --rand-source` from an external VPS produces packets with spoofed sources. Most hosting providers apply egress anti-spoofing (uRPF/ACL), so those packets are dropped before they leave the sender's network. Your firewall logs show nothing and it looks like "detection is broken" — the traffic simply never arrived.

### 3. VPS-to-VPS traffic may be blocked entirely

Some provider pairs block or heavily filter inter-network traffic (ICMP, UDP, or whole prefixes). Verify plain TCP connectivity between attacker and target **before** drawing conclusions from a missing flood.

### 4. External floods can get YOU banned

Flooding your own server from another host looks like an attack to **both** providers (outbound from the attacker, inbound to you). Don't do it. Use the internal rig below.

### The safe way: an internal veth rig (recommended)

All test traffic stays on the host — nothing ever reaches the provider network:

```bash
# veth pair + namespace; public-range IPs so the bogon filter doesn't
# drop the test traffic (10.x sources are dropped by design).
ip link add veth-os0 type veth peer name veth-os1
ip netns add atk
ip link set veth-os0 netns atk
ip netns exec atk ip addr add 11.0.0.1/24 dev veth-os0
ip addr add 11.0.0.2/24 dev veth-os1
ip netns exec atk ip link set veth-os0 up
ip netns exec atk ip link set lo up
ip link set veth-os1 up

# Attach the SAME pinned XDP program to the veth end (generic mode).
# NOTE: loader restarts unload the program — re-attach after each restart.
PID=$(bpftool prog show | grep "name openshield_xdp" | head -1 | cut -d: -f1)
bpftool net attach xdpgeneric id $PID dev veth-os1

# Flood — never leaves the machine:
ip netns exec atk hping3 --udp -p 53 -i u500 11.0.0.2
```

Two gotchas we hit: private `10.x` sources are dropped by the bogon filter (use `11.0.0.x`), and a loader restart silently invalidates the veth attach (the attach references the old program, which keeps dropping packets into dead maps — detach first, then attach the new program id).

Also verify arrival in the firewall's own counters (`total_*_packets` in `global_stats_map`, or the telemetry socket) — "packets sent" on the attacker proves nothing.

## Bugs Found by Testing

All of these were found by the test campaign and are fixed in the current build.

### F1 — Attack state never cleared ("under attack" for 3+ hours)

**Symptom:** TUI/status showed `UNDER ATTACK` for hours after traffic returned to normal; Discord "attack ended" webhooks never fired.

**Root cause:** attack recovery required traffic to fall below `baseline_pps × spike_recovery_factor` (≈ 96 pps on the test server) for `spike_recovery_time` (60) consecutive seconds. On any server with real background traffic (game servers, panels, API chatter), noise alone exceeds `baseline × 1.5` regularly, so the recovery counter kept resetting. Attacks only ended via the 300 s absolute timeout, then instantly re-triggered on the next noise burst — a permanent attack state.

**Fix:** recovery is now **spike-relative**: the attack ends when traffic stays below `spike_threshold × spike_recovery_factor` for `spike_recovery_time` seconds. The factor must be `< 1.0` (default `0.7`) so the recovery band sits below the trigger band. Mitigation (bans, rate limits) is independent of the attack state, so ending the state promptly never weakens protection. New defaults: `spike_recovery_factor: 0.7`, `spike_recovery_time: 10`.

### F2 — End → re-detect loop

**Symptom:** after an attack ended (timeout or recovery), the next small burst immediately opened a new attack, so tracker records accumulated multi-hour durations.

**Fix:** 10-second post-attack cooldown — re-triggering within 10 s of an attack end requires a clearly renewed spike (≥ 2× threshold), not hover traffic.

### F3 — UDP/ICMP floods mis-classified as TCP_FLOOD

**Root cause:** `classifyType` computed per-protocol deviation from baseline as `current / baseline`. When the baseline had **zero** of a protocol (a server that never sees UDP/ICMP), deviation stayed 0 and the UDP/ICMP branch silently failed, falling through to the generic TCP/MIXED fallback.

**Fix:** a protocol that is absent from the baseline but present at ≥ 100 pps now counts as effectively infinite deviation, so UDP floods classify as `UDP_FLOOD`, ICMP floods as `ICMP_FLOOD` even on servers with zero baseline for that protocol.

### F4 — One-shot classification at trigger time

**Root cause:** the attack type was computed once, at trigger time — often mid-ramp when protocol shares are not yet representative.

**Fix:** the classifier re-classifies every 5 seconds during an attack. A type switch requires the same new type 3 consecutive times **and** ≥ 60 s since the last accepted switch (anti-flap). Re-classifications propagate to the tracker, the forensics report, and Discord alerts.

### F5 — SYN-ACK floods invisible to the classifier

**Fix:** added a global `total_synack_packets` counter to the BPF stats struct; the collector now computes real `synack_pps`. SYN-ACK reflector floods are now distinguishable from pure SYN floods.

### F6 — systemd service could not restart after unload/reboot

**Symptom:** `systemctl start openshield-loader` failed with `Failed to set up mount namespacing: /sys/fs/bpf/openshield: No such file or directory` after `openshield unload` or a reboot.

**Root cause:** `ReadWritePaths=/sys/fs/bpf/openshield /var/run/openshield ...` fails the whole mount namespace when a listed path is missing — and BPF pins are removed on unload, `/run` is tmpfs after reboot.

**Fix:** the unit now uses `RuntimeDirectory`/`StateDirectory`/`LogsDirectory` (auto-created by systemd), `ExecStartPre=mkdir -p /sys/fs/bpf/openshield`, and `ReadWritePaths=/sys/fs/bpf`. `ProtectKernelTunables` had to be dropped — it remounts `/sys` read-only inside the namespace, breaking both the mkdir and map pinning.

### F7 — One stalled TUI client could freeze telemetry for everyone

**Symptom:** a TUI tab stuck on `Connected to loader — waiting for telemetry...` while another tab worked fine.

**Root cause:** `Broadcast` wrote snapshots to every subscribed client **synchronously while holding the server mutex**, with a 5 s write deadline per client. One suspended or slow client (Ctrl-Z, laggy SSH session) stalled the whole fan-out for seconds per interval; it could also delay `Stop()`. There was also a latent data race: request responses were written from the handler goroutine while `Broadcast` wrote to the same `bufio.Writer`.

**Fix:** each client now has its own buffered outbound queue (depth 16) drained by a dedicated writer goroutine. `Broadcast` does a non-blocking send per client — a client that falls behind simply misses intermediate snapshots and can never stall others. All writes are serialized through a per-client mutex, eliminating the race.

### F8 — Mitigation bypass against services on ports > 32768

**Symptom:** floods aimed at services listening on high ports (custom apps, some game/panel allocations) were never rate-limited and never gained suspicion score — traffic "climbed slowly and never got mitigated".

**Root cause:** to avoid throttling legitimate outbound traffic (apt, curl, downloads), both `stage_rate_limit` and the suspicion scorer skipped **every** packet with `dport > 32768`. That blanket rule also exempted inbound floods targeting high-port services.

**Fix:** a proper `is_outbound_response()` discriminator now decides what skips scoring/rate-limiting:

- `dport <= 32768` — service port, always inspected.
- TCP **bare SYN** to any port — inbound connection attempt, always inspected (responses never carry SYN without ACK).
- TCP non-SYN to an ephemeral port — treated as outbound response (accepted gap: ACK floods to high-port services are indistinguishable from downloads without connection state).
- UDP to an ephemeral port — treated as a response only when the **source port** is well-known (`<= 1024`: DNS, NTP). Random-sport UDP floods to high ports are inspected again.

Legitimate responses (apt from `mirror:80 → you:45123`, DNS from `resolver:53 → you:5xxxx`) still bypass mitigation exactly as before.

### F9 — Userspace map keys were byte-swapped: whitelist and manual bans never matched

**Symptom:** `openshield whitelist add <ip>` printed success but the IP was **not** actually protected — it could still be scored and banned. Manual `blacklist add`, forensics-loaded ban lists, GeoIP-triggered bans, and subnet bans had the same problem: inserted, but never matched a single packet.

**Root cause:** the XDP program keys its maps with the on-wire address verbatim (`ip->saddr`, network byte order). Every userspace writer (CLI, TUI access handlers, startup whitelist populate, ban manager) instead composed the key as a big-endian integer — which on a little-endian host stores the bytes reversed, so BPF lookups never hit. Auto-bans inserted by the BPF program itself used the correct order — which is also why ban IPs displayed in the TUI/Discord were byte-reversed (the userspace *read* path made the same mistake in reverse).

**Fix:** canonical `bpf.IPToU32` / `bpf.U32ToIP` helpers (network byte order) now used by every writer and reader — whitelist add/remove, blacklist add/remove, CIDR expansion, subnet bans, GeoIP bans, ban events, top-offender and access-list display. The CLI Bloom-filter writer was additionally overwriting whole 64-bit words (erasing other entries' bits) and hashing with a different algorithm than the BPF checker; it now mirrors `bloom_hash()` exactly and ORs bits in.

**Impact if you used the whitelist before this fix:** your whitelist never worked. Re-add your trusted IPs after upgrading (startup repopulation from config applies the fix automatically). Related gap fixed at the same time: the startup loader silently **skipped CIDR entries** in `whitelist.ips` (only plain IPs loaded) — CIDRs are now expanded per-IP (bounded at 10,000), matching the CLI behavior.

### F10 — Kernel and userspace fought over `attack_state` (alert storms, stuck state)

**Symptom:** firewall showed `UNDER ATTACK` (type MIXED) at ~100 pps of pure admin traffic; Discord fired repeated attack alerts; after a loader restart the state could persist indefinitely.

**Root cause:** two kernel-side detectors (entropy spoofing, SYN/FIN ratio) wrote `attack_state = 1` directly into the baseline map — the SYN/FIN one using **cumulative** counters, so a handful of SSH sessions (SYNs that end in RST, not FIN) tripped it permanently. Meanwhile the userspace baseline writer rebuilt the whole baseline struct every interval, zeroing the state back. The two writers fought: the collector saw repeated 0→1→0 transitions and started/ended attack tracking (and webhooks) over and over. Separately, a loader killed mid-attack left `attack_state=1` in the pinned map with no one to clear it, since the classifier only writes on transitions.

**Fix:** the userspace attack classifier is now the **single owner** of `attack_state`:

- Kernel detectors keep their `prof` counters but no longer write attack state.
- The baseline writer preserves the classifier-owned fields (read-modify-write) instead of rebuilding from scratch.
- Loader startup explicitly resets any stale `attack_state` left by a previous run.

### F11 — `attack_pps_threshold` could never *raise* the trigger

**Symptom:** setting `attack_pps_threshold: 5000` to stop false positives had no effect — a 2,000 pps flood still triggered an attack.

**Root cause:** the override only applied when current traffic **already exceeded** the explicit threshold (`if currentPPS > attackPPSThreshold { spikePPS = attackPPSThreshold }`), so the learned/floored threshold (~1,000) kept triggering first. Verified live: flood at 1,800 pps triggered with threshold=5000 before the fix, and stayed quiet after it.

**Fix:** an explicit threshold now overrides the learned one outright (`if attackPPSThreshold > 0 { spikePPS = attackPPSThreshold }`).

### F12 — Baseline inflation: undetected floods trained the baseline upward ("slow climb" bypass)

**Symptom:** back-to-back or slow-ramping floods progressively stopped being detected — traffic "climbed slowly and shut the attack off", exactly as reported in production.

**Root cause:** the baseline learner folded *all* traffic into the EMA whenever `attack_state` was 0. A flood below the (inflated) trigger never set attack state, so learning continued **through the flood**, inflating the baseline in real time and chasing the spike threshold above the flood rate — the flood made itself permanently invisible. Measured live: baseline 621 → 1,695 (spike threshold 2,483 → 6,778) in 14 seconds of flooding; a 2,836 pps flood then failed to trigger because the spike threshold had reached 2,907.

**Fix:** the learner now never folds in traffic above the **effective trigger ceiling** (`max(spike_threshold, attack_min_pps)`), regardless of attack state. Organic traffic growth below the trigger is still learned normally. Verified live: with the clamp, the baseline stayed frozen for the whole flood and detection fired in ~2 s.

### F13 — Baseline-anchor scoring false-banned busy legit workloads in seconds

**Symptom:** legitimate game-server traffic (~2,000 pps UDP from one IP — 40 players behind NAT) was banned in ~2 seconds on the Gaming preset, even with correct thresholds and no attack active.

**Root cause:** the baseline-anchored detector awarded partial suspicion (40% of metric score, up to 7 points) to any source exceeding `baseline × anchor_mult` (3–6×), and it ran at the 256-packet cadence (~8 evaluations/s at 2k pps). On a quiet server (baseline ~75 pps), any busy service exceeds the anchor — accruing ~56+ points/s and banning in ~2 s. Additionally, the attack-state threshold tightening (50%) halved thresholds globally during any attack, so legit sources above the halved threshold were swept up; and `attack_min_pps` (default 1,000) let a 2k pps game server enter attack state in the first place.

**Fix (validated live — score stays 0 for 2k pps game traffic, floods still ban in ~2 s):**

- Anchor partials now fire **only during a declared attack** and **only once per window**, at 10% weight with higher multipliers (5/8/10/12 by tier).
- Profiles now set per-category `attack_min_pps`/`attack_min_bps` (Gaming 5,000, Hosting 5,000, CDN 10,000) so normal workload rates never enter attack state.
- New per-category `attack_threshold_multiplier` (0.7–0.75 for Gaming/Hosting/CDN) so tightening is gentler where legit traffic is heavy.
- Scoring is now **magnitude-scaled** (8× cap): sources far over a threshold ban in 1–2 windows; marginal violators accrue slowly.

### F14 — Global pps threshold below per-protocol thresholds (preset invariant)

**Symptom:** a pure-UDP game server exceeded the global `pps_threshold` (1,200) while staying under `udp_pps_threshold` (2,000) — the global limit fired first.

**Fix:** preset invariant enforced — global pps ≥ ~1.2× the largest per-protocol threshold for every category (Gaming 3,000, Database 2,000, Hosting 2,000).

### F15 — XDP auto-select preferred slower modes

**Fix:** auto attach now tries **offload → native → generic** (earliest drop point first), and the actual attached mode is reported in status/TUI instead of the opaque `auto`.

## Attack Type Matrix (measured, internal rig)

Each flood ran ~12 s from the veth rig. Detection latency measured from flood start to `under_attack`; recovery from flood stop to `normal`.

| Attack | Rate | Detected as | Detection latency | Recovery |
|--------|------|-------------|-------------------|----------|
| SYN flood | ~2,800 pps | `SYN_FLOOD` | ~2–3 s | ~10–12 s |
| UDP flood | ~2,800 pps | `UDP_FLOOD` | ~2–3 s | ~10–12 s |
| ICMP flood | ~2,700 pps | `ICMP_FLOOD` | ~2–3 s | ~10–12 s |
| Mixed SYN+UDP | ~3,200 pps | `MIXED` | ~2–3 s | ~10–12 s |
| SYN-ACK reflector | ~2,800 pps | `MIXED` (via SYN-ACK counter) | ~2–3 s | ~10–12 s |
| Fragmented UDP | ~1,800 pps | `UDP_FLOOD` | ~5 s | ~10–12 s |
| Heavy UDP | ~7,400 pps | `UDP_FLOOD` | ~2 s | ~10 s |
| Below explicit threshold (1,800 pps, threshold=5000) | 1,800 pps | — (no attack, correct) | — | — |

In every case the attacking source was banned within ~1–2 s by the per-source engine, independently of the global attack state.

**CPU cost during a 7,200 pps flood (single vCPU, shared VPS):** loader process 0.3% CPU, softirq time 0.0% — the XDP path cost is negligible at these rates; detection and banning added no measurable load.

## Configuration Parameter Impact Analysis (measured)

| Parameter | Value tested | Observed behavior |
|-----------|--------------|-------------------|
| `attack_pps_threshold` | `5000` with 1,800 pps flood | **Before F11 fix:** triggered anyway (bug). **After:** no attack — threshold respected. Packets still counted, source still banned per-source. |
| `attack_pps_threshold` | `1000`–`2000` with 1,800–7,400 pps floods | Triggers in 2–3 s as expected. |
| `attack_trigger_time` | `3` (default) | Detection 2–3 s after flood start. |
| `attack_trigger_time` | `6` (hot-reload) | Detection ~5–6 s after flood start; a 4 s flood never triggered. Runtime reload works, no restart needed. |
| `spike_recovery_factor` | `0.7` (default) | Attack state clears ~10–12 s after flood stops. |
| `spike_recovery_factor` | `0.9` | State holds slightly longer (recovery band sits closer to the trigger); still clears promptly after the tail drops below `0.9 × spike`. |
| `spike_recovery_time` | `10` (new default) | State clears ~10 s after traffic falls into the recovery band. Old `60` + baseline-relative recovery = hours of stuck state (F1). |
| `attack_max_duration` | `300` | Hard cap works; post-end cooldown (10 s) stops end→re-detect loops (F2). |
| baseline learning | floods below trigger | **Before F12 fix:** baseline inflated 2–3× in seconds, threshold chased the flood up, later floods invisible. **After:** baseline frozen during floods. |

### False positives you should expect

**High-speed downloads look like floods.** A `apt`/`wget` at 5–8k pps from 2–3 mirror IPs trips the spike detector (`TCP_FLOOD`) on a server whose baseline is ~60 pps. This is inherent to any spike detector on a quiet server. Mitigations:

- Raise `attack_pps_threshold` to a value above your normal burst level (e.g. `2000`–`5000`) — now actually works (F11).
- Raise `attack_trigger_time` to `5`–`8` so short downloads never trip it.
- Whitelist your package mirrors/CDN ranges.
- Note that detection does not equal impact: state changes and alerts fire, but legit flows only get dropped if they also trip the per-source suspicion engine.

## Recommended Profiles

| Server type | `attack_pps_threshold` | `attack_trigger_time` | `spike_recovery_factor` | `spike_recovery_time` |
|-------------|------------------------|-----------------------|-------------------------|-----------------------|
| Quiet (APIs, small sites) | `0` (auto) | `3` | `0.7` | `10` |
| Game server (noisy baseline) | `2000`–`3000` | `4` | `0.7` | `10` |
| Heavy download/CDN origin | `5000`+ | `6` | `0.6` | `15` |

## Preset Values (v1.6.1, validated by simulation)

Per-IP thresholds at `Balanced` level, from live simulation of each workload at NAT scale (all legit workloads passed with zero scoring; floods banned in ~2 s):

| Category | pps | bps | tcp_pps | udp_pps | syn_pps | susp | attack_min_pps | attack tightening |
|----------|-----|-----|---------|---------|---------|------|----------------|-------------------|
| Ultra Strict | 250 | 2 MB/s | 150 | 100 | 50 | 40 | 500 | 0.40× |
| Strict | 350 | 3 MB/s | 225 | 175 | 75 | 50 | 800 | 0.45× |
| Balanced (default) | 500 | 6 MB/s | 375 | 300 | 120 | 80 | 2,000 | 0.50× |
| Performance | 850 | 12 MB/s | 640 | 600 | 250 | 120 | 3,000 | 0.60× |
| Hosting | 2,000 | 24 MB/s | 1,200 | 1,200 | 500 | 200 | 5,000 | 0.70× |
| Gaming | 3,000 | 18 MB/s | 1,500 | 2,500 | 350 | 150 | 5,000 | 0.75× |
| Enterprise | 700 | 10 MB/s | 525 | 450 | 170 | 100 | 2,000 | 0.50× |
| CDN / Edge | 2,500 | 40 MB/s | 2,000 | 1,800 | 800 | 300 | 10,000 | 0.70× |
| Database | 2,000 | 24 MB/s | 1,500 | 280 | 100 | 90 | 3,000 | 0.60× |

Key tuning rules learned from simulation:

- **Global pps ≥ 1.2× the largest per-protocol threshold** — or UDP/TCP-heavy services trip the global limit first.
- **`attack_min_pps` must exceed the workload's normal rate** — a 2k pps game server at the old 1k default entered attack state, halved thresholds, and mass-banned its own players.
- **NAT aggregation is per-IP reality**: N players behind one IP multiply per-source rates — Gaming/Hosting thresholds assume up to ~50 clients per IP.
- Detection latency is ~2–3 s for clear floods (magnitude-scaled scoring), ~30–60 s for low-and-slow (anchor, attack-state only).

## Operational Notes from Live Testing

- **Whitelist your admin IPs before anything else.** With `ban_duration: 3600` (1 h default), a burst of SSH connections, an SCP transfer, or a test flood from your own IP earns a one-hour ban — locking you out mid-session. Transfers to the server at line rate can themselves trip per-source scoring; throttle (`pv -L 100k`) when pushing large files to a protected host.
- **Docker/bridge traffic to the host's own IP bypasses XDP entirely** (see methodology) — XDP only protects traffic that physically ingresses the attached interface. Services reached only via a bridge need the program attached to that bridge instead (separate instance).
- After changing `dynamic:` detection values, use `openshield-loader reload` — the detection fields are runtime-safe, no restart needed.
