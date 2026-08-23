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
| Topology | A **private NIC** between your edge firewall and the game servers | `ip link` |

The release package has **no other dependencies** — the XDP object
(`gamefilter-ebpf.o`) and the userspace binary (`gamefilter`) are pre-built.

::: warning BTF is not optional
The eBPF program is a CO-RE object and requires kernel BTF. If
`/sys/kernel/btf/vmlinux` does not exist, the installer stops immediately.
Virtually all modern distro kernels (Ubuntu 22.04+, Debian 12+, Fedora, Arch,
Rocky/Alma 9+) ship BTF enabled.
:::

::: danger GameFilter goes on the PRIVATE interface
GameFilter is designed to sit **behind** your edge firewall, on the NIC that
faces your game servers — with `default_action: drop`, anything that matches
no filter is dropped. If you attach it to the interface you manage the machine
through without an `ssh` filter or a whitelist entry for your admin IP, you
can lock yourself out.
:::

---

## Install Steps

Extract the release package and run the installer as root:

```bash
tar xf gamefilter-xdp-*.tar.gz   # or unzip the release zip
cd gamefilter-xdp-*
sudo ./install.sh
```

The installer works on Debian/Ubuntu (apt), Fedora/RHEL (dnf/yum), Arch
(pacman), Alpine (apk), and openSUSE (zypper) — with a release package it
needs none of them, but it will happily build from source instead if you run
it from a source checkout (nightly Rust + `rust-src` + `bpf-linker` required
in that case).

After pre-flight checks (kernel version, BTF), it asks three questions:

### Step 1/3 — Private interface

```
[*] Step 1/3 — Private interface
    GameFilter sits on the PRIVATE NIC (between the edge firewall and
    your game servers), not the public one.
    Available interfaces:
      ▸ eth0             (up)
      ▸ eth1             (up)
[?] Interface to filter (the private one) [eth1]:
```

Auto-detected from your default route — **check that the guess is actually
your private NIC** before pressing Enter.

### Step 2/3 — Filters & default action

```
[!] default_action: drop blocks EVERYTHING that matches no filter.
[!] Make sure the ssh filter (or your admin IP in whitelist) is in place
[!] if you manage this machine through the filtered interface.
[?] Keep default_action: drop (recommended for a dedicated game NIC)? [Y/n]:
```

The shipped config already includes filters for `mc-java` (25565),
`mc-bedrock` (19132), `geyser` (19133), `fivem` (30120),
`source-engine` (27015-27050), and `ssh` (22). `drop` is the recommended
posture for a dedicated game NIC; choose `pass` if other services share the
interface.

### Step 3/3 — Management API

```
[?] Enable the HTTP management API? [Y/n]:
[?] Listen address (127.0.0.1 = local only) [127.0.0.1:9300]:
```

The installer generates a random API key (`gf_` + 32 hex chars), writes it
into the config, and prints it at the end. Everything — stats, lists, config —
goes through this API (no TUI by design), so keep it enabled unless you have
a reason not to. Keep the listen address on `127.0.0.1` unless you also set
[`api.whitelist`](../configuration/reference#api-whitelist).

Finally it asks whether to enable and start the systemd services
(`gamefilter-loader.service`, and `gamefilter-api.service` if the API is on).

### What gets installed

| Path | Contents |
| ---- | -------- |
| `/opt/gamefilter/gamefilter` | Userspace binary (symlinked to `/usr/local/bin/gamefilter`) |
| `/opt/gamefilter/gamefilter-ebpf.o` | Pre-built XDP object |
| `/etc/gamefilter/gamefilter.yaml` | Configuration (`chmod 600`; an existing file is backed up to `.bak`) |
| `/var/lib/gamefilter/state.json` | Load-time state snapshot (interface, mode, filter table) |
| `/etc/systemd/system/gamefilter-loader.service` | Oneshot unit: `gamefilter load` / `unload` |
| `/etc/systemd/system/gamefilter-api.service` | Resident daemon: HTTP API + OpenShield sync |

---

## Verification

```bash
sudo gamefilter status
```

```
GameFilter XDP is loaded.
  Interface: eth1 (native)
  Packets: 128412 passed, 9033 dropped | validated ok 4210 fail 8801 | admitted 120244 | banned 17
  [ 0] mc-java        tcp ports=25565              pass=52100 drop=1200
  [ 1] mc-bedrock     udp ports=19132              pass=61302 drop=7715
  [ 2] source-engine  udp ports=27015-27050        pass=15010 drop=118
```

Check the systemd units and the API:

```bash
systemctl status gamefilter-loader.service gamefilter-api.service
sudo gamefilter key    # prints the API URL + key and a ready-to-paste curl
curl -H "Authorization: Bearer <key>" http://127.0.0.1:9300/health
```

```json
{"status":"ok","generated_at":1755931200,"version":"1.0.0","api_uptime_seconds":312,"loaded":true}
```

A quick end-to-end proof: ping a Bedrock filter port with a crafted RakNet
unconnected ping and watch `validated_ok` increment, then send random bytes
and watch `validated_fail` (and eventually `banned`) increment.

---

## Troubleshooting

### The loader fails with a verifier or load error

```bash
journalctl -u gamefilter-loader.service -n 50
sudo gamefilter load    # run in the foreground for the full error
```

- **`Kernel BTF not found`** — your kernel lacks `CONFIG_DEBUG_INFO_BTF`.
  Switch to a distro/mainline kernel that ships it.
- **Verifier rejection on load** — the object targets kernel 5.15+; report
  the full log if a supported kernel rejects it.
- **Native attach failed** — the loader automatically falls back to generic
  (SKB) mode; `gamefilter status` shows the mode next to the interface.
  Generic mode is slower but fully functional.

### Legit players are being dropped (false drops)

1. Find the offending filter in `sudo gamefilter status` (its
   `validated_fail` counter climbs while players connect).
2. Check the size bounds against the project's
   `docs/protocol-research.md` — the most common cause is a `max_size`
   that is too tight for your setup (e.g. modded servers, proxies in front).
3. Widen the filter: raise `max_size`, lower `min_size`, and if the
   validator itself is too strict for your traffic (the `fivem` ENet CONNECT
   check is UNVERIFIED upstream), switch that port to `udp_generic` and keep
   the size bounds tight.
4. `sudo gamefilter reload` to hot-apply — no detach, no protection gap.

::: tip Soften the punishment while you tune
Set `ban_sec: 0` (never ban, just drop) or raise `max_failures` on the filter
you are tuning, so a mis-tuned validator drops individual packets instead of
temp-banning real players.
:::

### Locked out after enabling `default_action: drop`

Attach over a console/IPMI, then either add your admin IP
(`sudo gamefilter whitelist add <your-ip>` and keep it in the config
`whitelist:` so it survives reloads) or flip `default_action: pass` and
`sudo gamefilter reload`.

### `gamefilter status` says "NOT loaded"

The pinned link at `/sys/fs/bpf/gamefilter/link` is missing — the loader
service is down or the attach failed. Check
`journalctl -u gamefilter-loader.service`, then `sudo gamefilter load`.

---

## Uninstall

```bash
sudo ./uninstall.sh           # stops services, detaches XDP, removes binaries
sudo ./uninstall.sh --purge   # also removes /etc/gamefilter and /var/lib/gamefilter
```

The uninstaller disables and removes both systemd units, unloads the XDP
program (removing `/sys/fs/bpf/gamefilter` and the state file), and deletes
`/opt/gamefilter` and `/usr/local/bin/gamefilter`. Without `--purge`, your
config and state are kept for a later reinstall.
