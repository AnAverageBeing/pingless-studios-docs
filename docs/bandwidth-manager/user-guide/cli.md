# CLI Reference

`bandwidth` is the command-line interface for Bandwidth Manager. Every interaction with the daemon flows through this binary. This page documents every subcommand, its syntax, output, and when you should reach for it.

[[toc]]

## Shell Completion

Before diving into commands, set up shell completion so you can tab your way through:

::: code-group

```bash [bash]
# Add to ~/.bashrc
source <(bandwidth completion bash)
```

```zsh [zsh]
# Add to ~/.zshrc
autoload -Uz compinit && compinit
source <(bandwidth completion zsh)
```

```fish [fish]
# Add to ~/.config/fish/config.fish
bandwidth completion fish | source
```

:::

::: tip One-liner for all shells
Run `bandwidth completion --install` to auto-detect your shell and append the right snippet. Restart your session afterwards.
:::

---

## Daemon Lifecycle

Commands that control the background service.

### `start`

Launch the Bandwidth Manager daemon.

```bash
bandwidth start [--foreground] [--config <path>]
```

| Option         | Description                              |
| -------------- | ---------------------------------------- |
| `--foreground` | Run in the foreground (no daemonization) |
| `--config`     | Path to a non-default configuration file |

```
$ bandwidth start
✔ Daemon started (PID 1423)
  Config: /etc/bandwidth/config.yml
  Logs:   /var/log/bandwidth/daemon.log
```

**When to use:** After installation, after a system reboot (unless you've set up a systemd unit), or after calling `bandwidth stop`.

---

### `stop`

Gracefully shut down the daemon.

```bash
bandwidth stop [--force] [--timeout <seconds>]
```

| Option      | Description                                |
| ----------- | ------------------------------------------ |
| `--force`   | Send SIGKILL immediately                   |
| `--timeout` | Wait this many seconds before force-killing (default `15`) |

```
$ bandwidth stop
⠋ Waiting for daemon to exit...
✔ Daemon stopped (PID 1423 exited cleanly)
```

**When to use:** Before uninstalling, before major config rewrites, or when debugging a hung daemon.

---

### `restart`

Stop, then start the daemon.

```bash
bandwidth restart [--force]
```

```
$ bandwidth restart
✔ Daemon stopped
✔ Daemon started (PID 1456)
```

**When to use:** After editing the configuration file manually (equivalent to `stop && start`).

---

### `reload`

Reload the configuration file **without** restarting the daemon. Connections are not dropped.

```bash
bandwidth reload
```

```
$ bandwidth reload
✔ Configuration reloaded (21 rules applied, 0 errors)
```

**When to use:** After tweaking limits or adding/removing containers from the config. Faster than `restart` and zero downtime.

---

### `reapply`

Reapply all traffic-control (`tc`) rules on every interface. Use this when the kernel flushes qdiscs (e.g. after a network restart).

```bash
bandwidth reapply [--interface <name>] [--dry-run]
```

```
$ bandwidth reapply
✔ eth0 — 3 qdiscs reinstalled
✔ docker0 — 2 qdiscs reinstalled
  lo   — skipped (no rules configured)

Reapplied 5 rules across 2 interfaces in 0.8s
```

**When to use:** After `systemctl restart networking`, after Docker restarts, or when `bandwidth status` shows missing qdiscs.

---

### `enable` / `disable`

Toggle bandwidth enforcement on or off without changing configuration.

```bash
bandwidth enable
bandwidth disable
```

```
$ bandwidth disable
⚠ Bandwidth enforcement is now DISABLED
  All traffic flows unrestricted.
  Run 'bandwidth enable' to resume.
```

**When to use:** Temporarily lift all limits for maintenance or testing. Safer than editing config because a single `enable` restores everything.

---

## Configuration

### `setup`

Interactive first-run wizard.

```bash
bandwidth setup [--non-interactive] [--preset <name>]
```

| Preset      | Description                              |
| ----------- | ---------------------------------------- |
| `docker`    | Auto-detect Docker containers            |
| `basic`     | Single-interface, global limit           |
| `advanced`  | Walk through every option                |

```
$ bandwidth setup

  ██████╗  █████╗ ███╗   ██╗██████╗ ██╗    ██╗
  ██╔══██╗██╔══██╗████╗  ██║██╔══██╗██║    ██║
  ██████╔╝███████║██╔██╗ ██║██║  ██║██║ █╗ ██║
  ██╔══██╗██╔══██║██║╚██╗██║██║  ██║██║███╗██║
  ██████╔╝██║  ██║██║ ╚████║██████╔╝╚███╔███╔╝
  ╚═════╝ ╚═╝  ╚═╝╚═╝  ╚═══╝╚═════╝  ╚══╝╚══╝

  Welcome to Bandwidth Manager setup!

  → Which interface should be managed? [eth0]:
  → Enable Docker integration? [Y/n]: y
  → Default per-container limit (Mbps): 100
  → Enable webhook notifications? [y/N]: n
  → Apply limits at daemon start? [Y/n]: y

✔ Configuration saved to /etc/bandwidth/config.yml
✔ Daemon started — run 'bandwidth start' if you skipped this step
```

**When to use:** First time installing. You can re-run it to overwrite your config (it will back up the old one).

---

### `configure`

Set or read individual configuration keys.

```bash
bandwidth configure get <key>
bandwidth configure set <key> <value>
bandwidth configure list
```

```
$ bandwidth configure get daemon.log_level
"info"

$ bandwidth configure set daemon.log_level debug
✔ daemon.log_level → "debug" (reload required)

$ bandwidth configure list
  daemon.log_level        = "debug"
  daemon.poll_interval    = "5s"
  limits.default_rx       = "100mbit"
  limits.default_tx       = "100mbit"
  notifications.discord   = true
  …
```

**When to use:** Quick tweaks without opening a YAML editor. Useful in scripts.

---

### `config`

Print the entire resolved configuration (merged with defaults).

```bash
bandwidth config [--format <yaml|json|toml>]
```

```
$ bandwidth config --format json | head -n 12
{
  "daemon": {
    "log_level": "info",
    "poll_interval": "5s",
    "data_dir": "/var/lib/bandwidth"
  },
  "limits": {
    "default_rx": "100mbit",
    "default_tx": "100mbit",
    "containers": {
      "web-app": { "rx": "50mbit", "tx": "50mbit" },
      "db":      { "rx": "200mbit", "tx": "200mbit" }
    }
  }
  …
```

**When to use:** Verify the effective configuration after layering defaults, env vars, and config file. Pipe to `jq` for scripting.

---

## Inspection & Diagnostics

### `status`

Quick health overview of the daemon and managed interfaces.

```bash
bandwidth status [--json] [--watch]
```

```
$ bandwidth status
  Daemon:        ● running (PID 1423, uptime 3h 12m)
  Enforcement:   ● active
  Interfaces:    3 managed, 0 errors

  INTERFACE   RX LIMIT     TX LIMIT     CONTAINERS
  eth0        100 Mbps     100 Mbps     2
  docker0     1 Gbps       1 Gbps       5
  wg0         50 Mbps      50 Mbps      1

  Last reload: 2026-06-30 09:15:44 UTC
```

**When to use:** The first thing you run when something feels off.

---

### `doctor`

Run a full diagnostic suite — config validation, binary permissions, `tc` support, Docker socket access, and webhook reachability.

```bash
bandwidth doctor [--fix]
```

```
$ bandwidth doctor
  ✔ config syntax valid
  ✔ data directory writable (/var/lib/bandwidth)
  ✔ tc available (iproute2 6.1.0)
  ✔ kernel supports HTB qdisc
  ✔ Docker socket reachable
  ✘ Discord webhook unreachable — HTTP 401 (invalid token)
  ✔ Slack webhook OK
  ✔ systemd unit installed

  6/7 checks passed (1 warning)

  Run 'bandwidth doctor --fix' to attempt automatic repair.
```

**When to use:** After installation, after kernel upgrades, or when the daemon won't start.

---

### `health`

Lightweight liveness probe. Returns exit code 0 if healthy, non-zero otherwise.

```bash
bandwidth health [--timeout <seconds>]
```

```
$ bandwidth health && echo "OK" || echo "DOWN"
OK
```

```
$ bandwidth health --timeout 2
✘ Daemon unresponsive (connection refused)
$ echo $?
1
```

**When to use:** In health-check scripts, Docker `HEALTHCHECK`, Kubernetes liveness probes, or monitoring systems.

```
# Docker Compose example
healthcheck:
  test: ["CMD", "bandwidth", "health"]
  interval: 30s
  timeout: 5s
```

---

### `inspect`

Show detailed bandwidth usage for a specific container or interface.

```bash
bandwidth inspect <container-name|interface> [--live] [--interval <seconds>]
```

```
$ bandwidth inspect web-app
  Container:    web-app (a3f2c1d…)
  Interface:    eth0
  Status:       managed
  RX Limit:     50 Mbps
  TX Limit:     50 Mbps

  Current Usage (5s avg):
    RX: ████████░░  8.2 Mbps  (16%)
    TX: ███░░░░░░░  2.1 Mbps  ( 4%)

  95th Percentile (24h):
    RX: 31.4 Mbps   TX: 18.7 Mbps
```

**When to use:** When a container feels slow — check if it's hitting its cap.

---

### `inspect-port`

Show traffic breakdown by port on a container.

```bash
bandwidth inspect-port <container> [--port <number>] [--top <n>]
```

```
$ bandwidth inspect-port web-app --top 5
  PORT    PROTO   RX (1m avg)   TX (1m avg)   CONNECTIONS
  443     TCP     6.3 Mbps      1.1 Mbps       48
  80      TCP     1.8 Mbps      0.9 Mbps       23
  8080    TCP     0.4 Mbps      0.1 Mbps        3
  5432    TCP     0.2 Mbps      0.2 Mbps        1
  22      TCP     0.1 Mbps      0.0 Mbps        1
```

**When to use:** Identify which service inside a container is consuming bandwidth.

---

### `logs`

View daemon logs.

```bash
bandwidth logs [--follow] [--tail <n>] [--level <debug|info|warn|error>]
```

```
$ bandwidth logs --tail 20 --level warn
2026-06-30T09:12:01Z WARN  Container 'old-app' not found — removing from config
2026-06-30T09:12:01Z WARN  eth0 qdisc 'htb 1:2' missing — will reapply on next poll
2026-06-30T09:15:44Z INFO  Config reloaded (21 rules)
```

**When to use:** Debugging why a limit isn't being applied, or checking webhook delivery status.

---

### `history`

View historical bandwidth usage.

```bash
bandwidth history <container> [--range <duration>] [--granularity <duration>]
```

```
$ bandwidth history web-app --range 24h --granularity 1h

  web-app — Last 24 hours (hourly avg)

  00:00  ████████░  8.3 Mbps
  01:00  ██████░░░  6.1 Mbps
  02:00  ███░░░░░░  3.2 Mbps
  …
  20:00  █████████  9.8 Mbps  ← peak hour
  21:00  ████████░  8.5 Mbps
  22:00  ███████░░  7.2 Mbps
  23:00  ██████░░░  5.9 Mbps

  Total transferred: 142.3 GB
```

**When to use:** Capacity planning, identifying peak hours, or investigating a spike.

---

### `stats`

Aggregated statistics across all managed containers.

```bash
bandwidth stats [--live] [--json]
```

```
$ bandwidth stats
  Managed containers:  8
  Total RX (1m avg):   312.4 Mbps
  Total TX (1m avg):   187.2 Mbps
  Containers at limit:  2 (web-app, api-worker)
  Dropped packets:      14,203 (0.02%)

  Top talkers (RX):
    1. video-cdn      142.1 Mbps
    2. db-replica      89.3 Mbps
    3. web-app         31.4 Mbps
```

**When to use:** Dashboard overview; pair with `--json` for Grafana/Prometheus ingestion.

---

## Management

### `list`

List all managed containers with their current limits and status.

```bash
bandwidth list [--filter <status>] [--sort <rx|tx|name>]
```

```
$ bandwidth list
  CONTAINER      STATUS    RX LIMIT    TX LIMIT    RX NOW     TX NOW
  web-app        active    50 Mbps     50 Mbps     8.2 Mbps   2.1 Mbps
  api-worker     active    100 Mbps    100 Mbps    94.7 Mbps  88.3 Mbps  ⚠
  db             active    200 Mbps    200 Mbps    89.3 Mbps  12.1 Mbps
  redis          active    50 Mbps     50 Mbps     0.3 Mbps   0.1 Mbps
  old-app        missing   —           —           —          —
```

**When to use:** Get a quick inventory. The `⚠` marker flags containers nearing their limit.

---

### `limits`

Show or modify bandwidth limits for a specific container.

```bash
bandwidth limits show <container>
bandwidth limits set <container> <rx> <tx> [--unit <bps|kbps|mbps|gbps>]
```

```
$ bandwidth limits show api-worker
  Container:  api-worker
  RX Limit:   100 Mbps  (currently using 94.7 Mbps — 94.7%)
  TX Limit:   100 Mbps  (currently using 88.3 Mbps — 88.3%)
  Burst:      120 Mbps (10s window)

$ bandwidth limits set api-worker 200mbps 200mbps
✔ api-worker limits updated → reloading…
✔ Reload complete (1 rule changed)
```

**When to use:** Adjust limits on the fly without editing config files.

---

### `reset`

Reset bandwidth counters for a container or all containers.

```bash
bandwidth reset [<container>] [--all]
```

```
$ bandwidth reset web-app
✔ Counters reset for 'web-app'
  History archived to /var/lib/bandwidth/archive/2026-06-30_web-app.json
```

**When to use:** Start a fresh measurement window (e.g. beginning of billing cycle).

---

### `cleanup`

Remove stale data: counters for removed containers, old archives, rotated logs.

```bash
bandwidth cleanup [--dry-run] [--retention <days>]
```

```
$ bandwidth cleanup --dry-run
  Would remove:
    3 orphaned container directories (142 MB)
    18 archive files older than 30 days (2.1 GB)
    4 rotated log files (88 MB)
  Total reclaimable: 2.33 GB

  Run without --dry-run to execute.
```

**When to use:** Periodic housekeeping. Set up a cron job: `0 3 * * 0 bandwidth cleanup --retention 90`.

---

## Data & Integration

### `export`

Export bandwidth data in various formats.

```bash
bandwidth export [--format <csv|json|prometheus>] [--range <duration>] [--output <file>]
```

```
$ bandwidth export --format prometheus --range 1h
# HELP bandwidth_rx_bytes_total Total bytes received
# TYPE bandwidth_rx_bytes_total counter
bandwidth_rx_bytes_total{container="web-app",interface="eth0"} 4.2e9
bandwidth_rx_bytes_total{container="api-worker",interface="eth0"} 1.8e10
bandwidth_rx_bytes_total{container="db",interface="docker0"} 3.1e11
…
```

**When to use:** Feeding metrics into Prometheus, Grafana, or external analytics.

---

### `webhook test`

Send a test payload to all configured webhooks.

```bash
bandwidth webhook test [--platform <discord|slack|generic>]
```

```
$ bandwidth webhook test
  Discord: ✔ Delivered (HTTP 204) — 312ms
  Slack:   ✔ Delivered (HTTP 200) — 287ms
  Generic: ✘ Failed — connection timeout (https://example.com/webhook)
```

**When to use:** After setting up webhooks for the first time, or when notifications stop arriving. See the [Webhooks guide](./webhooks) for full setup.

---

## Daemon Subcommands

### `daemon`

Direct daemon management subcommands.

```bash
bandwidth daemon status      # Same as 'bandwidth status'
bandwidth daemon info        # Extended daemon metadata
bandwidth daemon reload      # Same as 'bandwidth reload'
bandwidth daemon shutdown    # Same as 'bandwidth stop'
```

```
$ bandwidth daemon info
  Version:       2.4.1 (commit a3f2c1d)
  Built:         2026-06-15T08:00:00Z
  Go version:    go1.22.4
  PID:           1423
  Uptime:        3h 14m
  Goroutines:    24
  Memory:        18.3 MB
  Config path:   /etc/bandwidth/config.yml
  Data path:     /var/lib/bandwidth
```

**When to use:** Mostly for debugging and issue reporting. The top-level shortcuts (`status`, `reload`, `stop`) are preferred.

---

## Informational

### `version`

Print version and build metadata.

```bash
bandwidth version [--short]
```

```
$ bandwidth version
Bandwidth Manager v2.4.1
  Commit:  a3f2c1d
  Built:   2026-06-15T08:00:00Z
  Go:      go1.22.4 (linux/amd64)
```

```
$ bandwidth version --short
2.4.1
```

**When to use:** Reporting bugs, or checking if an update is available.

---

### `help`

Display help for any command.

```bash
bandwidth help [command]
```

```
$ bandwidth help inspect

  Inspect bandwidth usage for a container or interface.

  Usage:
    bandwidth inspect <name> [flags]

  Flags:
    --live              Continuously refresh output
    --interval int      Refresh interval in seconds (default 2)
    --json              Output as JSON
```

**When to use:** Quick reference when you forget a flag. Equivalent to `bandwidth <command> --help`.

---

### `completion`

Generate shell completion scripts.

```bash
bandwidth completion <bash|zsh|fish|powershell> [--install]
```

| Flag        | Description                                      |
| ----------- | ------------------------------------------------ |
| `--install` | Auto-detect shell and append to the correct rc file |

```
$ bandwidth completion bash
# bash completion for bandwidth                          -*- shell-script -*-

_bandwidth() {
    local cur prev words cword
    _init_completion || return
    …
}
complete -F _bandwidth bandwidth
```

**When to use:** Once per shell session (or once in your rc file). See the [Shell Completion](#shell-completion) section above.

---

## TUI

### `top`

Launch the interactive terminal UI. See the dedicated [TUI guide](./tui) for full documentation.

```bash
bandwidth top [--interval <seconds>]
```

```
$ bandwidth top

 ┌─ Bandwidth Manager ────── live · 2s ─────── 2026-06-30 09:18 ─┐
 │  ████████████████████████████████████████░░░░░░░░░░  312 Mbps  │
 │  ┌─ Interfaces (4) ────────────────────┐ ┌─ web-app ──────────┐ │
 │  │ ● eth0        142 Mbps              │ │ ╭── RX ───╮        │ │
 │  │ ● docker0      98 Mbps              │ │ │███████░░│ 8.2M   │ │
 │  │ ● wg0          52 Mbps              │ │ ╰─────────╯        │ │
 │  │ ● lo            0 Mbps              │ │ ╭── TX ───╮        │ │
 │  │                                     │ │ │███░░░░░░│ 2.1M   │ │
 │  │                                     │ │ ╰─────────╯        │ │
 │  └─────────────────────────────────────┘ │ Avg:    31.4 Mbps   │ │
 │                                          │ 95%ile: 45.2 Mbps   │ │
 │                                          │ Peak:   49.8 Mbps   │ │
 │  [q]Quit [s]Sort [tab]Filter [1/5/t/d]Period └────────────────┘ │
 └────────────────────────────────────────────────────────────────┘
```

::: tip Terminal requirements
The TUI renders best in terminals with **true color** (24-bit) support and **braille-capable** fonts. Popular choices: Kitty, WezTerm, iTerm2, Windows Terminal.
:::

---

## Command Quick Reference

| Command          | Category         | Quick description                            |
| ---------------- | ---------------- | -------------------------------------------- |
| `start`          | Lifecycle        | Start the daemon                             |
| `stop`           | Lifecycle        | Stop the daemon                              |
| `restart`        | Lifecycle        | Stop then start                              |
| `reload`         | Lifecycle        | Reload config without restart                |
| `reapply`        | Lifecycle        | Reinstall tc qdiscs on interfaces            |
| `enable`         | Lifecycle        | Resume bandwidth enforcement                 |
| `disable`        | Lifecycle        | Pause bandwidth enforcement                  |
| `setup`          | Configuration    | Interactive first-run wizard                 |
| `configure`      | Configuration    | Get/set individual config keys               |
| `config`         | Configuration    | Print resolved configuration                 |
| `status`         | Inspection       | Quick daemon + interface overview            |
| `doctor`         | Inspection       | Full diagnostic suite                        |
| `health`         | Inspection       | Liveness probe (for scripting)               |
| `inspect`        | Inspection       | Detailed per-container usage                 |
| `inspect-port`   | Inspection       | Per-port traffic breakdown                   |
| `logs`           | Inspection       | View/follow daemon logs                      |
| `history`        | Inspection       | Historical usage data                        |
| `stats`          | Inspection       | Aggregated statistics                        |
| `list`           | Management       | List managed containers                      |
| `limits`         | Management       | Show/modify container limits                 |
| `reset`          | Management       | Reset bandwidth counters                     |
| `cleanup`        | Management       | Remove stale data                            |
| `export`         | Integration      | Export data (CSV/JSON/Prometheus)            |
| `webhook test`   | Integration      | Test webhook delivery                        |
| `daemon`         | Daemon           | Daemon subcommands                           |
| `version`        | Informational    | Print version info                           |
| `help`           | Informational    | Show help for any command                    |
| `completion`     | Informational    | Generate shell completion                    |
| `top`            | TUI              | Launch interactive terminal UI               |
