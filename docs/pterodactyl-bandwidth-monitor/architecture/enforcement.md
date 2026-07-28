---
title: Enforcement
description: How Bandwidth Monitor enforces limits on a Wings node — tc HTB egress shaping and ingress policing on container veths, the quota engine's calendar periods and exceed transitions, restarts and rollovers, and the on-disk file layout.
---

# Enforcement

Everything in this page happens on the Wings node, in the `bandwidth-noded` agent. Enforcement is kernel-level: the agent programs the Linux traffic-control subsystem, and the kernel does the shaping — there is no userspace proxy in the data path. This page covers the exact `tc` rules, the quota engine's state transitions, and what lives where on disk.

What this looks like in practice was verified live on a real panel + Wings node: a 10 Mbps cap held throughput at ~9.5 Mbps, a 1 GiB quota exceed throttled the server to its 5 Mbps throttle speeds with `quota_exceeded` + `throttled` events visible in the panel, a weekly quota exceed with the `suspend` action produced a real Pterodactyl suspension, and an admin unthrottle restored full speed immediately.

---

## tc deep dive

The agent manages rules on the **host-side veth** of each server container. The container itself sees nothing but a constrained pipe — tenants cannot inspect, alter, or evade the rules from inside.

All `tc` operations are serialized through a single mutex, and every apply starts by deleting any existing root and ingress qdiscs on the interface, so rules are always rebuilt from a clean slate. A speed of `0` means "no rule" for that direction; when both directions are 0, all rules are removed from the interface.

### Egress (server TX) — HTB hard cap

When `tx_speed_mbps > 0`, the agent builds an HTB (Hierarchical Token Bucket) tree on the veth:

```bash
tc qdisc add dev <veth> root handle 1: htb default 1
tc class add dev <veth> parent 1: classid 1:1 htb \
    rate <kbit> ceil <kbit>
tc filter add dev <veth> parent 1: protocol ip   prio 1 u32 match ip  dst 0.0.0.0/0 flowid 1:1
tc filter add dev <veth> parent 1: protocol ipv6 prio 2 u32 match ip6 dst ::/0      flowid 1:1
```

Anatomy:

- **`rate` = `ceil`.** The ceiling is deliberately set equal to the rate. A higher `ceil` would let the class borrow bandwidth and burst past the cap; equal values make it a hard cap.
- **Catch-all filters for IPv4 and IPv6.** `default 1` plus both `u32` match-all filters route every packet — regardless of protocol — into the single class.
- **Unit conversion.** Mbps × 1000 = kbit (tc speaks kilobits). Rates below 8 kbit are clamped to 8 kbit, the minimum tc accepts.

### Ingress (server RX) — policing

Shaping inbound traffic is not directly possible (the packets have already arrived), so RX caps use the **ingress qdisc with a policer** — excess packets are dropped, which pushes back on TCP congestion control:

```bash
tc qdisc add dev <veth> handle ffff: ingress
tc filter add dev <veth> parent ffff: protocol all prio 50 u32 match u32 0 0 \
    police rate <kbit> burst <kbit> drop
```

- `rate` is the RX cap in kbit.
- `burst` is `rate / 10`, clamped to a minimum of 16 kbit — enough headroom for normal TCP behavior without letting sustained throughput exceed the cap.
- The policer matches all protocols in one filter (`protocol all`, match-all `u32`).

### veth lifecycle

- **Detection.** The agent resolves a container's veth by peer ifindex matching: it reads the container's `eth0` `iflink`, then finds the host interface with that `ifindex`. If detection fails it returns an empty string — **never a guess** — because shaping the wrong interface would throttle the wrong customer. Servers without a resolved veth are skipped by enforcement until one is found.
- **Apply.** Rules are (re)applied whenever effective speeds change: a limits push/pull, a quota transition, a period reset, or `bandwidth-node reapply`.
- **Boot.** On startup the agent restores every persisted server from SQLite and re-applies tc rules for all running containers — enforcement survives agent restarts and node reboots.
- **Stop/remove.** When a container stops or is removed (from a Docker event or the periodic scan), its rules are deleted and its monitor snapshot forgotten. Servers forgotten by cleanup (unseen for 72h by default) get the same treatment.
- **Repair.** The manager can reconcile drift: rules whose server or interface no longer exists are removed (`RepairRules`), and `VerifyAll` reports interfaces that lost their qdiscs.
- **Shutdown.** Graceful daemon stop removes every managed rule (`RemoveAll`) — after all goroutines have drained, so nothing can re-add a rule mid-teardown.
- **Uninstall.** `uninstall.sh` independently sweeps every `veth*` interface and deletes root + ingress qdiscs wherever an `htb` or `ingress` qdisc is present. Docker itself never attaches qdiscs to veths, so this only ever touches rules the agent created.

---

## The quota engine

Quotas are cumulative byte counters, tracked **per direction and per period** — six counters per server: `rx/tx × day/week/month`. Every 5-second poll cycle adds the veth deltas to all six counters (and the lifetime totals) and persists them to SQLite.

### Calendar periods

Periods are anchored to the calendar in the **effective timezone** — the agent's configured `timezone` (default `UTC`), overridable by the panel through the `timezone` field of the limits payload:

| Period | Starts at |
| --- | --- |
| Day | Local midnight |
| Week | Monday 00:00 local |
| Month | The 1st, 00:00 local |

### Rollover

The tracked start of each period is persisted in the SQLite `config` table (`period_start_day/week/month`). Every poll cycle, and once at startup, the agent compares the persisted start against the expected calendar start:

- **Boundary passed** → that period's counters are zeroed for all servers, the new start is persisted, and affected servers are re-evaluated (see restore below).
- **Rollover after downtime** — because starts are persisted, an agent that was down across midnight/Monday/the 1st rolls the period over on its first poll after boot. Missed boundaries are never skipped; the comparison is against the calendar, not a timer.
- **Backward movement is not a rollover.** If the expected start moved *backwards* (timezone change or a backward clock jump), counters are preserved and only the tracked start is updated — accumulated usage is never zeroed spuriously.

### Exceed transitions

Each poll evaluates every `direction_period` combo whose quota is set (> 0): exceeded when `used >= quota`. Combos currently overridden by an admin unthrottle are skipped. What happens depends on the server's `exceed_action`:

| `exceed_action` | On exceed |
| --- | --- |
| `throttle` | Re-apply tc at the throttle speeds, per exceeded direction: an exceeded `rx_*` combo drops RX to `throttle_rx_mbps`, an exceeded `tx_*` combo drops TX to `throttle_tx_mbps` (values ≤ 0 become 1 Mbps). The non-exceeded direction keeps its configured cap |
| `suspend` | Re-apply tc at a flat **1 Mbps both directions**, then POST `/api/bandwidth/node/suspend` to the panel, which suspends the Pterodactyl server and records a `suspended` event |
| `none` | No tc change — event only |

Every newly exceeded combo emits a `quota_exceeded` event (with direction, period, and used/quota bytes); the enforcement transition emits a matching `throttled` event. Events are queued in SQLite and delivered to the panel with retry, so a panel outage delays — but never loses — the audit trail.

The suspend callback is treated as must-deliver: the agent retries immediately (5 attempts, backoff doubling from 2s), then a scheduler job retries every minute until the panel confirms. The panel side is idempotent — repeat callbacks stay silent.

### Restore on period reset

When a period rolls over, its counters are zeroed and any admin unthrottle overrides for that period are dropped. Servers whose exceeded combos all belonged to the rolled-over period have their normal speeds re-applied and a `restored` event is emitted. Servers still exceeded under a *longer* period (e.g. the day reset but the month quota is still blown) stay throttled — enforcement is re-evaluated against the full combo set, not blindly cleared.

### Admin unthrottle

`POST /api/v1/servers/{uuid}/unthrottle` (from the panel's Servers page, or the CLI) records each currently-exceeded combo as an **override**: the combo is excluded from quota evaluation, enforcement is re-run (which restores normal speeds when nothing un-overridden remains), and the override list is persisted so it survives agent restarts. Overrides are dropped when their period resets — an unthrottle buys time until the end of the current day/week/month, not forever.

### Limits removal

A `PUT /limits` payload is a full replace: servers absent from it lose their limits, enforcement flags, and tc rules (with a `restored` event if they were restricted). Setting `enabled: false` similarly means no caps and no quota enforcement for that server.

---

## File layout on a node

| Path | Contents |
| --- | --- |
| `/etc/bandwidth-node/config.yaml` | Agent configuration (YAML, `0600`) — listen address/port, poll intervals, retention, panel URL, timezone |
| `/etc/bandwidth-node/token` | The 64-hex pairing token (`0600`), shared with the panel; used for both API auth directions |
| `/var/lib/bandwidth-node/bandwidth-node.db` | SQLite state (WAL mode): servers + counters + enforcement flags, hourly history, outbound event queue, period starts, config version |
| `/var/log/bandwidth-node/bandwidth-node.log` | Rotating log (JSON or text; 100 MB max size, 10 backups, 30 days, compressed) |
| `/var/run/bandwidth-node.sock` | Unix socket for the `bandwidth-node` CLI ↔ daemon protocol |
| `/usr/local/bin/bandwidth-noded` | The daemon binary (runs under systemd) |
| `/usr/local/bin/bandwidth-node` | The CLI (`status`, `list`, `limits`, `unthrottle <uuid>`, `reapply`, `doctor`, `start/stop/restart/logs`) |
| `/etc/systemd/system/bandwidth-node.service` | The systemd unit |

### Operational commands

```bash
bandwidth-node status                 # daemon + panel sync status, tc rule count, config_version
bandwidth-node list                   # live per-server counters
bandwidth-node limits                 # currently enforced limits
bandwidth-node unthrottle <uuid>      # admin override until period reset
bandwidth-node reapply                # force re-apply of all tc rules
bandwidth-node doctor                 # health diagnostics
journalctl -u bandwidth-node.service -f
```

### Uninstall

```bash
sudo bash uninstall.sh                # full removal
sudo bash uninstall.sh --keep-config  # keep /etc/bandwidth-node
```

Stops and disables the service, sweeps the agent's tc rules from all veths, and removes the binaries, socket, config, state, and logs.

::: warning DON'T MIX MANUAL tc RULES WITH THE AGENT
The agent deletes and rebuilds the root and ingress qdiscs on managed veths on every apply. Hand-added qdiscs on those interfaces will be silently replaced — and hand-added rules may confuse `VerifyAll`/repair. If you need custom shaping, do it on a different interface layer (e.g. the Docker bridge), not on the container veths.
:::

---

## Next steps

- **[Architecture Overview →](./overview.md)** — how the agent's counters reach the panel's charts.
- **[API Reference →](../user-guide/api.md)** — the endpoints behind limits pushes and unthrottle calls.
- **[Admin Panel Guide →](../user-guide/admin-panel.md)** — driving enforcement from the panel UI.
