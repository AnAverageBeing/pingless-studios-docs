# CLI Commands

| Command | Description |
|---------|-------------|
| `openshield load` | Load XDP with TUI dashboard |
| `openshield unload` | Unload XDP and clean up |
| `openshield status` | Show current status |
| `openshield fix` | Auto-detect and repair issues |
| `openshield reload` | Reload config without unloading |
| `openshield version` | Show version |

## Load Flags

| Flag | Description |
|------|-------------|
| `-t <seconds>` | Auto-unload after N seconds |
| `--refresh <ms>` | Stats refresh (default 1000) |
| `--stats-off` | Daemon mode |
| `--stats-minimal` | Text snapshots |
| `-i <iface>` | Override interface |
| `-m <mode>` | Override XDP mode |

