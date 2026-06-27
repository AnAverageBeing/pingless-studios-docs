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

### `openshield version`

```bash
openshield version
# Output: OpenShield-XDP v1.0.0
```

Also accessible via `openshield --version` or `openshield -v`.

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

[TUI Guide](/openshield-xdp/user-guide/tui) · [Load Deep-Dive](/openshield-xdp/cli/load) · [Configuration](/openshield-xdp/user-guide/configuration)
