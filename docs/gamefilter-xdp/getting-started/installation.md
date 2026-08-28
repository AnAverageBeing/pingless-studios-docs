---
title: Installation
description: Install GameFilter XDP from the release package — prerequisites, interactive install steps, post-install verification, troubleshooting, and uninstall.
---

# Installation

> **Get GameFilter XDP validating game traffic in a few minutes.**
> The release package ships pre-built binaries — no Rust toolchain, no build
> tools, nothing else to install. Root and a 5.15+ kernel with BTF are all
> you need.

[[toc]]

---

## Prerequisites

| Requirement | Minimum | Check |
| ----------- | ------- | ----- |
| Kernel | Linux **5.15+** | `uname -r` |
| Kernel BTF | `CONFIG_DEBUG_INFO_BTF=y` | `ls /sys/kernel/btf/vmlinux` |
| Privileges | root | `id -u` → `0` |
| Topology | VM bridge (`vmbr0` / `br0`) or **private NIC** behind OpenShield | `ip link` |

The release package has **no other dependencies** — the XDP object
(`gamefilter-ebpf.o`) and the userspace binary (`gamefilter`) are pre-built.

::: warning BTF is not optional
The eBPF program is a CO-RE object and requires kernel BTF. If
`/sys/kernel/btf/vmlinux` does not exist, the installer stops immediately.
Virtually all modern distro kernels (Ubuntu 22.04+, Debian 12+, Fedora, Arch,
Rocky/Alma 9+, Proxmox VE 7/8+) ship BTF enabled.
:::

::: tip OpenShield + GameFilter on the Same Host
Because Linux allows only one native XDP program per interface, run [OpenShield-XDP](/openshield-xdp/) on your physical uplink (`eno1`) to absorb raw DDoS floods, and attach GameFilter to your internal VM bridge (`vmbr0` / `br0`) in `mode: dedicated`.
:::

---

## Install Steps

Extract the release package and run the installer as root:

```bash
unzip gamefilter-xdp-*.zip
cd gamefilter-xdp-*
sudo ./install.sh
```

The installer auto-detects your environment (Proxmox VE / Dedicated Bare Metal / KVM / VPS), checks kernel BTF, and guides you through 4 steps:

### Step 1/4 — Network Interface

The installer lists all interfaces and highlights the recommended private interface or VM bridge (e.g. `vmbr0` on Proxmox).

### Step 2/4 — Deployment Mode

Choose how GameFilter inspects traffic on the interface:
- **`dedicated` (Multi-Tenant / Proxmox):** ONLY enrolled tenant destination IPs are inspected. All other destination IPs on the bridge bypass filtering with `XDP_PASS` (100% safe for web, DB, and general guest VPSes).
- **`vps` (Single VPS / Standalone):** Protects all destination IPs arriving on this interface.

If `dedicated` is chosen, you can enter initial protected tenant IPs or enroll them later via API.

### Step 3/4 — Default Action

- `pass` (Recommended for dedicated / mixed-use hosts): Ports not matching any filter on filtered IPs pass normally.
- `drop` (Strict shield for dedicated game interfaces): Drops unmatched ports.

### Step 4/4 — Management API

Enables the token-authenticated REST API on `127.0.0.1:9300` and generates an API key.

---

## Verification

Check that the filter is loaded:

```bash
sudo gamefilter status
```

```
GameFilter XDP is loaded.
  Interface: vmbr0 (native)  |  Mode: dedicated
  Packets: 48212 passed, 140023 dropped | validated ok 340 fail 139800 | admitted 47872 | banned 5
  Protected Tenants (2):
    • 10.210.0.2 (Minecraft VPS)
    • 10.210.0.3 (FiveM VPS)
  [ 0] mc-java        tcp ports=25565              pass=12000 drop=0
  [ 1] mc-bedrock     udp ports=19132              pass=8200  drop=140023
  [ 2] fivem          udp ports=30120              pass=28000 drop=0
```

Verify the API daemon:

```bash
sudo gamefilter key
# prints API URL and key
```

---

## Troubleshooting

### `Error: failed to attach XDP: Operation not supported`
Your NIC or bridge driver does not support native XDP (`DRV_MODE`). The loader automatically falls back to generic XDP (`SKB_MODE`).

### `Non-game VPS traffic broken on Proxmox`
Make sure you are running `mode: dedicated` in `/etc/gamefilter/gamefilter.yaml`. In `dedicated` mode, un-enrolled VPS IPs bypass filtering completely.

---

## Uninstall

```bash
sudo ./uninstall.sh          # keep configuration
sudo ./uninstall.sh --purge  # remove binaries, systemd units, and /etc/gamefilter
```
