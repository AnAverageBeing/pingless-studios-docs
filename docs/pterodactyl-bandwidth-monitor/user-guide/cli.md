---
title: CLI Reference
description: Every bandwidth-node CLI command — status, list, limits, doctor, unthrottle, reapply, service control — plus the systemctl and journalctl operations for running the node agent.
head:
  - - meta
    - name: og:title
      content: Bandwidth Monitor — Node CLI Reference
  - - meta
    - name: og:description
      content: Full reference for the bandwidth-node command-line client and day-to-day systemd operations on a Wings node.
---

# CLI Reference

`bandwidth-node` is the command-line client for the node agent. It talks to the running daemon (`bandwidth-noded`) over the Unix socket at `/var/run/bandwidth-node.sock` — run it as **root** on the Wings node. The service-control commands (`start`, `stop`, `restart`, `logs`) wrap `systemctl`/`journalctl` directly.

::: tip SOCKET LOCATION
The CLI connects to `/var/run/bandwidth-node.sock` (or `general.socket_path` in the config). If you moved the socket, point the CLI at it with `BANDWIDTH_NODE_SOCKET=/path/to.sock`. A "cannot connect to daemon" error almost always means the service isn't running — check `systemctl status bandwidth-node.service`.
:::

```text
Usage:
  bandwidth-node [command]

Monitoring:
  status              Show daemon status
  list, stats         List managed servers with live counters
  limits              Show enforced per-server limits
  doctor, health      Run health diagnostics

Management:
  unthrottle <uuid>   Remove throttle for one server (admin override)
  reapply             Reapply tc rules to all servers
  start|stop|restart  Control the systemd service
  logs                Show recent daemon logs (journalctl)
  version             Show version
  help                Show this help
```

Running `bandwidth-node` with no command prints this help. An unknown command prints `Unknown command: <cmd>` plus the help and exits with code `1`.

---

## Monitoring commands

### `status`

```bash
bandwidth-node status
```

One-shot health summary of the daemon and its panel sync — the first command to run when anything looks wrong.

```text
bandwidth-node daemon status

  State:          running
  Version:        1.0.0
  Uptime:         3d 4h 12m
  Servers:        12 total (1 throttled, 1 quota-exceeded)
  Docker:         ✓ healthy
  Database:       ✓ healthy
  Panel:          ✓ healthy
  Config version: 12
  TC rules:       24 active
  Poll:           every 5s
  Timezone:       UTC
```

| Field | Meaning |
| --- | --- |
| `State` | Daemon state: `running`, `stopped`, or `error`. |
| `Servers` | Managed servers, with throttled and quota-exceeded counts in parentheses. |
| `Docker` / `Database` / `Panel` | Subsystem health — Docker reachability, SQLite connectivity, panel reachability. `Panel: ✗ unhealthy` means heartbeats are failing (token, URL, or network). |
| `Config version` | The limits version this node last applied. Compare with the panel — a lower number that never catches up means limit pulls are failing. |
| `TC rules` | Number of active `tc` rules. `0` with speed caps configured means enforcement is not applied — run [reapply](#reapply) and then [doctor](#doctor-alias-health). |
| `Poll` / `Timezone` | Effective stats/quota cycle and quota-reset timezone. |

### `list` (alias: `stats`)

```bash
bandwidth-node list
```

Live per-server counters for every managed server on the node.

```text
UUID                                   STATE           RX_MBPS     TX_MBPS    DAY_RX_GB    DAY_TX_GB      FLAGS
------------------------------------------------------------------------------------------------------------
c3f0a1b2-4d5e-6f7a-8b9c-0d1e2f3a4b5c   online             9.51       1.02         0.87         0.12  throttled
7a8b9c0d-1e2f-3a4b-5c6d-7e8f9a0b1c2d   online            42.10      18.33        12.40         5.61
e5f6a7b8-9c0d-1e2f-3a4b-5c6d7e8f9a0b   offline            0.00       0.00         0.00         0.00

Total: 12 pterodactyl servers
```

| Column | Meaning |
| --- | --- |
| `UUID` | Pterodactyl server UUID (= Docker container name assigned by Wings). |
| `STATE` | `online` (container running) or `offline`. |
| `RX_MBPS` / `TX_MBPS` | Current download/upload rate in megabits per second. |
| `DAY_RX_GB` / `DAY_TX_GB` | Bytes used so far today, in GB, per direction. |
| `FLAGS` | `throttled` when the server is under throttle; `exceeded:<combo>` listing blown quotas, e.g. `exceeded:tx_month` or `exceeded:rx_day,tx_day`. |

The throttled server above pinning at **9.51 Mbps RX against a 10 Mbps cap** is exactly what production testing showed — kernel-level `tc` shaping, no userspace proxy.

### `limits`

```bash
bandwidth-node limits
```

Shows the enforced limit set the node last received from the panel (persisted in its local SQLite, so this works even if the panel is down).

```text
UUID                                   RX_MBPS   TX_MBPS      DAY_GB     WEEK_GB    MONTH_GB     ACTION
----------------------------------------------------------------------------------------------------
c3f0a1b2-4d5e-6f7a-8b9c-0d1e2f3a4b5c        10        10         1/1         ∞/∞        ∞/∞   throttle
7a8b9c0d-1e2f-3a4b-5c6d-7e8f9a0b1c2d       100        50         ∞/∞         ∞/∞     500/250    suspend
```

Quota columns show `RX/TX` pairs; `∞` means unlimited (a configured value of `0`). `ACTION` is the exceed action: `throttle`, `suspend`, or `none`.

If no limits have been pushed yet (fresh pairing, panel never reached), the table prints `(no limits configured — waiting for panel)` instead.

### `doctor` (alias: `health`)

```bash
bandwidth-node doctor
```

Runs the full health-check suite and reports `healthy`, `degraded`, or `unhealthy` overall.

```text
Overall Health: healthy

  ✓ Docker:              Docker daemon reachable
  ✓ Database:            SQLite connection healthy
  ✓ Traffic Control:     All 24 tc rules verified
  ✓ Permissions:         Network interface access OK
  ✓ Disk Space:          182.4 GB available
  ✓ Memory:              21.3 MB allocated
  ✓ CPU:                 8 CPUs, 34 goroutines
```

| Check | Fails when |
| --- | --- |
| `Docker` | The Docker daemon is unreachable (Wings down, socket hung). |
| `Database` | The SQLite state file can't be opened — corruption or disk full. |
| `Traffic Control` | One or more `tc` rules are missing or drifted — run [reapply](#reapply) to repair. Shows "TC management disabled" (ok) when `traffic_control.enabled: false`. |
| `Permissions` | `/sys/class/net` is unreadable — the agent lost its network capabilities. |
| `Disk Space` | Under 1 GB free on `/`. |
| `Memory` | Agent allocation above ~500 MB. |
| `CPU` | Informational — CPU count and goroutine count. |

---

## Management commands

### `unthrottle <uuid>`

```bash
bandwidth-node unthrottle c3f0a1b2-4d5e-6f7a-8b9c-0d1e2f3a4b5c
```

```text
Server c3f0a1b2-4d5e-6f7a-8b9c-0d1e2f3a4b5c unthrottled.
```

Admin override: removes the throttle for **one** server immediately, restoring its normal speed caps. The override holds **until the exceeded period resets** (midnight / Monday 00:00 / 1st of the month in the configured timezone) — quota checks skip the cleared direction+period combo until then. If the quota is exceeded again in a *different* period or direction, the server is throttled again.

Use it when a legitimate burst (a game update, a backup pull) tripped a daily quota and you want the customer back at full speed without waiting for midnight — this exact flow was verified live on a production node. The panel's unthrottle action (`POST /api/v1/servers/{uuid}/unthrottle`) performs the same operation remotely.

Omitting the UUID prints `Usage: bandwidth-node unthrottle <server-uuid>` and does nothing.

### `reapply`

```bash
bandwidth-node reapply
```

```text
TC rules reapplied successfully.
```

Re-applies `tc` rules to every managed server from the limits persisted in the node's SQLite. Use it after:

- `doctor` reports `N tc rules need repair`
- manual `tc` experimentation or another tool wiped qdiscs
- a Docker/network stack restart left veth interfaces without rules

This is also what the daemon does automatically on boot — rules survive restarts.

### `start` / `stop` / `restart`

```bash
bandwidth-node restart
```

```text
bandwidth-node restarted.
```

Thin wrappers over `systemctl start|stop|restart bandwidth-node.service` — equivalent to running systemctl yourself. Restart after any change to `/etc/bandwidth-node/config.yaml` or `/etc/bandwidth-node/token`.

### `logs`

```bash
bandwidth-node logs
```

Shows the last 50 log lines: `journalctl -u bandwidth-node.service -n 50 --no-pager`. For live tailing, use journalctl directly (see below).

### `version` / `help`

```bash
bandwidth-node version
```

```text
bandwidth-node v1.0.0 — Pterodactyl bandwidth monitoring node agent
```

`help` (also `-h`, `--help`) prints the usage summary shown at the top of this page.

---

## systemd & journal operations

The agent runs as `bandwidth-node.service` — a hardened systemd unit (root with `CAP_NET_ADMIN`, `CAP_NET_RAW`, `CAP_SYS_ADMIN`; `Restart=always`; 512 MB memory cap; 200% CPU quota). Everyday operations:

```bash
# Lifecycle
systemctl start bandwidth-node.service
systemctl stop bandwidth-node.service
systemctl restart bandwidth-node.service        # after config/token changes
systemctl status bandwidth-node.service
systemctl enable bandwidth-node.service         # start on boot (done by install.sh)

# Logs
journalctl -u bandwidth-node.service -f          # live tail
journalctl -u bandwidth-node.service -n 200      # last 200 lines
journalctl -u bandwidth-node.service --since "1 hour ago"
journalctl -u bandwidth-node.service -p warning  # warnings and errors only
```

The daemon also writes a rotating file log at `/var/log/bandwidth-node/bandwidth-node.log` (JSON by default — see [Configuration Reference](../configuration/reference.md#logging)).

::: warning SIGTERM, NOT SIGKILL
The unit stops the daemon with `SIGTERM` so it can shut down cleanly. If you ever `kill -9` the process, systemd restarts it after 10 s and rules are re-applied on boot — but in-flight event queue deliveries may be retried, which is normal.
:::

## Uninstall

```bash
sudo bash uninstall.sh                # full removal
sudo bash uninstall.sh --keep-config  # keep /etc/bandwidth-node (config + token)
```

Stops and disables the service, removes the `tc` rules the agent created, then removes the binaries, config, state, and logs. `--keep-config` preserves your pairing token and config for a reinstall.
