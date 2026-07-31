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

### What actually works

- A real external host on a normal residential/cloud connection sending **uns spoofed** floods (`hping3 -i u100..u500`), with the attacker's IP whitelisted so management access survives the test.
- Watching `total_*_packets` counters in `global_stats_map` (or the telemetry socket) to confirm arrival — "packets sent" on the attacker proves nothing.

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

## Configuration Parameter Impact Analysis

What we observed changing each value on a live server (baseline ≈ 60 pps, noisy game-server background):

| Parameter | Default | Observed effect |
|-----------|---------|-----------------|
| `attack_pps_threshold` | `0` (auto) | `0` = use the learned spike threshold (≈ 4× baseline, floored by `attack_min_pps`). Set explicitly (e.g. `2000`) on busy servers to stop legit burst false-positives. |
| `attack_min_pps` | `1000` | Absolute floor for the trigger threshold. Prevents a freshly-seeded low baseline from making the threshold tiny. Real bursts (package downloads at 5–8k pps) still exceed it — see note below. |
| `attack_trigger_time` | `3` (s) | Consecutive seconds above threshold before attack state. `3` catches floods fast but also 3-second legit spikes; `5–8` absorbs short download bursts at the cost of slower detection. |
| `spike_recovery_factor` | `0.7` | Fraction of the spike threshold below which the attack ends. **Must be < 1.0.** `0.5` = ends sooner (flappier), `0.9` = ends later (smoother). Values ≥ 1.0 are clamped to `0.7`. |
| `spike_recovery_time` | `10` (s) | Consecutive seconds in the recovery band before the attack ends. `60` (old default) left the firewall reporting "under attack" a full minute after the flood stopped; `10–15` tracks reality. |
| `attack_max_duration` | `300` (s) | Hard cap on attack state. After it fires, the cooldown (10 s) prevents instant re-trigger loops. |
| `new_src_pps` / suspicion engine | profile | Drives per-source scoring and bans; unaffected by the attack-state fixes — bans keep dropping traffic regardless of the global state. |

### False positives you should expect

**High-speed downloads look like floods.** A `apt`/`wget` at 5–8k pps from 2–3 mirror IPs trips the spike detector (`TCP_FLOOD`) on a server whose baseline is ~60 pps. This is inherent to any spike detector on a quiet server. Mitigations:

- Raise `attack_pps_threshold` to a value above your normal burst level (e.g. `2000`–`5000`).
- Raise `attack_trigger_time` to `5`–`8` so short downloads never trip it.
- Whitelist your package mirrors/CDN ranges.
- Note that detection does not equal impact: state changes and alerts fire, but legit flows only get dropped if they also trip the per-source suspicion engine.

## Recommended Profiles

| Server type | `attack_pps_threshold` | `attack_trigger_time` | `spike_recovery_factor` | `spike_recovery_time` |
|-------------|------------------------|-----------------------|-------------------------|-----------------------|
| Quiet (APIs, small sites) | `0` (auto) | `3` | `0.7` | `10` |
| Game server (noisy baseline) | `2000`–`3000` | `4` | `0.7` | `10` |
| Heavy download/CDN origin | `5000`+ | `6` | `0.6` | `15` |
