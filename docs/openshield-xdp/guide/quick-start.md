# Quick Start

```bash
sudo openshield load        # Full TUI dashboard
sudo openshield load --stats-off   # Daemon mode (systemd)
sudo openshield load --stats-minimal  # Text snapshots
sudo openshield load -t 3600   # Auto-unload after 1 hour
```

If you hit a BPF error:

```bash
sudo openshield fix && sudo openshield load
```

## Verify

```bash
$ sudo openshield status
OpenShield-XDP Status
=====================
  XDP Program:  LOADED
  Loader:       RUNNING
  Telemetry:    AVAILABLE
  Interface:    eno1
  XDP Mode:     native
```

## TUI

7 interactive screens. Press `1`–`7` to switch between Dashboard, Traffic, Attacks, Bans, Logs, Status, and Config. Press `?` for help.

## Configuration

Edit `/etc/openshield/openshield.yaml`. See [Configuration Reference](/openshield-xdp/configuration/reference) for the full reference.

## Test an attack

```bash
hping3 -S --flood -p 80 <target>    # SYN flood
openshield-tui                        # Watch the dashboard
```

## Troubleshooting

| Problem | Fix |
|---------|-----|
| BPF load error | `sudo openshield fix && sudo openshield load` |
| TUI stuck at Loading | Loader not running — start with `openshield load --stats-off` |
| Another instance running | `sudo openshield unload` |
| Config not applying | `sudo openshield reload` |
