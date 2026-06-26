# CLI Reference

## load

```bash
sudo openshield load [flags]
```

Attaches the XDP program and starts telemetry.

| Flag | Effect |
|------|--------|
| `--stats-off` | Daemon mode (no TUI) |
| `--stats-minimal` | Text snapshots |
| `-t <seconds>` | Auto-unload after N seconds |
| `-i <iface>` | Override interface |
| `-m <mode>` | Override XDP mode |
| `--refresh <ms>` | Stats poll interval (default 1000) |

## unload

```bash
sudo openshield unload
```

Detaches XDP, removes BPF pins, stops the loader.

## fix

```bash
sudo openshield fix
```

Auto-repairs: stale BPF pins, unmounted `/sys/fs/bpf`, dead PID files, stale sockets, orphaned XDP programs, config struct mismatches, missing directories.

Runs automatically when `load` encounters map-related errors.

## status

```bash
sudo openshield status
```

Shows: XDP loaded/unloaded, loader running/stopped, telemetry status, interface, XDP mode, whitelist count.

## reload

```bash
sudo openshield reload
```

Reloads configuration without unloading XDP.

## Next steps
[TUI Guide](/openshield-xdp/user-guide/tui) · [Detection Overview](/openshield-xdp/detection-engine/overview)

