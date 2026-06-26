# Quick Start

## Load

```bash
sudo openshield load
```

This starts the full TUI dashboard. A 10-second safety confirmation appears — press `Enter` while your SSH session is still accessible to confirm the program stays loaded. If SSH was blocked by a bad config, the program auto-unloads, restoring access.

## Daemon mode

For production (systemd):

```bash
sudo openshield load --stats-off
```

No TUI, no safety prompt. The installed systemd service uses this mode:

```bash
sudo systemctl enable --now openshield-loader
```

## Verify

```bash
sudo openshield status
```

::: details Expected output
```
OpenShield-XDP Status
=====================
  XDP Program:  LOADED
  Loader:       RUNNING
  Telemetry:    AVAILABLE
  Interface:    eno1
  XDP Mode:     native
```
:::

## Common problems

### "Error: failed to load BPF program"

```bash
sudo openshield fix && sudo openshield load
```

Stale BPF pins from a previous installation are the most common cause.

### TUI stuck at "Loading..."

The loader process isn't running. Start it:

```bash
sudo openshield load --stats-off
```

### "Another loader instance is running"

```bash
sudo openshield unload
sudo openshield load
```

## CLI modes

| Command | Use case |
|---------|----------|
| `openshield load` | Interactive TUI dashboard |
| `openshield load --stats-off` | Systemd daemon mode |
| `openshield load --stats-minimal` | Text-based snapshots |
| `openshield load -t 3600` | Auto-unload after 1 hour |

## Next steps

- [Configuration Reference](/openshield-xdp/user-guide/configuration)
- [TUI Guide](/openshield-xdp/user-guide/tui)
- [CLI Reference](/openshield-xdp/reference/cli)

