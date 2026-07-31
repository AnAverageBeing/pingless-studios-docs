---
title: CLI Reference
description: The sentinel node binary (daemon, scan, status, version), install/uninstall scripts, systemd commands, and the panel's sentinel:housekeeping artisan command.
---

# CLI Reference

Two command surfaces: the `sentinel` binary on each Wings node, and the panel-side artisan command.

---

## The `sentinel` binary

Installed to `/usr/local/bin/sentinel` by `install.sh`. Single static binary, CGO-free. All subcommands accept `--config PATH` (default `/etc/sentinel/config.yaml`).

```text
usage: sentinel [daemon|scan|status|version] [--config PATH]
```

### sentinel daemon

Runs the agent. This is what `sentinel-node.service` starts; you rarely invoke it by hand.

```bash
sentinel daemon --config /etc/sentinel/config.yaml
```

On start it loads the local config, reads the pairing token from `panel.token_file`, and exits with an error if the token is unreadable or `panel.url` is unset. Then it registers with the panel (retrying with backoff), applies the pushed config, and enters the tick loop: shared system snapshot every `scan_interval_seconds`, detectors, cooldown dedup, rule matching, action execution, event spool and batch flush, heartbeat every 30 s.

`sentinel daemon --help` prints usage; `sentinel daemon --version` prints the version without starting.

Log lines worth knowing:

```text
sentinel 1.0.0 starting (config version 5)
registered as node 3
```

The installer waits specifically for the `registered as node` line after a restart — a stale line from a previous run does not count.

### sentinel scan

One-off detection pass. Prints findings as JSON to stdout and a count to stderr. **No actions are taken and nothing is shipped to the panel** — safe to run any time, useful for verifying detectors against a node you suspect is dirty.

```bash
sentinel scan
```

```json
[
  {
    "uuid": "3f6c1a2e-…",
    "occurred_at": "2026-07-31T12:00:00Z",
    "category": "miner",
    "detector": "miner",
    "severity": "critical",
    "title": "cryptocurrency miner active",
    "server_uuid": "d8321c4e-…",
    "container_id": "a1b2c3…",
    "process": "/usr/bin/xmrig -o pool.minexmr.com:4444 --donate-level 1",
    "pid": 23841,
    "path": "",
    "evidence": { "cpu_percent": "387.2" },
    "actions_taken": [],
    "dry_run": false
  }
]
```

```text
1 finding(s)
```

Bounded by a 5-minute internal timeout. Uses the same engine and config as the daemon, so what `scan` finds is what the daemon would flag.

### sentinel status

Config and connectivity summary — the first thing to run when a node misbehaves.

```bash
sentinel status
```

```text
sentinel 1.0.0
config file:     /etc/sentinel/config.yaml
state dir:       /var/lib/sentinel
panel url:       https://panel.example.com
api listen:      0.0.0.0:8481
config version:  5 (applied from panel push)
dry run:         false
docker:          ok, 12 running container(s)
```

The docker line reports `UNREACHABLE (...)` when the socket cannot be dialed — almost always a docker outage or a non-standard `docker_socket` path.

### sentinel version

```bash
sentinel version
```

```text
sentinel 1.0.0
```

Also available as `sentinel --version` / `sentinel -v`. The agent reports this version at registration and in every heartbeat; the Nodes tab shows it per node.

---

## Installer scripts

### install.sh

Interactive node pairing installer, run as root on the Wings node (prompts read from `/dev/tty`, so `curl | bash` works). Prompts for panel URL, 64-hex token (regex-validated, lowercased), listen address (default `0.0.0.0`) and port (default `8481`); writes `/etc/sentinel/config.yaml` and `/etc/sentinel/token` (both `0600`); builds from source if Go is present, otherwise installs the prebuilt binary next to the script; installs and starts `sentinel-node.service`; then waits up to 90 s for registration and prints the result.

Idempotent: re-running rewrites config/token and restarts the service — this is the supported re-pairing path after a token reset. Full walkthrough: [Installation](../getting-started/installation.md#part-2-node-agent-per-wings-node).

### uninstall.sh

```bash
sudo bash uninstall.sh [--purge] [--keep-config]
```

Stops and disables the systemd unit and removes the binary and configuration. State under `/var/lib/sentinel` (spool, quarantine, intel, persisted panel config) is kept unless `--purge` is given; `--keep-config` keeps `/etc/sentinel` for a later reinstall.

---

## systemd

The unit is `sentinel-node.service` (`Type=simple`, runs as root, `Restart=always`, `RestartSec=10`, `MemoryMax=512M`, `CPUQuota=100%`, `LimitNOFILE=65536`, logs to the journal as `sentinel`). It requires `docker.service` and starts after network + docker.

```bash
systemctl status sentinel-node          # state + recent log lines
systemctl restart sentinel-node         # apply a hand-edit to /etc/sentinel/config.yaml
systemctl stop sentinel-node            # pause the agent (panel marks node offline after ~120s)
journalctl -u sentinel-node.service -f  # follow live logs
journalctl -u sentinel-node.service --since today | grep "registered as node"
```

The service auto-restarts on crash (max 5 starts per 60 s). If it enters a failed restart loop, read the journal — the common causes are an unreadable token file or an empty `panel.url`.

---

## Panel artisan commands

Run from the panel directory (`/var/www/pterodactyl`).

### sentinel:housekeeping

```bash
php artisan sentinel:housekeeping
```

Two jobs in one pass:

1. **Offline sweep** — flips `is_online` to false for any node whose `last_seen_at` is older than `sentinel.offline_after_seconds` (default 120 s). This is what keeps the Nodes tab honest between heartbeats.
2. **Event pruning** — deletes detection events older than `sentinel.event_retention_days` (default 30 days).

Output (only when something changed):

```text
Marked 1 node(s) offline, pruned 418 event(s).
```

Register it with the panel's scheduler (the same crontab entry that runs `schedule:run` every minute) so both jobs run continuously; it is safe and cheap to run manually at any time.
