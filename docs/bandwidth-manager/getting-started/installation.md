---
title: Installation — Bandwidth Manager
description: Install Bandwidth Manager on any Linux host in under a minute. Automated script, manual from-source build, systemd integration, and troubleshooting.
outline: deep
---

# Installation

Get Bandwidth Manager running on your Docker host in **under a minute**. This guide covers the automated installer, a manual from‑source build, systemd setup, and common pitfalls.

---

## Prerequisites

| Requirement           | Minimum                          | Notes                                                                 |
| --------------------- | -------------------------------- | --------------------------------------------------------------------- |
| **Linux kernel**      | 4.x+                             | `tc` `htb` and `fq_codel` qdiscs must be available. `5.x` recommended. |
| **Docker Engine**     | 20.10+                           | Daemon needs access to the Docker socket (`/var/run/docker.sock`).     |
| **Root access**       | Yes                              | `tc` netlink operations and Docker socket access require `CAP_NET_ADMIN`. |
| **Architecture**      | `amd64` / `arm64`                | Pre‑built binaries for both.                                           |

### Quick Dependency Check

Run these commands to verify your host is ready:

```bash
# Kernel version
uname -r

# tc availability (should print qdisc list or "noqueue")
tc qdisc show 2>/dev/null | head -5

# Docker socket
docker info > /dev/null 2>&1 && echo "Docker OK" || echo "Docker not reachable"
```

If all three pass, you're good to go.

---

## One‑Liner Install

```bash
curl -sSL https://raw.githubusercontent.com/AnAverageBeing/Bandwidth-flow-maintainer/main/install.sh | sudo bash
```

<div class="warning custom-block">

Always inspect scripts before piping them to `sudo`.  
[View the installer source →](https://github.com/AnAverageBeing/Bandwidth-flow-maintainer/blob/main/install.sh)

</div>

---

## What the Installer Does (Step by Step)

The install script runs **7 steps** in sequence. Each step is idempotent — you can re‑run the script safely.

### Step 1 — OS & Kernel Validation

```bash
# Checks /etc/os-release; confirms kernel >= 4.0
# Exits early on unsupported distros or ancient kernels
```

### Step 2 — Dependency Bootstrap

Installs any missing OS packages required for the build or runtime:

```bash
# Debian / Ubuntu
apt-get update && apt-get install -y curl tar iproute2

# RHEL / Fedora / Rocky
dnf install -y curl tar iproute-tc
```

### Step 3 — Binary Download

Fetches the latest release from GitHub, verifies the SHA256 checksum, and extracts:

```bash
curl -sSL "https://github.com/AnAverageBeing/Bandwidth-flow-maintainer/releases/latest/download/bwm_linux_amd64.tar.gz" \
  | sudo tar xz -C /usr/local/bin
```

Installed binaries:

| Binary        | Purpose                               |
| ------------- | ------------------------------------- |
| `bwm-daemon`  | Background service, tc controller     |
| `bwm`         | CLI client for querying and managing  |

### Step 4 — Configuration Directory

```bash
sudo mkdir -p /etc/bwm
sudo chmod 750 /etc/bwm
```

A default config is written to `/etc/bwm/config.yaml` if none exists. See [Configuration →](../configuration.md) for every available option.

### Step 5 — Data Directory

```bash
sudo mkdir -p /var/lib/bwm
sudo chmod 750 /var/lib/bwm
```

The SQLite database (`bandwidth.db`) lives here. Keep this directory backed up if historical stats matter to you.

### Step 6 — Systemd Unit File

A hardened unit is written to `/etc/systemd/system/bwm.service`:

```ini
[Unit]
Description=Bandwidth Manager — Docker traffic control daemon
Documentation=https://github.com/AnAverageBeing/Bandwidth-flow-maintainer
After=docker.service network-online.target
Wants=network-online.target

[Service]
Type=notify
ExecStart=/usr/local/bin/bwm-daemon --config /etc/bwm/config.yaml
Restart=always
RestartSec=5

# Sandbox hardening
ProtectSystem=strict
ReadWritePaths=/var/lib/bwm /run/docker.sock
ProtectHome=true
NoNewPrivileges=true
PrivateTmp=true
CapabilityBoundingSet=CAP_NET_ADMIN CAP_DAC_OVERRIDE

[Install]
WantedBy=multi-user.target
```

Key hardening directives:

| Directive                | Effect                                                        |
| ------------------------ | ------------------------------------------------------------- |
| `ProtectSystem=strict`   | `/usr`, `/boot`, `/etc` are read‑only. Only whitelisted paths are writable. |
| `NoNewPrivileges=true`   | Prevents privilege escalation via `setuid` binaries.           |
| `CapabilityBoundingSet`  | Drops every capability except `CAP_NET_ADMIN` (for `tc`) and `CAP_DAC_OVERRIDE` (for Docker socket). |

### Step 7 — Start & Enable

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now bwm
```

After step 7, the daemon is running and will auto‑start on boot.

---

## Manual Install from Source

Prefer to build from source or need a custom patch? Here's the full build chain.

### Prerequisites

- **Go** 1.21 or later
- **make**
- **gcc** (for SQLite CGo bindings, if applicable)

### Build Steps

```bash
# 1. Clone the repository
git clone https://github.com/AnAverageBeing/Bandwidth-flow-maintainer.git
cd Bandwidth-flow-maintainer

# 2. Build both binaries
make build
# Equivalent to:
# CGO_ENABLED=1 go build -ldflags="-s -w -X main.version=$(git describe --tags)" -o bin/bwm-daemon ./cmd/daemon
# CGO_ENABLED=1 go build -ldflags="-s -w -X main.version=$(git describe --tags)" -o bin/bwm        ./cmd/cli

# 3. Install
sudo cp bin/bwm-daemon /usr/local/bin/
sudo cp bin/bwm        /usr/local/bin/
sudo chmod 755 /usr/local/bin/bwm-daemon /usr/local/bin/bwm
```

### Verify the Build

```bash
bwm version
# Expected output:
# bwm version v1.2.3 (commit: a1b2c3d, built: 2025-06-15T10:30:00Z)
```

### Unit File (Manual)

If you built from source, write the systemd unit yourself:

```bash
sudo tee /etc/systemd/system/bwm.service << 'EOF'
[Unit]
Description=Bandwidth Manager — Docker traffic control daemon
After=docker.service network-online.target
Wants=network-online.target

[Service]
Type=notify
ExecStart=/usr/local/bin/bwm-daemon --config /etc/bwm/config.yaml
Restart=always
RestartSec=5
ProtectSystem=strict
ReadWritePaths=/var/lib/bwm /run/docker.sock
ProtectHome=true
NoNewPrivileges=true
PrivateTmp=true
CapabilityBoundingSet=CAP_NET_ADMIN CAP_DAC_OVERRIDE

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable --now bwm
```

---

## Systemd Service Management

Everyday commands you'll need:

```bash
# Check status
sudo systemctl status bwm

# Follow logs
sudo journalctl -u bwm -f

# Reload after config change
sudo systemctl reload bwm

# Restart
sudo systemctl restart bwm

# Stop
sudo systemctl stop bwm

# Disable auto-start
sudo systemctl disable bwm
```

### Logging

All daemon output goes to the systemd journal. For structured logs, set `log_format: json` in your config:

```bash
# Pretty-print recent JSON logs
sudo journalctl -u bwm --since "5 min ago" -o cat | jq '.'
```

---

## Post‑Install Verification

Run these commands to confirm everything is wired up correctly:

### 1. Daemon Reachable

```bash
bwm ping
```

Expected: `pong` (or `daemon reachable`).

### 2. Service Healthy

```bash
sudo systemctl is-active bwm
```

Expected: `active`.

### 3. Docker Event Hook Working

```bash
bwm status
```

Expected: a table summarising the daemon uptime, tracked containers, and overall bandwidth in/out.

### 4. End‑to‑End Test

Spin up a test container with a label and verify the limit is enforced:

```bash
# Launch a container with a 1 Mbps upload cap
docker run -d --rm \
  --name bwm-test \
  --label bwm.limit.up=1mbps \
  alpine:latest sleep 3600

# Wait 5 seconds for discovery
sleep 5

# Inspect the rules applied to this container
bwm container inspect bwm-test
```

Expected: a `tc class` entry with a 1 Mbps ceiling on the container's veth.

```bash
# Cleanup
docker rm -f bwm-test
```

---

## Troubleshooting

### Go Version Too Old

**Symptom:** `make build` fails with `package slices is not in GOROOT` or similar.

```bash
# Check version
go version
```

**Fix:** Install Go 1.21+:

```bash
# Using the official tarball
curl -sSL https://go.dev/dl/go1.22.5.linux-amd64.tar.gz | sudo tar xz -C /usr/local
export PATH=/usr/local/go/bin:$PATH
```

### Docker Socket Permission Denied

**Symptom:** Daemon logs show `permission denied` when accessing `/var/run/docker.sock`.

**Fix:** Ensure the daemon runs as a user in the `docker` group, or use `root`:

```bash
# Option A: run as root (default with systemd)
sudo systemctl cat bwm | grep User

# Option B: add a dedicated user to the docker group
sudo usermod -aG docker bwm
sudo systemctl restart bwm
```

### `tc` Command Not Found

**Symptom:** Daemon logs show `exec: "tc": executable file not found in $PATH`.

**Fix:** Install `iproute2` (or `iproute` on older distros):

```bash
# Debian / Ubuntu
sudo apt-get install -y iproute2

# RHEL / Fedora
sudo dnf install -y iproute-tc
```

Then restart:

```bash
sudo systemctl restart bwm
```

### `htb` or `fq_codel` Qdisc Missing

**Symptom:** Daemon logs show `RTNETLINK answers: No such file or directory` or `Unknown qdisc "htb"`.

**Fix:** Your kernel was compiled without traffic‑control modules. Verify:

```bash
# Check if tc qdiscs are available
tc qdisc add dev lo root handle 1: htb 2>/dev/null && echo "htb OK" || echo "htb missing"
tc qdisc del dev lo root 2>/dev/null
```

If missing, rebuild your kernel with:

```
CONFIG_NET_SCHED=y
CONFIG_NET_SCH_HTB=y
CONFIG_NET_SCH_FQ_CODEL=y
```

Alternatively, switch to a stock distribution kernel (Ubuntu, Debian, Fedora all ship with these enabled).

### Systemd Unit Fails to Start

**Symptom:** `systemctl status bwm` shows `failed` or `inactive`.

Diagnose step by step:

```bash
# 1. Check the unit file syntax
sudo systemd-analyze verify /etc/systemd/system/bwm.service

# 2. Inspect the last boot log
sudo journalctl -u bwm --boot -e --no-pager

# 3. Run the daemon manually to see raw output
sudo /usr/local/bin/bwm-daemon --config /etc/bwm/config.yaml --debug
```

Common causes:

| Error                                     | Likely Cause                              |
| ----------------------------------------- | ----------------------------------------- |
| `exec format error`                       | Downloaded the wrong architecture binary   |
| `bind: address already in use`            | Another instance is already running        |
| `config file not found`                   | Missing `/etc/bwm/config.yaml`            |
| `failed to create database`               | `/var/lib/bwm` not writable               |

### Containers Not Being Discovered

**Symptom:** `bwm status` shows zero tracked containers despite running containers.

**Fix:** The daemon needs access to the Docker event stream. Verify:

```bash
# Can the daemon reach Docker?
sudo -u bwm docker events --since 1s 2>&1 | head -5

# If that fails, check socket permissions
ls -la /var/run/docker.sock
# Expected: srw-rw---- 1 root docker
```

Add the daemon user to the `docker` group, or set `docker_socket_group: docker` in the config.

---

## Uninstall

To completely remove Bandwidth Manager from the host:

```bash
# 1. Stop and disable the service
sudo systemctl stop bwm
sudo systemctl disable bwm

# 2. Remove the unit file
sudo rm -f /etc/systemd/system/bwm.service
sudo systemctl daemon-reload

# 3. Remove binaries
sudo rm -f /usr/local/bin/bwm-daemon /usr/local/bin/bwm

# 4. (Optional) Remove config and data
sudo rm -rf /etc/bwm /var/lib/bwm
```

<div class="warning custom-block">

Removing `/var/lib/bwm` **deletes all historical stats and quota counters**. Back it up first if you plan to re‑install later.

</div>

### Minimal Cleanup (Preserve Data)

```bash
sudo systemctl stop bwm
sudo systemctl disable bwm
sudo rm -f /etc/systemd/system/bwm.service
sudo rm -f /usr/local/bin/bwm-daemon /usr/local/bin/bwm
```

This leaves `/etc/bwm` and `/var/lib/bwm` intact so a future re‑install picks up the same database and config.

---

## What's Next?

- **[Configuration →](../configuration.md)** — Set up labels, quotas, webhooks, and daemon tuning.
- **[CLI Reference →](../cli.md)** — Explore every command: `bwm container`, `bwm stats`, `bwm quota`.
- **[TUI Guide →](../tui.md)** — Master the interactive terminal dashboard.
- **[GitHub Repo →](https://github.com/AnAverageBeing/Bandwidth-flow-maintainer)** — Star, fork, or open an issue.

