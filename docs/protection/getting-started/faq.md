---
title: FAQ
description: Common questions about Protection Plus — DDoS scope, false positives, Tor evasion, resource usage, watchdog recovery, and excluding paths or containers.
---

# FAQ

## Does it stop inbound DDoS attacks against my node?

**No.** Protection Plus is *egress* protection: it stops your **customers** from attacking other people — outbound floods, port scans, miners, Tor exits. Mitigating inbound attacks aimed at your nodes is the job of your XDP firewall / upstream layer (see the PingLess XDP firewall). The two are complementary: one keeps abuse out, the other keeps your IPs clean.

## Will it flag my game servers as miners or floods?

Not by design — and if it does, you have the knobs to fix it. Game-server processes (`java`, `bedrock_server`, `srcds`, `RustDedicated`, `fivem`, `valheim`, …) are on the built-in `whitelist_processes` lists, so they are **exempt from the CPU and connection-flood heuristics** that catch unknown miners and floods. Note the nuance: *signature* matching still applies to them, so a miner actually named `xmrig` inside a game container is still caught. Thresholds are also tuned around game workloads — miners sustain high CPU flat, game servers spike and dip (`cpu_threshold: 85` / `sustained_seconds: 45`); game servers rarely exceed 10–20k pps against the 60k `pps_threshold`. And everything ships in `dry_run: true`, so you see what it *would* flag before it ever acts.

## A customer runs Tor on a custom port. Is it caught?

Yes. The abuse detector doesn't rely on port numbers alone — it matches the `tor` binary itself and Tor's command-line flags (`--orport`, `--socksport`, …), which fire regardless of which port the relay binds. Listening sockets on the *well-known* Tor/SOCKS/proxy ports (9001/9050/1080/…) are a separate, additional signal. If your tenants favour a specific custom port, add it to `detectors.abuse.abusive_ports`.

## How much CPU/RAM does it use?

Very little. One shared `/proc` snapshot per scan tick (default every 5s) feeds every detector, and socket→PID resolution is parallelised with a hard 1.5s time budget. Measured on live nodes: **~13 MB RSS and 1–3% CPU** at the default interval. The systemd unit additionally caps it at `MemoryMax=256M` and `CPUQuota=50%` as guardrails.

## What happens if the daemon hangs or runs out of memory?

The systemd unit is built for exactly this. The daemon pets systemd after **every scan tick**; if the detection loop hangs for longer than `WatchdogSec=60s`, systemd kills and restarts the service (`Restart=on-failure`). If it ever exceeds the `MemoryMax=256M` cap it is OOM-killed and restarted the same way. A noisy neighbour can never stall the loop either — socket resolution is time-budgeted and unresolved connections are simply skipped that tick. Optional `limits:` in the config add per-detector timeouts and alert rate caps for pathological nodes.

## How do I exclude a path or a container from everything?

Use the `whitelist:` section of the config:

```yaml
whitelist:
  paths: [/srv/trusted-builds]     # prefix-matched: exempts everything beneath
  containers: [my-admin-container] # full ID, short ID, or name
```

Whitelisted paths are **never scanned or flagged**, even if they also fall under a scan/watch path; whitelisted containers are never flagged, killed, or suspended. Matching events are dropped before the rules engine ever sees them. For finer control, per-detector `whitelist_processes` lists exempt processes from specific heuristics.

## Does it run inside my game/server containers?

No. Protection Plus runs on the **host** and watches every container from the outside via `/proc` and the Docker socket. Tenants inside a container can't see it, disable it, or evade it — and it reads each container's network namespace directly, so connections made *from inside* a container are still seen and attributed. Verify with `sudo protection debug-conns`.

## Will it nuke a server on a false positive?

Not unless you let it. It ships in **`dry_run: true`** — it only detects and alerts until you explicitly arm enforcement. Every threshold and signature list is tunable, and the smart `neutralize` action refuses to touch PID ≤ 1. Follow the [Quick Start](./quick-start.md) dry-run workflow.

## Does it need the Docker SDK, libpcap, YARA, or a database?

No. It's a single static binary (zero cgo) that reads `/proc` and talks plain HTTP to `/var/run/docker.sock`. The YARA and trivy CLIs are **optional** extras — install them only if you want YARA file scanning or image vulnerability scanning; without them those checks are silent no-ops. The on-access hash blocklist just needs one `protection rules update`.

## I run a plain VPS, not Pterodactyl. Is it useful?

Yes. Set `mode: server` (or `both`). The `neutralize` action kills the offending **process** when there's no container, so host miners, scanners, reverse shells and bombs are all handled. Just leave the Pterodactyl action disabled.

## Why does it need root?

Reading other users' processes, mapping sockets to owning PIDs, reading per-process disk I/O (for the zip-bomb hot-trigger), and entering container network namespaces all require root (or `CAP_SYS_PTRACE` + `CAP_DAC_READ_SEARCH` + `CAP_KILL`). The bundled systemd unit runs as root with hardening applied — read-only filesystem, pinned capabilities, resource caps.

## Can I disable a specific detector?

Yes — set its `enabled: false` in the config, or delete its block entirely. Each of the ten detectors (`miner`, `portscan`, `ddos`, `zipbomb`, `exploit`, `abuse`, `onaccess`, `fim`, `yara`, `trivy`) is independent.

## How do I change what happens when a threat is found?

Edit the [`rules`](../user-guide/actions-rules.md) section. Rules map a threat category + minimum severity to a list of actions (`alert`, `neutralize`, `kill_container`, `suspend_server`, `quarantine_file`, …).

## How do I detect a brand-new miner that isn't in the signature list?

The miner detector also flags **sustained high CPU** (configurable `cpu_threshold` / `sustained_seconds`) and **masked binaries** (a deleted-on-disk executable burning CPU), so unknown miners are still caught. Signature + sustained CPU together escalates to critical.

## Where do quarantined files go?

To `actions.file.quarantine_dir` (default `/var/lib/protection/quarantine`), moved and `chmod 000` so they can't be executed — evidence is preserved rather than deleted.
