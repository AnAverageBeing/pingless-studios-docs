# Developer Guide

::: warning Separate from user docs
This section is for developers working on OpenShield-XDP itself. If you're deploying OpenShield as a user, see [Getting Started](/openshield-xdp/getting-started/overview).
:::

## Project Structure

```
OpenShield-XDP/
├── ebpf/                     # BPF kernel code
│   ├── openshield.bpf.c      # Main XDP program entry point
│   ├── vmlinux.h             # Generated kernel BTF types
│   ├── headers/              # Shared BPF headers
│   │   ├── config.h          # struct config (C side — must match Go)
│   │   ├── stages.h          # freplace-able pipeline stage declarations
│   │   ├── maps.h            # BPF map definitions + pinning
│   │   ├── common.h          # Common macros, types, helpers
│   │   ├── stats.h           # Per-IP stats struct + PERCPU_ macros
│   │   ├── packet.h          # Packet parsing helpers (Ethernet, IP, TCP, UDP)
│   │   ├── validation.h      # Private/bogon/bogus TCP checks
│   │   └── features.h        # Feature gate detection macros
│   ├── modules/              # Individual pipeline stages (compilable as freplace)
│   │   ├── ban_check.c
│   │   ├── rate_limit.c
│   │   ├── conn_track.c
│   │   ├── dns_amp.c
│   │   ├── l7_filter.c
│   │   └── Makefile          # Stage compilation targets
│   └── Makefile
├── userspace/                # Go userspace code
│   ├── cmd/                  # Entry points
│   │   ├── loader/           # openshield-loader binary
│   │   ├── config/           # openshield-config binary
│   │   ├── tui/              # openshield-tui binary
│   │   ├── installer/        # openshield-installer binary
│   │   └── openshield/       # openshield CLI binary (unified entry)
│   ├── internal/
│   │   ├── bpf/              # bpf2go generated bindings + map management
│   │   ├── config/           # Config types, defaults, metadata, validation
│   │   ├── telemetry/        # Collector, baseline learner, panic coordinator
│   │   ├── alerter/          # Discord webhook alerter
│   │   └── tui/              # Bubbletea TUI app
│   ├── Makefile
│   └── go.mod / go.sum
├── configs/                  # Example config files
├── systemd/                  # Systemd unit files
└── Makefile                  # Top-level build orchestration
```

## Two-Binary Split

OpenShield ships as two distinct Rust/Go binaries with different responsibilities:

| Binary | Role | Runs as |
|--------|------|---------|
| `openshield-loader` | Long-running daemon: loads BPF, attaches XDP, polls maps, runs collector/baseline/ban-manager/panic-coordinator goroutines | `root` systemd service |
| `openshield` | CLI entry point: `openshield load`, `openshield status`, `openshield config`, `openshield fix` — communicates with loader via Unix socket | `root` interactive |

The TUI (`openshield-tui`) and config generator (`openshield-config`) are separate binaries but can be invoked through the `openshield` CLI as subcommands.

## BPF Development

### Verifier Constraints

The Linux BPF verifier imposes strict rules on all BPF programs:

1. **All memory accesses must be bounds-checked** before use. Every packet pointer (data/data_end) must be validated.
2. **All loops must have provable upper bounds** at compile time. Unbounded loops = verifier rejection.
3. **Maximum 1,000,000 instructions** per program (kernel 5.2+).
4. **Maximum 512 bytes stack** per program.
5. **No indirect calls** except through `BPF_PROG_TYPE_EXT` (freplace).
6. **Only specific kernel helpers** are callable — check `vmlinux.h` for available helpers.

### Pointer Bounds Pattern

Every packet access must follow this pattern:

```c
void *data = (void *)(long)ctx->data;
void *data_end = (void *)(long)ctx->data_end;

struct ethhdr *eth = data;
if ((void *)(eth + 1) > data_end)
    return XDP_DROP;
// eth->h_proto is now verifier-validated
```

### Packet Pointer Arithmetic

The verifier **cannot track** packet pointers through scalar arithmetic. Instead, pre-load into a local variable:

```c
u64 pload = *(u64 *)(l4 + doff);  // Validated load into register
u8 byte0 = (u8)pload;             // Safe: local access
u8 byte1 = (u8)(pload >> 8);      // Safe: local access
```

### Loop Unrolling

All loops must have compile-time bounds:

```c
// ❌ Verifier rejects:
for (int i = 0; i < n; i++) { ... }

// ✅ Verifier accepts:
#pragma unroll
for (int i = 0; i < 8; i++) { ... }
```

For loops where `#pragma unroll` is impractical, use a bounded loop with an explicit upper limit.

### `__always_inline` Rule

Every function in the XDP call chain must be `__always_inline`. The five replaceable stages use the `STAGE_FN` macro (declared in `stages.h`): by **default** it expands to `static __always_inline`, so the stages are inlined and the program loads on every supported kernel. Only in an **opt-in** `make FREPLACE=1` build (kernel ≥ 6.10) does `STAGE_FN` become `__attribute__((noinline))`, turning the stages into real BPF subprograms that freplace programs can target.

### Map Interactions

| Pattern | Use | Example |
|---------|-----|---------|
| `bpf_map_lookup_elem` | Read from any map | Config, whitelist, ban check |
| `bpf_map_update_elem` with `BPF_ANY` | Upsert | Per-IP stats update |
| `bpf_map_update_elem` with `BPF_NOEXIST` | Insert-if-new | New IP tracking, connection tracking |
| `bpf_map_delete_elem` | Remove entry | Ban cleanup |
| `PERCPU_ARRAY` reads | Per-CPU counters | `global_stats`, `prof_map` |
| `bpf_spin_lock` | Lock global counters | Write side of `global_stats` total PPS |
| `bpf_ringbuf_output` | Emit events | Ban events, threshold violations |

## Go Development

### bpf2go Usage

The `bpf2go` tool (from `cilium/ebpf`) generates Go structs and map wrappers from BPF ELF files:

```bash
# In userspace/Makefile:
generate:
    cd userspace && bpf2go -target bpfel \
        -type config -type ip_stats -type global_stats \
        bpf ../ebpf/openshield.bpf.c -- \
        -I../ebpf -I../ebpf/headers $(BPF_FEATURES)
```

Generated files land in `userspace/internal/bpf/` as `bpf_bpfel.go` and `bpf_bpfel.o`.

### Map Struct Alignment

::: danger Critical: Go ↔ C alignment must match exactly
The `struct config` defined in `ebpf/headers/config.h` must have the **exact same layout** as the struct generated by `bpf2go` in Go. A single byte of misalignment causes corrupted config reads in the BPF program, silently breaking all thresholds.
:::

**Alignment rules:**
- All fields are naturally aligned (u32 = 4 bytes, u64 = 8 bytes)
- Explicit padding fields (e.g., `_rl_pad[2]`, `_reserved`) maintain 8-byte boundaries
- Bit fields are not used — each flag is a `u8`
- Arrays of u8 for MAC addresses are sized to fill alignment

**Verification:**

```bash
# Check BPF struct layout from BTF
bpftool btf dump file ebpf/openshield.bpf.o | grep -A 50 "'struct config'"

# Compare field offsets with Go
go run -tags debug ./cmd/debug-align/  # prints Go struct field offsets
```

### Config Metadata System

New config fields are registered in `userspace/internal/config/metadata.go`:

```go
{
    Name: "static.your_field",           // dot-separated path
    Display: "Your Field",               // Human-readable
    Category: "Static",                  // Category for TUI
    Type: FieldInt,                      // FieldInt, FieldFloat, FieldBool, FieldString
    Min: 1, Max: 10000,                  // Validation bounds
    RuntimeSafe: true,                   // Can update via socket?
    GetFunc: func(c *Config) interface{} { return c.Static.YourField },
    SetFunc: func(c *Config, v interface{}) error {
        i, err := toInt(v)
        if err != nil { return err }
        c.Static.YourField = i
        return nil
    },
},
```

Fields with `RuntimeSafe: false` go into `readOnlyFields` and require a restart.

## Build System

### Makefile Targets

| Command | What it does |
|---------|-------------|
| `make vmlinux` | Generate `vmlinux.h` from `/sys/kernel/btf/vmlinux` (first time only) |
| `make ebpf` | Compile BPF kernel code (`clang -target bpf`) |
| `make generate` | Run `bpf2go` to regenerate Go BPF bindings (depends on `ebpf`) |
| `make userspace` | Build all Go binaries |
| `make all` | `ebpf` + `generate` + `userspace` (default) |
| `make test` | Run `go test -v -race ./...` |
| `make clean` | Remove all build artifacts |
| `make install` | Install to `/opt/openshield` |
| `make uninstall` | Remove installed files (preserves config/logs) |

### Feature Flag Propagation

The top-level Makefile auto-detects the running kernel version and sets feature flags:

```makefile
KERNEL_VER := $(shell uname -r | cut -d. -f1,2)

# L7 multisig (kernel >= 6.10)
ifneq (...)
  BPF_FEATURES += -DOPENSHIELD_L7_MULTISLOT
endif

# Entropy + global detection (kernel >= 6.10)
ifneq (...)
  BPF_FEATURES += -DOPENSHIELD_GLOBAL_DETECT -DOPENSHIELD_ENTROPY
endif

# SYNPROXY (kernel >= 5.15)
ifneq (...)
  BPF_FEATURES += -DOPENSHIELD_SYNPROXY
endif
```

These flags are passed to both `clang` (for BPF compilation) and `bpf2go` (so generated Go types include the feature-dependent struct fields). When a feature flag is absent, the corresponding code compiles as a no-op stub via `#ifdef` guards in `features.h`.

## Kernel Feature Gate Development

New kernel-version-dependent features are added via the feature gate system:

1. In `ebpf/headers/features.h`, add:
   ```c
   #ifdef OPENSHIELD_YOUR_FEATURE
   // feature implementation
   #else
   // no-op stub
   #endif
   ```

2. In the top-level `Makefile`, add a version check:
   ```makefile
   ifneq ($(shell test $(KERNEL_MAJOR) -ge 6 -a $(KERNEL_MINOR) -ge X ... && echo yes),)
     BPF_FEATURES += -DOPENSHIELD_YOUR_FEATURE
   endif
   ```

3. Add the flag to the `bpf2go` invocation in `userspace/Makefile` so generated Go types include any new struct fields.

## freplace Module Development

See [Architecture: freplace](/openshield-xdp/architecture/freplace) for the design overview. The stage declarations live in `ebpf/headers/stages.h`:

```c
// stages.h — replaceable pipeline stages. Linkage is chosen by STAGE_FN:
//   default build  → static __always_inline (folded in; loads on all kernels)
//   make FREPLACE=1 → __attribute__((noinline)) global subprogram (kernel ≥ 6.10)
// The forward declarations below are only emitted in a FREPLACE build.
int stage_ban_check(struct packet_info *info, const struct config *cfg,
                     u64 now, u8 wl_flags, struct ip6_key *v6_key);
int stage_rate_limit(struct ip_stats *stats, struct packet_info *info,
                     const struct config *cfg, u64 now_packed,
                     struct ip6_key *v6_key);
int stage_conn_track(struct ip_stats *stats, struct packet_info *info,
                     const struct config *cfg, u64 now);
int stage_amp_check(struct xdp_md *ctx, struct packet_info *info,
                    const struct config *cfg);
int stage_l7_filter(struct xdp_md *ctx, struct packet_info *info,
                    const struct config *cfg);
```

Default implementations live in `openshield.bpf.c`. Alternative implementations go in `ebpf/modules/` with `SEC("freplace/stage_<name>")`.

To add a new freplace-able stage:

1. Declare the function prototype in `stages.h`
2. Implement the default in `openshield.bpf.c`
3. Add the call site in the main pipeline
4. Optionally provide an alternative implementation in `ebpf/modules/` with matching signature + `SEC("freplace/stage_<name>")`

## Bloom Filter Development

The Bloom filter is a performance optimization that accelerates whitelist lookups. See `userspace/internal/bpf/bloom.go` and the `bloom_map` in `ebpf/headers/maps.h`.

**Key details:**
- 3 hash functions (SplitMix64-based) → 3 bit-positions per IP
- 64 bits per entry → packed into ARRAY map entries of `u64`
- `bloom_filter_size` entries (default 150,000) = ~1.2 MB map
- False positive rate ≈ 0.01% at 150K entries with 10K whitelisted IPs
- Populated by `PopulateBloomFilter()` after config load
- Cleared on whitelist changes via `ClearBloomFilter()`

## Testing

### Current State

::: warning Testing Gap
The project currently has **no `_test.go` files** and **no BPF selftests**. This is a known gap. The following are recommended approaches.
:::

### Verifier Check

```bash
# Load the BPF object to exercise the verifier — succeeds = verifier passes
bpftool prog load ebpf/openshield.bpf.o /sys/fs/bpf/test_verify type xdp
rm -f /sys/fs/bpf/test_verify
```

### Go Linting

```bash
cd userspace && go vet ./... && gofmt -l .
```

### Performance Testing

Use `bpftool prog profile` to collect instruction-level profiles:

```bash
bpftool prog profile <prog_id> duration 30
```

Or use synthetic traffic generators like `pktgen`, `hping3`, or `iperf3` for end-to-end throughput testing.

## Fast Iteration Loop

```bash
# Edit BPF code in ebpf/
make ebpf && make generate && make userspace
cp bin/openshield-* /opt/openshield/bin/
sudo openshield fix && sudo openshield load --stats-off
```

## Related Pages

- [Development Environment Setup](/openshield-xdp/development/guide)
- [Adding a Detection Module](/openshield-xdp/development/adding-module)
- [BPF Development Patterns](/openshield-xdp/development/bpf-patterns)
- [Config Struct Alignment](/openshield-xdp/development/config-alignment)
- [Architecture Overview](/openshield-xdp/architecture/overview)
