# BPF Development Patterns

Common BPF patterns used throughout the OpenShield-XDP codebase. These patterns satisfy the Linux BPF verifier while maintaining performance.

## Loop Unrolling with `#pragma unroll`

The verifier requires all loops to have compile-time bounds. Use `#pragma unroll` when the iteration count is known:

```c
// UDP amplification check — iterate 8 known ports
#pragma unroll
for (int i = 0; i < 8; i++) {
    u16 port = cfg->amp_ports[i];
    if (port == 0)
        continue;
    if (udp->source == bpf_htons(port)) {
        // Check amplification
    }
}
```

For dynamic bounds, pre-validate against a constant ceiling:

```c
// Bounded loop: count is dynamic but capped
u32 count = *(u32 *)(data + offset);
if (count > 16)  // verifier sees the bound
    return XDP_DROP;

#pragma unroll
for (int i = 0; i < 16; i++) {
    if (i >= count) break;
    // process element i
}
```

## PERCPU Counters Pattern

Per-CPU maps eliminate lock contention by giving each CPU its own counter region. Userspace aggregates by summing across all CPUs.

```c
// Definition in maps.h
struct {
    __uint(type, BPF_MAP_TYPE_PERCPU_ARRAY);
    __type(key, u32);
    __type(value, struct global_stats);
    __uint(max_entries, 1);
} global_stats_map SEC(".maps");

// Usage in BPF — no lock needed
u32 key = 0;
struct global_stats *gs = bpf_map_lookup_elem(&global_stats_map, &key);
if (!gs) return XDP_PASS;
gs->total_packets++;  // Per-CPU: no contention
```

**Userspace aggregation** (Go):

```go
func (c *Collector) readGlobalStats() (GlobalStats, error) {
    var total GlobalStats
    var values []GlobalStats
    err := c.maps.GlobalStatsMap.Lookup(&key, &values)  // PERCPU lookup
    for _, v := range values {
        total.Packets += v.Packets
        total.Bytes += v.Bytes
        // ...
    }
    return total, nil
}
```

## `BPF_NOEXIST` for New Entries

Use `BPF_NOEXIST` when inserting entries that must not already exist:

```c
// Connection tracking: insert new flow
struct ct_entry entry = {
    .src_ip = info->src_ip,
    .dst_ip = info->dst_ip,
    .sport = info->src_port,
    .dport = info->dst_port,
    .state = CT_SYN_SENT,
    .timestamp = bpf_ktime_get_ns(),
};

long ret = bpf_map_update_elem(&ct_map, &key, &entry, BPF_NOEXIST);
if (ret == -EEXIST) {
    // Entry already exists — update it with BPF_EXIST instead
}
```

## `void *bpf_map_lookup_elem` + Bounds Check

The verifier requires explicit null-check on map lookup results before access:

```c
// Config is an ARRAY map — always present for key 0, but still check
u32 key0 = 0;
const struct config *cfg = bpf_map_lookup_elem(&config_map, &key0);
if (!cfg) {
    return XDP_PASS;  // Should never happen for ARRAY maps
}

// Per-IP stats — may or may not exist
struct ip_stats *stats = bpf_map_lookup_elem(&ip_stats_map, &ip_key);
if (!stats) {
    // First packet from this IP — allocate entry
    // (or skip check if too many entries)
    return XDP_PASS;
}
// stats->packets is now verifier-validated
```

## `bpf_spin_lock` for Global Counters

When multiple CPUs must update a shared counter (e.g., total PPS across all CPUs for a single attack detection threshold):

```c
struct global_stats {
    struct bpf_spin_lock lock;
    u64 total_packets;
    u64 total_bytes;
};

// Write path — acquire lock
struct global_stats *gs = bpf_map_lookup_elem(&global_stats_map, &key);
if (!gs) return;
bpf_spin_lock(&gs->lock);
gs->total_packets += len;
bpf_spin_unlock(&gs->lock);
```

::: warning
Spin locks in BPF are **very expensive**. Prefer PERCPU maps for all per-packet counters. Use `bpf_spin_lock` only for global aggregations that are read infrequently (e.g., panic coordination every second).
:::

## Ring Buffer Event Emission

Events (bans, threshold violations) are emitted to userspace via the ring buffer:

```c
// Define event structure (must be 8-byte aligned)
struct event {
    u32 type;        // Event type enum
    u32 severity;    // Severity level
    u32 src_ip;      // Source IP (network byte order)
    u32 value;       // Numeric value (score, pps, etc.)
    u8  reason[32];  // Human-readable reason string
};

// Emit an event
struct event *ev = bpf_ringbuf_reserve(&events_map, sizeof(*ev), 0);
if (!ev) {
    // Ring buffer full — event dropped
    return;
}
ev->type = EVENT_BAN_TRIGGERED;
ev->src_ip = info->src_ip;
ev->value = score;
__builtin_memcpy(ev->reason, "pps_threshold", 13);

bpf_ringbuf_submit(ev, 0);  // 0 = no flags
```

::: tip Ring Buffer vs Perf Buffer
The ring buffer (`BPF_MAP_TYPE_RINGBUF`) is preferred over `BPF_MAP_TYPE_PERF_EVENT_ARRAY` because it supports variable-length records, has a simpler API, and provides better performance on multi-CPU systems.
:::

## Packet Parsing Convention

The codebase uses a unified `packet_info` struct and standardized parsing helpers:

```c
struct packet_info {
    u32 src_ip;       // Source IP (network byte order)
    u32 dst_ip;       // Dest IP (network byte order)
    u16 src_port;     // Source port (network byte order)
    u16 dst_port;     // Dest port (network byte order)
    u8  protocol;     // IPPROTO_TCP / IPPROTO_UDP / IPPROTO_ICMP
    u8  is_ipv6;      // 0 = IPv4, 1 = IPv6
    u8  l4_offset;    // Byte offset of L4 header from start of packet
    u8  tcp_flags;    // TCP flag byte (0 if not TCP)
    u32 payload_len;  // Payload length in bytes (after L4 header)
};

// Always parse through this helper
struct packet_info info = {};
if (parse_packet(ctx, &info) < 0) {
    return XDP_DROP;  // Invalid packet
}
// info is now fully populated and verifier-validated
```

## XDP Return Code Convention

The pipeline returns standard XDP actions:

| Return Code | Meaning | Effect |
|-------------|---------|--------|
| `XDP_PASS` | Packet passes | Kernel receives packet normally |
| `XDP_DROP` | Packet dropped | Silently discarded |
| `XDP_TX` | Packet bounced back | Sent out same interface (used by SYNPROXY) |
| `XDP_ABORTED` | Error | Packet dropped + tracepoint |

Stage functions return `0` (continue) or a drop code defined in `dropcodes.h`.

## Avoid Common Verifier Pitfalls

| Pitfall | Solution |
|---------|----------|
| Variable-length loop | Use `#pragma unroll` with constant upper bound |
| Unbounded pointer arithmetic | Pre-load into scalar, operate on scalar |
| Access before bounds check | Always check `(ptr + 1) > data_end` |
| Stack overflow (>512 bytes) | Use maps for large structures, minimize local variables |
| Non-inlined function call | Use `__always_inline` for all helpers; use stage functions only for freplace targets |
| Backwards jumps (old kernels) | Ensure loop conditions count forward |
| Map access without null check | Always check `bpf_map_lookup_elem` return before dereference |

## Related Pages

- [Config Struct Alignment](/openshield-xdp/development/config-alignment) — Go↔C struct matching
- [Developer Guide](/openshield-xdp/developer-guide/overview) — Architecture and build system
- [Adding a Detection Module](/openshield-xdp/development/adding-module) — Step-by-step module creation
