# CLI Reference

OpenShield-XDP provides two binaries:
- **`openshield`** — full-featured user CLI with TUI, config generation, repair, and upgrade
- **`openshield-loader`** — minimal systemd daemon binary (reduced surface, fewer commands)

## `openshield` commands

### `openshield load`

Load and attach the XDP program, then start telemetry collection and (by default) launch the TUI dashboard.

```bash
sudo openshield load [flags]
```

| Flag | Type | Default | Description |
|------|------|---------|-------------|
| `-t` | int | `0` | Auto-unload after N seconds (`0` = run forever) |
| `--refresh` | int | `1000` | Stats refresh interval in milliseconds |
| `--stats-off` | bool | `false` | No stats display (daemon mode for systemd) |
| `--stats-minimal` | bool | `false` | Minimal text stats instead of full TUI |
| `-i` | string | (from config) | Override config interface |
| `-m` | string | (from config) | Override XDP mode: `native`, `generic`, `skb` |

See [Load Command Deep-Dive](/openshield-xdp/cli/load) for the full loading lifecycle, safety confirmation, and auto-repair flow.

### `openshield unload`

Gracefully unload the XDP program, detach from the NIC, remove BPF pins, stop the loader process, and clean up socket/PID files.

```bash
sudo openshield unload
```

Three-phase process:
1. Stop running loader process (SIGINT → SIGTERM → SIGKILL fallback)
2. Remove all BPF pins via `bpf.Unload()`
3. Force-detach any orphaned XDP program from the NIC

### `openshield status`

Show the current state of the XDP program, loader process, telemetry socket, and configuration.

```bash
sudo openshield status
```

See [Status Output Format](/openshield-xdp/cli/status) for detailed field descriptions.

### `openshield reload`

Reload configuration without unloading the XDP program. Connects to the running loader's Unix socket and sends a `config_update` message.

```bash
sudo openshield reload
```

Requires the loader to be running (the telemetry socket at `/var/run/openshield/telemetry.sock` must exist). All runtime-safe fields are applied immediately to the BPF config map.

### `openshield fix`

Auto-detect and repair 7 categories of common issues.

```bash
sudo openshield fix           # Standard repair
sudo openshield fix -v        # Verbose (show detail for each step)
```

See [Fix Command Reference](/openshield-xdp/cli/fix) for the full list of fixable issues.

### `openshield tui` / `openshield stats`

Launch the TUI dashboard (if the loader is already running with stats enabled).

```bash
sudo openshield tui
sudo openshield stats          # Alias
```

Connects to the loader's Unix socket and renders the 7-screen dashboard. Requires the loader to be running (start with `openshield load --stats-off` for daemon + `openshield tui` for dashboard).

### `openshield config`

Interactive configuration generator. Walks you through each config section and saves to `/etc/openshield/openshield.yaml`.

```bash
sudo openshield config
```

### `openshield upgrade` (EXPERIMENTAL)

Automated 5-step upgrade: git pull → build BPF → generate bindings → build Go → stop/install/restart.

```bash
sudo openshield upgrade
```

::: danger
Runs `git clone` and `make` as root. For production, prefer manual `git pull && sudo ./install.sh --update`.
:::

### `openshield install`

Run the installer script if present at `/opt/openshield/lib/install.sh`.

```bash
sudo openshield install
```

### `openshield whitelist` / `openshield blacklist`

Manage the live whitelist (bypasses all mitigation) and manual bans.

```bash
sudo openshield whitelist add 203.0.113.10        # or a CIDR, or a file of IPs
sudo openshield whitelist remove 203.0.113.10
sudo openshield whitelist list

sudo openshield blacklist add 5.6.7.8 3600        # manual ban, duration in seconds (default 24h)
sudo openshield blacklist add bad_ips.txt         # bulk import from file
sudo openshield blacklist remove 5.6.7.8
sudo openshield blacklist list
```

::: tip Whitelist entries persist (v2.0+)
`whitelist add` / `whitelist remove` write through to `whitelist.ips` in `/etc/openshield/openshield.yaml`, so entries survive loader restarts. Previously they lived only in the BPF map and were lost on restart.
:::

### `openshield key`

Show the Metrics API URL and API key (only when `metrics.enabled: true`), or manage the key. Changes are hot-applied — no restart.

```bash
sudo openshield key                  # show URL + key + curl example
sudo openshield key set <your-key>   # use your own key (min 8 chars)
sudo openshield key regen            # rotate to a fresh random key
```

See [Metrics API](/openshield-xdp/user-guide/metrics-api).

### `openshield behavior`

Show the behavior engine's learned per-port baselines and candidate source clusters (states, confidence scores, reasons).

```bash
sudo openshield behavior
```

### `openshield schedule`

Pause behavior-engine learning or auto-blocking ahead of a known traffic spike (launch day, migration).

```bash
sudo openshield schedule list
sudo openshield schedule suppress baseline 6h
sudo openshield schedule suppress auto-block 6h
sudo openshield schedule clear baseline|auto-block|all
```

### `openshield report`

Print a network analysis report (daily, weekly, or monthly).

```bash
sudo openshield report [daily|weekly|monthly]
```

### `openshield uninstall`

Remove OpenShield-XDP from the system (also available as `uninstall.sh`).

```bash
sudo openshield uninstall
```

### `openshield version`

```bash
openshield version
# Output: OpenShield-XDP v2.1.1
```

Also accessible via `openshield --version` or `openshield -v`.

### `openshield behavior`

Show the adaptive behavior engine's live state: learned per-port baselines
(observations, median PPS, average packet size) and candidate clusters with
confidence scores and reasons. See
[Adaptive Behavior](/openshield-xdp/detection-engine/behavior).

```bash
openshield behavior
```

### `openshield schedule`

Manage suppression windows for baseline learning and auto pattern blocking —
use ahead of a known legitimate traffic spike (launch, match start) so the
surge neither poisons baselines nor gets auto-blocked. Schedules persist
across restarts and expire automatically.

```bash
openshield schedule list                          # show active windows
sudo openshield schedule suppress baseline 2h     # pause baseline learning 2h
sudo openshield schedule suppress auto-block 90m  # pause auto-blocking 90m
sudo openshield schedule clear baseline           # remove one window
sudo openshield schedule clear all                # remove all windows
```

### `openshield whitelist` / `openshield blacklist`

```bash
sudo openshield whitelist add 1.2.3.4            # or a CIDR, or a file of entries
sudo openshield whitelist remove 1.2.3.4
openshield whitelist list
sudo openshield blacklist add 5.6.7.8 3600       # manual ban (default 24h)
sudo openshield blacklist remove 5.6.7.8
openshield blacklist list
```

### `openshield license`

```bash
sudo openshield license activate <key>           # save and activate a license key
sudo openshield license refresh                  # force a re-check now
openshield license status                        # tier, HWID, expiry, grace
```

### `openshield report`

Print a network analysis report (daily by default; weekly/monthly optional).

```bash
openshield report [daily|weekly|monthly]
```

### `openshield webhook-test` / `openshield alert test`

Send a dummy attack alert to the configured webhook to verify delivery and
formatting.

## Aliases

| Alias | Command |
|-------|---------|
| `st` | `status` |
| `wl` | `whitelist` |
| `bl` | `blacklist` |
| `lic` | `license` |
| `cfg` | `config` |
| `dash` | `stats` |

## `openshield-loader` commands

The `openshield-loader` binary is a minimal daemon-oriented CLI used by the systemd service. It has fewer commands and no TUI integration.

```bash
openshield-loader <command> [flags]
```

| Command | Description |
|---------|-------------|
| `load` | Load XDP with live stats display (text-based) |
| `unload` | Unload XDP and clean up |
| `stats` | Show live text statistics (requires XDP loaded) |
| `status` | Show current status |
| `reload` | Reload configuration without unloading |
| `version` | Show version |
| `help` | Show help |

### Load flags (loader variant)

| Flag | Description |
|------|-------------|
| `-t <seconds>` | Auto-unload after N seconds |
| `--stats-off` | No stats display (daemon mode) |
| `-i <interface>` | Override config interface |
| `-m <mode>` | Override XDP mode |

The systemd service runs: `openshield-loader load --stats-off`

## System paths

| Path | Purpose |
|------|---------|
| `/etc/openshield/openshield.yaml` | Configuration file |
| `/var/run/openshield/telemetry.sock` | Unix socket for TUI/reload communication |
| `/var/run/openshield/loader.pid` | Loader process PID file |
| `/var/log/openshield/openshield.log` | Log file |
| `/opt/openshield/bin/` | Installed binaries |
| `/opt/openshield/lib/` | BPF object and libraries |
| `/sys/fs/bpf/` | BPF filesystem (pinned maps and programs) |

## Next steps

[TUI Guide](/openshield-xdp/user-guide/tui) · [Metrics API](/openshield-xdp/user-guide/metrics-api) · [Config Values in Plain Language](/openshield-xdp/user-guide/config-values) · [Load Deep-Dive](/openshield-xdp/cli/load)
