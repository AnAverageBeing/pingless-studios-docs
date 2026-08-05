# Silent Guardians

The best protections are the ones you never configured and never notice. This page documents every invisible guard in OpenShield-XDP — the things that keep *your* traffic safe while the firewall hunts attackers. Most exist because a real user hit the failure mode first; each is now permanent.

---

## Your SFTP uploads never get you banned

**The problem:** a client uploading a 2 GB world file over SFTP looks *exactly* like a TCP flood to any rate-based firewall — thousands of packets per second from one IP, sustained. In early versions, uploaders got banned mid-transfer. Every time.

**The guard — established-connection exemption (A2):** OpenShield doesn't trust rate; it trusts *proof*. When a source completes a real TCP handshake and then sends a **data segment** — actual payload — the kernel marks it `established`. From that moment the source skips PPS/BPS/TCP rate scoring entirely.

The details are what make it bulletproof:

- The mark requires a **payload-carrying** segment after a recent SYN. A blind ACK flood — even one smart enough to send a SYN first — carries no payload and never earns the mark.
- Marking works **even on presets where connection-tracking enforcement is off** (Hosting, Performance, CDN) — observation and enforcement are deliberately decoupled, so bulk transfers on those profiles are protected too.
- SYN-rate, connection-rate and UDP scoring stay fully active for established sources — an attacker can't ride a real connection to flood harder.
- The mark lives in the per-IP LRU entry and expires naturally with it.

File uploads, backups, rsync, database replication, big API responses — all protected by the same proof. Knob: `static.ct_established_exempt` (default: on).

## Your own downloads never fake an attack

**The problem:** the server itself downloads things — GeoIP database updates (~30 MB), blocklist feeds, apt packages, backups. That's a multi-thousand-PPS inbound burst from a CDN, arriving the moment the loader starts. It crossed the attack floors and got declared a **TCP_FLOOD** — which then tightened every threshold server-wide against your real users.

**The guard — outbound-response exemption:** the XDP program recognizes replies to connections the server itself initiated (non-SYN TCP to an ephemeral port; UDP only from well-known source ports). Such traffic:

- skips per-source rate limiting and suspicion scoring (so the CDN never gets banned), and
- is counted in separate `outresp_*` counters that are **subtracted from the rates the attack classifier and baseline learner see** (since v2.3.1) — your own traffic can never declare an attack or inflate the baseline.

The totals still count everything, so the dashboard shows real throughput. Only detection is filtered. SYN floods aimed at high ports are still caught — bare SYNs are never treated as responses.

## Your admin IP whitelists itself

Every time the loader starts in an SSH session, OpenShield reads `SSH_CONNECTION`, takes *your* source IP, and whitelists it — live in the map **and** persisted to the config file. Persisted means it survives reboots: after a boot autostart (`openshield load -always`), the whitelist is re-applied from disk before the first packet is judged. Even if you remove it by hand, the next interactive load re-adds it.

The firewall can never lock out its own operator.

## Players never disconnect mid-attack

**The problem:** the per-port attack cap is the best weapon against rotating floods — but a naive cap on a Minecraft port would throttle *everyone* on it, kicking real players along with the bots.

**The guard — player protection:** two classes of sources are exempt from the port cap:

1. **Established sources** — they proved a real TCP session (Java Edition keeps playing untouched).
2. **Pre-attack sources** — anyone whose first packet arrived *before* the attack started (Bedrock/UDP players, long-standing clients). Flood bots by definition appear *after*.

A legit *new* player joining mid-attack shares the capped pool — a degraded join, not a disconnect. Attackers get the drop; your community doesn't.

## The baseline can't be poisoned

Dynamic detection compares live traffic against a learned baseline. Attackers know this — the "slow climb" bypass gradually raises traffic so the baseline inflates and the spike threshold chases it upward, rendering the flood invisible.

Three guards make that impossible:

- **Learning freezes during attacks** — attack traffic never enters the EMA.
- **Above-trigger ceiling** — traffic over the effective trigger is *never* learned, declared attack or not. Organic growth below the trigger still is.
- **Behavior engine freeze** — the clustering engine also stops learning while an attack is active, and poisoned state is never persisted.

## No false attack storms

Declaring "under attack" tightens every threshold — a false positive hurts. The classifier is wrapped in hygiene:

- **Hysteresis** — the spike must persist for N consecutive intervals (`attack_trigger_time`, default 3) before declaration.
- **Recovery band** — attacks end at spike × factor, not at the baseline, so they don't linger for hours on busy servers.
- **Re-trigger cooldown** — within 10 s of an attack ending, re-declaring requires a clearly renewed spike (≥2×).
- **Anti-flap re-classification** — type changes need two consecutive sightings, 15 s apart.
- **Absolute timeout** — `attack_max_duration` ends any stuck state.
- **Absolute floors** — `attack_min_pps/bps` mean a collapsed baseline can never silently disable detection.
- **Startup warmup** — `attack_warmup_sec` (default 20) suppresses *declaration* right after loader start, when mass reconnects and catch-up bursts look like spikes. Per-IP mitigation runs unaffected.

## Lists clean up after themselves

- **Unban-before-whitelist** — whitelisting a banned IP removes the ban first; the two lists can't fight.
- **Moves** — blacklist→whitelist (and back) is one action, not two error-prone steps.
- **Never-block (whitelabel)** — auto-fetch feeds can never block your chosen IPs/subnets, without whitelisting them from the firewall itself.
- **Import hygiene** — file imports validate every line, strip comments, skip invalid entries, and deduplicate.
- **Bulk-ban safety filter** — mass-blacklisting an attack's IP list skips whitelisted and established sources automatically.
- **Feed failure tolerance** — fetched entries expire at 2× the fetch interval, so a broken or hijacked feed never perma-blocks.

## The firewall protects itself

Under a mega-flood, a firewall that logs every drop or emits an event per packet dies of its own observability:

- **Log flood pause** — new sources over 500/s or attack PPS over 10k pauses file logging (`LOG PAUSED` in the TUI), resuming automatically.
- **BPF event rate limiting** — per-second event caps in the kernel; the ring buffer never blocks the datapath.
- **Alert queue** — webhook dispatch drops rather than blocking the firewall; warnings are coalesced to one per 30 s; ban-batch events are packed into single embeds every 5 s to stay under Discord rate limits.

## Crash-proof state

Restarting — or crashing — never loses your security posture:

- **Bans** persist to disk on daemonize and restore with their *remaining* lifetimes; the file is deleted after restore so a crash loop can't re-apply stale bans.
- **Baseline**, **geo blocks**, **ban notes**, and **suppression schedules** all persist and restore.
- **Closing the TUI never stops protection** — `q` hands off to systemd (or a re-exec daemon with a liveness check); bans and baseline carry over.
- **Self-repair** — a failed load triggers automatic cleanup and retry; `openshield fix` handles the rest; stale pins and crashed predecessors are detected and taken over gracefully.
- **Boot autostart** — `openshield load -always` enables the hardened systemd unit: it waits for the network to actually be online, restarts forever without giving up, and re-applies your persisted whitelist.

## Fail-open where it matters

- **No config loaded = pass all.** If the config map is empty, XDP passes everything — a broken deploy can never blackhole your server.
- **Empty MAC whitelist fails open** — enabling MAC-filter whitelist mode with zero entries warns and passes instead of dropping 100% of traffic. ARP is always exempt, so gateway resolution never breaks.
- **License grace** — an unreachable license server doesn't instantly disarm you: cached state plus a configurable grace period keeps protection running.

## PCAP that survives

The rolling capture (~3 minutes of pre-attack history in three 60-second files) watches its own tcpdump process and respawns it on failure. When an attack is declared, the relevant ring file is harvested into the attack's forensics bundle automatically.

---

These guards are why OpenShield can be aggressive by default: the more certain it is about what *legitimate* looks like, the harder it can swing at everything else.
