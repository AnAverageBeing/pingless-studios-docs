---
title: Installation
description: Install Protection Plus on a Pterodactyl, Docker or VPS host — prerequisites, one-line install, manual install, build from source, verification, troubleshooting and uninstall.
---

# Installation

Protection Plus is a single static binary plus a systemd unit. The fastest path is the one-line installer; a manual path and a build-from-source path are documented below.

## Prerequisites

| Requirement | Notes |
| --- | --- |
| **Linux** | x86_64 (`amd64`) or ARM64 (`aarch64`). Kernel 4.x+ |
| **Root access** | Protection Plus reads every process, inspects network state across namespaces, and enforces. The systemd unit runs as root. |
| **systemd** | Recommended for running as a service (optional — you can run it by hand). |
| **Docker** *(optional)* | Required only for container detection/enforcement and Pterodactyl. Talks to `/var/run/docker.sock`. |
| **`curl`** | Used by the installer. |

::: info NO RUNTIME DEPENDENCIES
There is no Go toolchain, libpcap, Python, or database to install. The binary is fully static (CGO disabled).
:::

---

## One-line install (recommended)

```bash
curl -fsSL https://raw.githubusercontent.com/AnAverageBeing/protection/main/install.sh | sudo bash
```

The installer will:

1. Detect your architecture and download the matching prebuilt binary to `/usr/local/bin/protection`.
2. Install the systemd unit at `/etc/systemd/system/protection.service`.
3. Create state directories under `/var/lib/protection` (including a `0700` quarantine dir).
4. **Interactively ask** a few important questions, then write `/etc/protection/config.yaml`.
5. Enable and start the service.

### The interactive prompts

```text
? Name this installation [node-fra-01]:
? Protect what? (server / docker / both) [both]:
? Discord webhook URL for alerts (blank to skip):
? Using Pterodactyl? auto-suspend abusive servers (y/N): y
?   Panel URL (e.g. https://panel.example.com):
?   Application API key (ptla_...):
? Directories to scan for zip bombs (comma-separated, or ALL) [/var/lib/pterodactyl/volumes]:
? Arm enforcement now? 'no' keeps safe dry-run mode (y/N): N
```

What each answer does:

- **Name this installation** — the human label shown in every alert. Use something that tells you *which* node is paging you at 3am (`node-fra-01`, not `vps`). Defaults to the hostname.
- **Protect what?** — the scope: `server` (host/VPS processes only), `docker` (containerised threats only) or `both` (recommended for game hosts).
- **Discord webhook URL** — blank skips Discord alerts; you can wire up Discord, SMTP or a generic webhook later in the config.
- **Using Pterodactyl?** — only asked when the mode is `docker` or `both`. Answering `y` asks for the panel URL and an Application API key (`ptla_…` with server read + suspend) so abusive servers can be suspended automatically.
- **Directories to scan** — accepts a **single path** (`/var/lib/pterodactyl/volumes`), a **comma-separated list** (`/var/lib/pterodactyl/volumes,/home`), or the literal **`ALL`**, which expands to the standard user-writable locations (`/tmp`, `/var/tmp`, `/dev/shm`, `/home`, plus `/var/lib/pterodactyl/volumes`, `/var/lib/pterodactyl/mounts`, `/var/www`, `/srv` and `/opt` when they exist). The answer fills `zipbomb.scan_paths`, `yara.scan_paths` and `onaccess.watch_paths`.
- **Arm enforcement now?** — controls `dry_run`. Answer `N` and the daemon detects and alerts but touches nothing. Review alerts for a few days, then arm it (see the [Quick Start](./quick-start.md)).

::: tip
The prompts work even through `curl … | sudo bash` because the installer reads from `/dev/tty`. If no terminal is attached (e.g. in CI), it falls back to safe defaults. If `/etc/protection/config.yaml` already exists it is left untouched — re-running the installer is also how you upgrade.
:::

Everything you are *not* asked about has a sensible default you can change later in the [config file](../configuration/reference.md).

---

## Manual install

If you'd rather not pipe a script to `bash`:

```bash
# 1. Download the binary for your architecture
ARCH=$(uname -m | sed 's/x86_64/amd64/;s/aarch64/arm64/')
curl -fsSL -o protection \
  "https://github.com/AnAverageBeing/protection/releases/latest/download/protection-linux-${ARCH}"
sudo install -m0755 protection /usr/local/bin/protection

# 2. Create the starter config (dry-run by default)
sudo protection config init /etc/protection/config.yaml

# 3. Install the systemd unit
sudo curl -fsSL -o /etc/systemd/system/protection.service \
  https://raw.githubusercontent.com/AnAverageBeing/protection/main/packaging/protection.service

# 4. State directory for quarantined files
sudo mkdir -p /var/lib/protection/quarantine && sudo chmod 700 /var/lib/protection/quarantine

# 5. Enable & start
sudo systemctl daemon-reload
sudo systemctl enable --now protection
```

---

## Build from source

Requires Go ≥ 1.22 (Linux; CGO is disabled, so the result is fully static).

```bash
git clone https://github.com/AnAverageBeing/protection.git
cd protection
sudo make install            # builds bin/protection, installs binary + systemd unit
sudo protection config init  # writes /etc/protection/config.yaml (dry_run: true)
sudo systemctl daemon-reload && sudo systemctl enable --now protection
```

All make targets:

| Target | What it does |
| --- | --- |
| `make build` | Compile a static, version-stamped binary into `./bin` |
| `make test` | Run the unit tests |
| `make vet` | Run `go vet` |
| `make fmt` | `gofmt` the tree |
| `make run` | Build and run a one-off scan against the default config |
| `sudo make install` | Install the binary + systemd unit (honours `PREFIX`, default `/usr/local`, and `DESTDIR`) |
| `make uninstall` | Remove the installed binary and unit |
| `make clean` | Remove `bin/` |

The version is injected at build time from `git describe --tags --always --dirty`, falling back to `1.0.0`.

Cross-compile for another architecture:

```bash
CGO_ENABLED=0 GOOS=linux GOARCH=arm64 go build -trimpath -ldflags "-s -w" -o protection-linux-arm64 ./cmd/protection
```

---

## Post-install verification

```bash
# Version
protection version

# Config + Docker connectivity + enabled detectors/alerts
protection status

# Pull the threat intel (YARA rules + SHA-256 blocklist) — needed once
# for on-access hash scanning
sudo protection rules update

# One-off scan (no enforcement) — proves detection works end-to-end
sudo protection scan

# Confirm your alert channels deliver
protection test-alert
```

A healthy `protection status` looks like:

```text
config:        /etc/protection/config.yaml (ok)
installation:  node-fra-01
mode:          both
scan interval: 5s
dry run:       true
detectors:     miner, portscan, ddos, zipbomb, exploit, abuse, onaccess, fim
alerts:        discord
docker:        connected via /var/run/docker.sock
```

Check the service:

```bash
systemctl status protection
journalctl -u protection -f      # live activity
```

---

## The systemd unit

The bundled unit (`packaging/protection.service`) runs the daemon as `protection run --config /etc/protection/config.yaml` with a watchdog, hardening and resource caps:

```ini
[Service]
Type=simple
ExecStart=/usr/local/bin/protection run --config /etc/protection/config.yaml
Restart=on-failure
RestartSec=5
NotifyAccess=main
WatchdogSec=60s
AmbientCapabilities=CAP_SYS_PTRACE CAP_KILL CAP_DAC_READ_SEARCH
ProtectSystem=strict
ReadWritePaths=/var/lib/protection /var/log -/var/lib/pterodactyl/volumes
ProtectHome=read-only
MemoryMax=256M
CPUQuota=50%
```

Key directives:

| Directive | Effect |
| --- | --- |
| `WatchdogSec=60s` | The daemon pets systemd after **every scan tick**. If the detection loop hangs longer than 60s, systemd kills and restarts the service. Keep this comfortably above `general.scan_interval`. |
| `Restart=on-failure` | Crashes, hangs and OOM kills are recovered automatically after 5s. |
| `MemoryMax=256M` / `CPUQuota=50%` | Hard resource guardrails, so the watchdog can never become the problem it watches for. |
| `AmbientCapabilities` | The daemon runs as root (it must read other users' processes) but pins only the three capabilities it needs. |
| `ProtectSystem=strict` + `ReadWritePaths` | The whole filesystem is read-only except the state dir, the log dir and Pterodactyl volumes (the `-` prefix skips that path on non-Pterodactyl hosts). |

---

## Troubleshooting

::: details `docker: UNREACHABLE (permission denied)`
The daemon (or your shell for `scan`) can't reach the Docker socket. The bundled systemd unit runs as root and works out of the box. If you run commands by hand, use `sudo`, or add your user to the `docker` group. With Docker unreachable, container detection and container-level enforcement are disabled, but host (`server`-scope) detection still works.
:::

::: details `not running as root: introspection and enforcement may be limited`
Reading other users' processes, mapping sockets to PIDs, reading per-process disk I/O, and entering container network namespaces all require root (or `CAP_SYS_PTRACE` + `CAP_DAC_READ_SEARCH` + `CAP_KILL`). Run the daemon as root — the systemd unit already does.
:::

::: details Alerts never arrive
Run `protection test-alert`. Each channel reports `✓ delivered` or `✗ <error>`. Common causes: a wrong Discord webhook URL, an SMTP `min_severity` set higher than your test, or an outbound firewall blocking the webhook host.
:::

::: details Too many / too few findings
Start in `dry_run: true` and tune. Raise `cpu_threshold` / `sustained_seconds` for miners, raise `distinct_ports` for port scans, raise `ratio_threshold` for zip bombs. See the [Configuration Reference](../configuration/reference.md).
:::

::: details Architecture not supported
Prebuilt binaries are published for `amd64` and `arm64`. On other architectures, [build from source](#build-from-source).
:::

---

## Upgrade

Re-run the one-line installer — it always pulls the latest release. Your existing `/etc/protection/config.yaml` is left untouched.

```bash
curl -fsSL https://raw.githubusercontent.com/AnAverageBeing/protection/main/install.sh | sudo bash
sudo systemctl restart protection
```

---

## Uninstall

```bash
sudo systemctl disable --now protection
sudo rm -f /etc/systemd/system/protection.service
sudo rm -f /usr/local/bin/protection
sudo rm -rf /etc/protection /var/lib/protection   # also removes quarantined files
sudo systemctl daemon-reload
```

If you installed from source, `make uninstall` removes the binary and unit for you. To keep your config and quarantine for a later reinstall, skip the `rm -rf` line.

---

## Next steps

- **[Quick Start →](./quick-start.md)** — the dry-run → arm workflow.
- **[Configuration Reference →](../configuration/reference.md)** — every value explained.
