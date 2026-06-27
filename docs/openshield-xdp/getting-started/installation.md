# Installation

## Prerequisites

- Linux kernel ≥ 5.15 (recommended ≥ 6.10 for full feature set)
- `CONFIG_DEBUG_INFO_BTF=y` in kernel config
- XDP-capable NIC driver (native mode) or any NIC (generic/skb mode)
- `clang` ≥ 12, `llvm`, `bpftool`, `libbpf-dev`
- `Go` ≥ 1.21

::: tip Check BTF
```bash
ls /sys/kernel/btf/vmlinux
```
If this file doesn't exist, your kernel was compiled without BTF support. Rebuild with `CONFIG_DEBUG_INFO_BTF=y`.
:::

::: info Kernel feature gates
OpenShield-XDP automatically detects available kernel features at load time and silently disables features your kernel doesn't support. For example:
- **Bloom filter maps** require kernel 5.16+ — if unavailable, the LRU hashmap whitelist is used instead
- **freplace** requires kernel 5.15+ — if unavailable, all BPF logic runs in the main program (no hot-patching)
- **BPF timers** require kernel 5.15+ — connection tracking uses a simpler mechanism without them

Run `openshield status` after loading to see which features are active on your kernel.
:::

## One-liner install

```bash
curl -fsSL https://raw.githubusercontent.com/AnAverageBeing/OpenShield-XDP/main/install-online.sh | sudo bash
```

Choose **Install / Update** from the menu. The installer auto-detects your package manager, installs dependencies, compiles BPF and Go, generates config, and sets up systemd.

## Automated install (from clone)

```bash
git clone https://github.com/AnAverageBeing/OpenShield-XDP.git
cd OpenShield-XDP
sudo ./install.sh
```

The installer auto-detects your package manager (apt, dnf, yum, pacman, apk, zypper), installs missing dependencies, compiles BPF and Go binaries, generates a default config, and sets up the systemd service. It runs `openshield fix` as a post-install step to clean any stale state.

## Manual build

```bash
# vmlinux.h is auto-generated from /sys/kernel/btf/vmlinux (first time only)
make vmlinux
# Build BPF + bpf2go bindings + Go userspace
make all
# Install binaries, config, systemd
sudo make install
```

::: tip vmlinux.h auto-generation
The `make vmlinux` step runs `bpftool btf dump file /sys/kernel/btf/vmlinux format c > ebpf/headers/vmlinux.h` to generate a type header matching your *running* kernel. This ensures the BPF program is compiled against your exact kernel's data structures — no kernel headers package needed.
:::

## Verify installation

```bash
openshield version
# Verify the BPF program is accepted by your kernel's verifier
bpftool prog load /opt/openshield/lib/openshield.bpf.o /sys/fs/bpf/test_verify type xdp
rm /sys/fs/bpf/test_verify
```

Both commands should succeed. The verifier check confirms the BPF program passes your kernel's BPF verifier.

## Update

```bash
cd OpenShield-XDP
git pull
sudo ./install.sh --update
```

::: warning
The `--update` flag stops the running loader, replaces binaries and BPF object, then restarts. Existing bans survive across updates (pinned maps).
:::

## Uninstall

```bash
sudo ./install.sh --uninstall
```

Removes binaries, systemd service, BPF pins, and socket files. Optionally preserves config and logs.

## Supported operating systems

| OS | Package manager |
|----|----------------|
| Ubuntu 22.04+ | apt |
| Debian 12+ | apt |
| Fedora 38+ | dnf |
| RHEL 9 / Rocky / Alma | dnf / yum |
| Arch Linux | pacman |
| Alpine Linux | apk |
| openSUSE | zypper |

## Next steps

- [Quick Start](/openshield-xdp/getting-started/quick-start) — load in under 30 seconds
- [Configuration](/openshield-xdp/user-guide/configuration) — understand every YAML field
