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
