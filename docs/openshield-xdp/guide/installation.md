# Installation

## Supported Systems

| OS | Package Managers |
|----|-----------------|
| Ubuntu 22.04+ | apt |
| Debian 12+ | apt |
| Fedora 38+ | dnf |
| RHEL 9+ / Rocky / Alma | dnf / yum |
| Arch Linux | pacman |
| Alpine Linux | apk |
| openSUSE | zypper |

## Automated Install

```bash
git clone https://github.com/AnAverageBeing/OpenShield-XDP.git
cd OpenShield-XDP
sudo ./install.sh
```

Installs clang, llvm, bpftool, libbpf, Go (if missing), compiles BPF + Go, generates config, sets up systemd service. Runs `openshield fix` as a post-install step.

## Manual Build

```bash
make vmlinux     # Generate vmlinux.h from /sys/kernel/btf/vmlinux (first time)
make all         # BPF + bpf2go bindings + Go userspace
sudo make install
```

## Update

```bash
git pull
sudo ./install.sh --update
```

## Uninstall

```bash
sudo ./install.sh --uninstall
```

## Prerequisites

- Linux kernel ≥ 5.8 (≥ 5.11 for freplace)
- `CONFIG_DEBUG_INFO_BTF=y`
- XDP-capable NIC driver
