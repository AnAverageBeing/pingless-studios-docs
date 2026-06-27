# CLI Commands

OpenShield-XDP provides two binaries with different command sets.

## `openshield` — Full CLI

| Command | Description | Requires root |
|---------|-------------|:---:|
| `load` | Load and attach XDP program, start TUI dashboard | Yes |
| `unload` | Unload XDP program, detach from NIC, clean up | Yes |
| `status` | Show current XDP/loader/telemetry/config state | No |
| `reload` | Hot-reload configuration via Unix socket | Yes |
| `fix` | Auto-detect and repair 7 categories of issues | Yes |
| `tui` / `stats` | Launch standalone TUI dashboard | No |
| `config` | Interactive config generator | No |
| `upgrade` | Pull latest, rebuild, reinstall (EXPERIMENTAL) | Yes |
| `install` | Run the installer script | Yes |
| `version` | Show version string | No |
| `help` | Show usage help | No |

### Load flags

| Flag | Type | Default | Description |
|------|------|---------|-------------|
| `-t <seconds>` | int | `0` | Auto-unload after N seconds |
| `--refresh <ms>` | int | `1000` | Stats poll interval in milliseconds |
| `--stats-off` | bool | `false` | Suppress all stats display (daemon mode) |
| `--stats-minimal` | bool | `false` | Print text snapshots instead of TUI |
| `-i <iface>` | string | (config) | Override `interface` from config |
| `-m <mode>` | string | (config) | Override `xdp_mode`: `native`, `generic`, `skb` |

### Fix flags

| Flag | Description |
|------|-------------|
| `-v` / `--verbose` | Show detail for each repair step |

## `openshield-loader` — Minimal daemon CLI

Used by the systemd service. Smaller binary, fewer commands.

| Command | Description | Requires root |
|---------|-------------|:---:|
| `load` | Load XDP with text stats display | Yes |
| `unload` | Unload XDP and clean up | Yes |
| `stats` | Show live text statistics | No |
| `status` | Show current status | No |
| `reload` | Reload config without unloading | Yes |
| `version` | Show version | No |
| `help` | Show usage help | No |

### Load flags (loader variant)

| Flag | Type | Default | Description |
|------|------|---------|-------------|
| `-t <seconds>` | int | `0` | Auto-unload after N seconds |
| `--stats-off` | bool | `false` | No stats display (daemon mode) |
| `-i <iface>` | string | (config) | Override interface |
| `-m <mode>` | string | (config) | Override XDP mode |

## Exit codes

| Code | Meaning |
|:----:|---------|
| `0` | Success (status: loaded and running) |
| `1` | Error or not loaded (status: not running) |

## Environment

| Variable | Effect |
|----------|--------|
| `HOME` | Used by `upgrade` to search for Go and repo paths |
| `GOROOT` | Used by `upgrade` to find Go binary |
| `PATH` | Used by `upgrade` for build pipeline |

## System paths

| Path | Used by |
|------|---------|
| `/etc/openshield/openshield.yaml` | Config file (all commands) |
| `/var/run/openshield/telemetry.sock` | Unix socket (reload, TUI, status) |
| `/var/run/openshield/loader.pid` | PID file (status, unload) |
| `/sys/fs/bpf/` | BPF filesystem (fix, load, unload) |
| `/opt/openshield/bin/` | Installed binaries |
| `/opt/openshield/lib/` | BPF object, install script |

## Next steps

[Load Deep-Dive](/openshield-xdp/cli/load) · [Status Output](/openshield-xdp/cli/status) · [Fix Reference](/openshield-xdp/cli/fix) · [TUI Guide](/openshield-xdp/user-guide/tui)
