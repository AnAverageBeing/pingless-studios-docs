# Installation

## Prerequisites

- Linux kernel ≥ 5.8 (≥ 5.11 for freplace hot-patching)
- `CONFIG_DEBUG_INFO_BTF=y` in kernel config
- XDP-capable NIC driver
- `clang` ≥ 12, `llvm`, `bpftool`, `libbpf-dev`
- `Go` ≥ 1.21

::: tip Check BTF
```bash
ls /sys/kernel/btf/vmlinux
```
If this file doesn't exist, your kernel was compiled without BTF support. Rebuild with `CONFIG_DEBUG_INFO_BTF=y`.
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
make vmlinux     # Generate vmlinux.h from /sys/kernel/btf/vmlinux (first time only)
make all         # BPF + bpf2go bindings + Go userspace
sudo make install
```

## Verify installation

```bash
openshield version
bpftool prog load /opt/openshield/lib/openshield.bpf.o /sys/fs/bpf/test_verify type xdp
rm /sys/fs/bpf/test_verify
```

Both commands should succeed. The verifier check confirms the BPF program is accepted by your kernel.

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
