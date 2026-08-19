---
title: Installation
description: Install LiteShield XDP with the interactive installer or manually — prerequisites, verification, troubleshooting, and uninstall.
---

# Installation

> **Get LiteShield XDP protecting your interface in under a minute.**
> The installer builds from source, so it works on any distro with a supported
> package manager — no prebuilt binaries to trust.

[[toc]]

---

## Prerequisites

| Requirement | Minimum | Check |
| ----------- | ------- | ----- |
| Kernel | Linux **5.15+** (RHEL 9-family 5.14 proceeds with a warning — see below) | `uname -r` |
| Kernel BTF | `CONFIG_DEBUG_INFO_BTF=y` | `ls /sys/kernel/btf/vmlinux` |
| Go | **1.22+** | `go version` |
| Build tools | `clang`, `llvm-strip`, `bpftool`, `make` | `command -v clang` |
| Privileges | root | `id -u` → `0` |

::: tip Don't have the build tools?
The installer detects missing dependencies and installs them automatically via
your package manager — `apt`, `dnf`, `yum`, `pacman`, `apk`, and `zypper` are
all supported. You only need root and a 5.15+ kernel with BTF.
:::

::: details RHEL 9 family (AlmaLinux / Rocky / RHEL / CentOS Stream 9) — kernel 5.14
These distros ship a **5.14** kernel (e.g. `5.14.0-687.5.3.el9_8`) that sits
below the tested 5.15 floor — but Red Hat backports the BPF features
LiteShield needs (BTF, bounded loops, map spinlocks, LRU/LPM maps, tail
calls), so it usually works. The installer detects the `el9` suffix in the
kernel's own release string (never the distro ID) and **continues with a
warning** instead of refusing. This is an untested configuration; any other
kernel below 5.15 is still refused. If the verifier rejects the program at
load time, move to a mainline kernel from **ELRepo**:

```bash
sudo dnf install -y https://www.elrepo.org/elrepo-release-9.el9.elrepo.noarch.rpm
sudo dnf --enablerepo=elrepo-kernel install -y kernel-ml
sudo reboot   # boot into the new kernel, then run the installer
```
:::

::: warning BTF is not optional
LiteShield builds a CO-RE eBPF object, which requires kernel BTF. If
`/sys/kernel/btf/vmlinux` does not exist, the installer stops immediately.
Virtually all modern distro kernels (Ubuntu 22.04+, Debian 12+, Fedora, Arch,
Rocky/Alma 9+) ship BTF enabled.
:::

---

## Interactive Install

```bash
curl -fsSL https://raw.githubusercontent.com/AnAverageBeing/LiteShield-XDP/main/install.sh | sudo bash
```

The installer runs four steps after pre-flight checks (kernel version, BTF,
package manager, build tools):

### Step 1/4 — Network interface

```
[*] Step 1/4 — Network interface
    Available interfaces:
      - eth0             (up)
      - ens18            (up)
      - docker0          (down)
[?] Interface to protect [eth0]:
```

Auto-detected from your default route. Press Enter to accept, or type another
interface name.

### Step 2/4 — Deployment preset

```
[?] Preset (base thresholds):
    1) Personal
    2) Hosting
    3) Enterprise
[?] Choose [Hosting]:
```

| Preset | Intended for | Base PPS |
| ------ | ------------ | -------- |
| **Personal** | Home server behind a residential line | 50,000 |
| **Hosting** | VPS / shared hosting with moderate traffic | 200,000 |
| **Enterprise** | Dedicated server / high-traffic edge | 1,000,000 |

### Step 3/4 — Traffic profile

```
[?] Traffic type (scales the preset):
    1) Strict
    2) Balanced
    3) High
[?] Choose [Balanced]:
```

The profile multiplies the preset's base rates: **Strict = 0.5×**, **Balanced
= 1.0×**, **High = 2.0×**. The installer prints the effective thresholds so
you can confirm before anything is written:

```
[*] Effective thresholds (Hosting / Balanced):
    pps=200000 syn=2000 udp=10000 icmp=500 new_src=500 flow_pps=20000 flow_bps=20000000
```

### Step 4/4 — Discord alerts (optional)

```
[?] Enable Discord webhook alerts? [y/N]: y
[?] Discord webhook URL: https://discord.com/api/webhooks/...
[?] Alert on rule_trigger (rate-limit violations)? [Y/n]: y
[?] Alert on ip_banned? [Y/n]: y
[?] Alert on new_source (new-IP flood)? [Y/n]: y
```

The URL is validated against the Discord webhook format before continuing.
Leave this off if you don't want alerts — you can add a webhook later with
`liteshield config`.

### What happens next

The installer then:

1. Fetches the source (when piped via `curl`) into a temp directory
2. Builds `ebpf/liteshield.bpf.o` and `bin/liteshield` with `make all`
3. Installs to `/opt/liteshield` and symlinks `/usr/local/bin/liteshield`
4. Writes `/etc/liteshield/liteshield.yaml` (mode `0600`) from your answers
5. Installs and offers to enable `liteshield-loader.service`

::: info Existing config is preserved
On reinstall, your current `liteshield.yaml` is backed up to
`liteshield.yaml.bak` before the new one is written.
:::

---

## Manual Install

For full control (or non-interactive environments):

```bash
git clone https://github.com/AnAverageBeing/LiteShield-XDP
cd LiteShield-XDP

# Build the BPF object and the Go binary
make all

# Optional: run the BPF object through the kernel verifier
make verify

# Install
sudo install -d /opt/liteshield /etc/liteshield
sudo install -m 0755 bin/liteshield /opt/liteshield/liteshield
sudo install -m 0644 ebpf/liteshield.bpf.o /opt/liteshield/liteshield.bpf.o
sudo ln -sf /opt/liteshield/liteshield /usr/local/bin/liteshield

# Config: start from the example
sudo cp configs/liteshield.example.yaml /etc/liteshield/liteshield.yaml
sudo chmod 600 /etc/liteshield/liteshield.yaml
sudo $EDITOR /etc/liteshield/liteshield.yaml   # set interface + thresholds

# systemd (optional)
sudo install -m 0644 systemd/liteshield-loader.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now liteshield-loader.service
```

---

## Post-Install Verification

```bash
# Service state (if you enabled systemd)
systemctl status liteshield-loader.service

# Counters snapshot — should show "LiteShield XDP is loaded."
sudo liteshield status
```

```
$ sudo liteshield status
LiteShield XDP is loaded.
  Packets: 104213 rx (104198 passed, 15 dropped)
  Rule drops: SYN 0 | UDP 12 | ICMP 3 | PPS 0 | NewSrc 0 | Ban 0
  Lists: whitelist hits 0 | blacklist hits 0 | active bans 0
```

You can also confirm the XDP program is attached at the kernel level:

```bash
ip link show dev eth0 | grep xdp
# → prog/xdp id 42 ... (native mode shows "xdp", generic shows "xdpgeneric")
```

::: tip Try the live screen
Run `sudo liteshield load` in a spare terminal to watch throughput, drops,
and bans in real time. Quitting with `Ctrl-C` leaves the firewall running.
:::

---

## Troubleshooting

| Symptom | Cause | Fix |
| ------- | ----- | --- |
| `Kernel X is too old` | Kernel < 5.15 | Upgrade the kernel (Ubuntu 22.04+ / Debian 12+ are fine) |
| `/sys/kernel/btf/vmlinux not found` | Kernel built without BTF | Use a stock distro kernel; custom kernels need `CONFIG_DEBUG_INFO_BTF=y` |
| `llvm-strip is still missing` | Versioned binary on Debian/Ubuntu | `sudo ln -sf $(command -v llvm-strip-14) /usr/local/bin/llvm-strip` (installer does this automatically) |
| `bpftool not found` on Ubuntu | `linux-tools-common` lacks a match for the running kernel | Install `linux-tools-$(uname -r)`; the installer falls back to this automatically |
| `Go >= 1.22 required` | Old `golang-go` package | Install newer Go from [go.dev](https://go.dev/dl/) and re-run |
| `liteshield status` says NOT loaded after boot | Service not enabled | `sudo systemctl enable --now liteshield-loader.service` |
| XDP attaches in generic mode unexpectedly | NIC driver lacks native XDP | Harmless — `xdp_mode: auto` falls back. Native-capable drivers: `ixgbe`, `i40e`, `mlx5`, `virtio_net`, … |

::: warning Generic mode is slower
Generic (SKB) XDP still drops floods before conntrack and your applications,
but runs later than driver mode. Check the attach mode in the TUI header or
`ip link` output if performance matters.
:::

---

## Uninstall

```bash
sudo bash uninstall.sh           # removes binary, service, BPF pins — keeps /etc/liteshield
sudo bash uninstall.sh --purge   # also removes the config directory
```

The uninstaller stops `liteshield-loader.service`, detaches the XDP program,
removes `/sys/fs/bpf/liteshield`, `/opt/liteshield`, and the
`/usr/local/bin/liteshield` symlink. Without `--purge`, your config survives
for a later reinstall.
