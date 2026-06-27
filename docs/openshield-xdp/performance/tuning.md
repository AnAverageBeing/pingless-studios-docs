# Performance Tuning

System-level tuning for maximum OpenShield-XDP throughput. These optimizations complement the application-level optimizations documented in [Performance Optimizations](./optimizations).

## NIC Tuning via ethtool

### Adaptive RX/TX Coalescing

Reduce interrupt frequency to batch-process more packets per NAPI poll cycle:

```bash
# Disable adaptive coalescing and set fixed values
ethtool -C <interface> adaptive-rx off adaptive-tx off
ethtool -C <interface> rx-usecs 16 rx-frames 64
ethtool -C <interface> tx-usecs 16 tx-frames 64
```

| Parameter | Low Value | High Value | Recommendation |
|-----------|-----------|------------|----------------|
| `rx-usecs` | 1 (low latency) | 100 (low CPU) | 16–32 for XDP |
| `rx-frames` | 1 | 256 | 64–128 |
| `adaptive-rx` | N/A | N/A | **off** — XDP needs predictable timing |

### IRQ Affinity

Pin NIC IRQs to specific CPU cores to prevent interrupt migration:

```bash
# Show current IRQ affinity
cat /proc/interrupts | grep <interface>

# Pin IRQ 123 to CPU 0-3
echo 0-3 > /proc/irq/123/smp_affinity_list

# Or use a script to distribute across NUMA-local cores
# (example for a 4-queue NIC)
for i in $(seq 0 3); do
    irq=$(grep "<interface>-TxRx-$i" /proc/interrupts | awk -F: '{print $1}')
    echo $i > /proc/irq/$irq/smp_affinity_list
done
```

::: tip NUMA Awareness
Pin NIC IRQs to cores on the same NUMA node as the NIC's PCIe slot. Use `lstopo` (hwloc) to visualize PCIe-to-NUMA topology.
:::

### Ring Buffer Sizes

Increase NIC ring buffer sizes to handle bursts:

```bash
# Check current sizes
ethtool -g <interface>

# Set to maximum
ethtool -G <interface> rx 4096 tx 4096
```

Larger rings reduce drops during traffic bursts at the cost of slightly higher memory usage (~16 KB per ring at 4096 descriptors with 4-byte descriptors).

### Offload Features

Disable unnecessary hardware offloads that interfere with XDP:

```bash
# Disable LRO (Large Receive Offload) — incompatible with XDP
ethtool -K <interface> lro off

# Disable GRO (Generic Receive Offload) if XDP processing is primary
ethtool -K <interface> gro off

# Keep TSO/GSO for TX if needed
ethtool -K <interface> tso on gso on
```

## XDP Mode Selection

OpenShield supports three XDP attachment modes, ordered by performance:

| Mode | Performance | Requirements | Use Case |
|------|-------------|-------------|----------|
| **native** | Best | NIC driver with native XDP support (e.g., mlx5, i40e, ice, bnxt_en) | Production, high throughput |
| **generic** | Moderate (~2× slower) | Any NIC, kernel ≥ 5.15 | Development, VMs, cloud |
| **offload** | Best (NIC-dependent) | SmartNIC with XDP offload (e.g., Netronome) | Specialized hardware |

```yaml
# In /etc/openshield/openshield.yaml:
xdp_mode: auto   # auto: tries native first, falls back to generic
```

::: warning
`xdp_mode: generic` processes packets **after** SKB allocation — you lose the zero-copy advantage of XDP. Only use it for development or when native mode is unavailable. Performance drops by ~50% in generic mode.
:::

### Checking Mode Compatibility

```bash
# Check if your NIC driver supports native XDP
ethtool -i <interface> | grep driver

# Known native XDP drivers:
# mlx5_core, i40e, ice, ixgbe, bnxt_en, nfp, netsec, qede, 
# stmmac, thunderx, virtio_net (kernel ≥ 5.15)

# Check current XDP attachment
ip link show <interface> | grep xdp
```

## Map Sizing Tradeoffs

Map sizes directly affect memory usage and lookup performance:

| Map | Default | Memory (approx) | Tradeoff |
|-----|---------|-----------------|----------|
| `ip_stats_max` | 100,000 | ~40 MB | Larger = more IPs tracked, slower LRU eviction |
| `ban_max` | 50,000 | ~20 MB | Larger = more simultaneous bans, more memory |
| `whitelist_max` | 10,000 | ~4 MB | Larger = more trusted IPs |
| `event_buffer_size` | 262,144 | 256 KB | Larger = fewer dropped events under load |
| `bloom_filter_size` | 150,000 | ~1.2 MB | Larger = lower false positive rate, more memory |

**Guidelines**:
- For 10 Gbps links, defaults are sufficient
- For 40/100 Gbps, consider increasing `ip_stats_max` to 250K–500K
- Memory is pre-allocated at map creation; unused entries don't save memory
- LRU_HASH overhead is ~30% above raw entry size

## Kernel Version Recommendations

Newer kernels provide significant BPF performance improvements:

| Kernel Version | BPF Improvement |
|---------------|-----------------|
| 5.15 | XDP generic mode stable, BPF timers, `bpf_loop()` helper |
| 5.16 | Bloom filter map type, `bpf_find_vma()` |
| 5.19 | BPF link for XDP, improved verifier |
| 6.0 | `bpf_ktime_get_tai_ns()`, improved JIT |
| 6.5 | `bpf_cpumask`, improved ring buffer |
| 6.10 | L7 multisig support, improved map operations |

**Recommendation**: Run kernel ≥ 6.1 LTS for production. Kernel 6.6+ LTS provides the best BPF JIT quality and verifier speed.

## System-Level Tuning

### CPU Frequency Governor

Set to `performance` to avoid frequency scaling latency:

```bash
echo performance | sudo tee /sys/devices/system/cpu/cpu*/cpufreq/scaling_governor
```

### Disable C-States (optional, for latency-sensitive workloads)

```bash
# Maximum performance, higher power consumption
echo 1 > /sys/devices/system/cpu/cpu*/cpuidle/state*/disable
```

### Increase BPF JIT Memory Limit

```bash
# Allow larger BPF programs (default 2 MB, increase to 16 MB)
echo 16777216 > /proc/sys/net/core/bpf_jit_limit
```

### Huge Pages for BPF Maps

BPF maps are allocated from kernel memory. Enabling transparent huge pages can improve map lookup performance for large maps:

```bash
echo always > /sys/kernel/mm/transparent_hugepage/enabled
```

## Quick Reference: Full Tuning Script

```bash
#!/bin/bash
# Quick performance tuning for OpenShield-XDP
IFACE="eno1"  # Change to your interface

# NIC settings
ethtool -C $IFACE adaptive-rx off adaptive-tx off
ethtool -C $IFACE rx-usecs 16 rx-frames 64
ethtool -G $IFACE rx 4096 tx 4096
ethtool -K $IFACE lro off gro off

# CPU governor
echo performance | tee /sys/devices/system/cpu/cpu*/cpufreq/scaling_governor > /dev/null

# BPF JIT limit
echo 16777216 > /proc/sys/net/core/bpf_jit_limit

echo "Tuning applied to $IFACE"
echo "Run: sudo openshield load  # Restart OpenShield"
```

## Related Pages

- [Performance Overview](./overview) — Design targets and measurement
- [Performance Optimizations](./optimizations) — Application-level optimization techniques
- [Getting Started](/openshield-xdp/getting-started/overview) — First-time setup
