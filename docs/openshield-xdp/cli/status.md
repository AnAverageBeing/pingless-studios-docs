# `openshield status` — Output Format

The `status` command prints a human-readable snapshot of the current OpenShield-XDP state.

## Usage

```bash
openshield status
# or
sudo openshield status
```

Root is not required unless `/sys/fs/bpf` permissions are restricted.

## Output fields

```
OpenShield-XDP Status
=====================
  XDP Program:  LOADED
  Loader:       RUNNING
  Telemetry:    AVAILABLE
  Interface:    eno1
  XDP Mode:     native
  Static Mit:   true
  Dynamic Mit:  true
  Whitelist:    true (3 IPs)
  Config:       PRESENT
  BPF Pin:      EXISTS
  Systemd:      INSTALLED
```

### Field descriptions

| Field | Source | Values |
|-------|--------|--------|
| **XDP Program** | `bpf.IsLoaded()` — checks if `/sys/fs/bpf/` contains pinned maps | `LOADED` (green) or `NOT LOADED` (red) |
| **Loader** | PID file at `/var/run/openshield/loader.pid` — checks if the process is alive and its cmdline contains "openshield" | `RUNNING` (green) or `NOT RUNNING` (yellow) |
| **Telemetry** | Unix socket at `/var/run/openshield/telemetry.sock` — checks if file exists | `AVAILABLE` (green) or `UNAVAILABLE` (red) |
| **Interface** | Config file `interface` field | NIC name (e.g., `eno1`, `eth0`) |
| **XDP Mode** | Config file `xdp_mode` field | `native`, `generic`, `skb`, or `auto` |
| **Static Mit** | Config file `static.enabled` | `true` or `false` |
| **Dynamic Mit** | Config file `dynamic.enabled` | `true` or `false` |
| **Whitelist** | Config file `whitelist.enabled` + count of `whitelist.ips` | `true (N IPs)` or `false` |
| **Config** | Config file existence at `/etc/openshield/openshield.yaml` | `PRESENT` or `MISSING` (red) |
| **BPF Pin** | `bpf.LinkPinPath` — BPF link pin file | `EXISTS` (green) or `MISSING` (red) |
| **Systemd** | Service file at `/etc/systemd/system/openshield-loader.service` | `INSTALLED` (green) or `NOT INSTALLED` (yellow) |

## Exit codes

| Code | Meaning |
|:----:|---------|
| `0` | XDP program is loaded AND loader is running |
| `1` | Not loaded or loader not running |

Scripts can check `$?` for automation:

```bash
if openshield status > /dev/null 2>&1; then
    echo "OpenShield is running"
else
    echo "OpenShield is not running"
fi
```

## Color output

The command uses ANSI escape codes for color:
- 🟢 Green (`\033[32m`) — loaded, running, available, exists
- 🔴 Red (`\033[31m`) — not loaded, unavailable, missing
- 🟡 Yellow (`\033[33m`) — not running, not installed

Color output is sent to stdout regardless of whether the output is a TTY. To strip colors:

```bash
openshield status | sed 's/\x1b\[[0-9;]*m//g'
```

## Relation to TUI status screen

The CLI `status` command shows a static snapshot. The TUI Status screen (key `6`) shows the same information plus:
- Real-time health badges (loader/xdp/telemetry/event pipe status)
- Live statistics (total/passed/dropped, pass/drop rates)
- Map utilization with progress bars
- Drop path breakdown
- Kernel version and system uptime

## Next steps

[Fix Reference](/openshield-xdp/cli/fix) · [Load Deep-Dive](/openshield-xdp/cli/load) · [CLI Commands](/openshield-xdp/cli/commands)
