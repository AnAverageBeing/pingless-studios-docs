# Adding a Detection Module

This guide covers adding a new detection or mitigation module to the OpenShield XDP pipeline.

## Two Approaches

OpenShield supports two module patterns:

| Approach | Mechanism | When to use |
|----------|-----------|-------------|
| **#include (classic)** | Module is `#include`d directly into `openshield.bpf.c` via `__always_inline` functions | Simple modules, always-on checks, no hot-patching needed |
| **freplace (new)** | Module is compiled as a standalone BPF program with `SEC("freplace/stage_<name>")`, loaded separately and attached via `BPF_PROG_TYPE_EXT` | Independent modules, hot-patchable, smaller verifier footprint |

Currently all modules use the `#include` approach. freplace support requires kernel ≥ 5.11 with `CONFIG_DEBUG_INFO_BTF=y`.

## Classic #include Approach

### Step 1: Create the BPF Module

Create `ebpf/modules/your_module.c`:

```c
#include "../headers/common.h"
#include "../headers/config.h"
#include "../headers/packet.h"

/* Your detection logic.
 * Returns 0 (continue pipeline) or a drop code.
 */
static __always_inline int check_your_feature(
    struct xdp_md *ctx,
    struct packet_info *info,
    const struct config *cfg)
{
    // Always bounds-check first
    void *data = (void *)(long)ctx->data;
    void *data_end = (void *)(long)ctx->data_end;

    if (/* your condition */) {
        return XDP_DROP;  // or a custom drop code from dropcodes.h
    }
    return 0;  // continue pipeline
}
```

### Step 2: Add Profiling Index

In `ebpf/headers/maps.h`, increment `PROF_MAX_INDEX` and add a named constant:

```c
// prof_map slot indices
#define PROF_MAIN            0
#define PROF_MAC_FILTER      1
// ... existing entries ...
#define PROF_YOUR_MODULE    26   // ← new
#define PROF_MAX_INDEX      27
```

### Step 3: Add Call Site in Pipeline

In `ebpf/openshield.bpf.c`, add your check at the appropriate stage:

```c
/* ─── Stage N: Your Module ─── */
__PROFILE_START(PROF_YOUR_MODULE);
int ret = check_your_feature(ctx, &info, cfg);
__PROFILE_END(PROF_YOUR_MODULE);
if (ret != 0) {
    __UPDATE_EVENT(...);
    return ret;
}
```

### Step 4: Add Config Fields (C Side)

If your module needs configurable thresholds, add fields to `ebpf/headers/config.h`:

```c
struct config {
    // ... existing fields ...

    /* ─── Your Module ─── */
    u8  your_feature_enabled;          /* Default 1 */
    u8  _yf_pad[3];                    /* Align to 4-byte boundary */
    u32 your_feature_threshold;        /* Threshold value */
};
```

### Step 5: Add Config Fields (Go Side)

In `userspace/internal/config/config.go`:

```go
type DynamicConfig struct {
    // ... existing fields ...
    YourFeatureEnabled   bool `yaml:"your_feature_enabled"`
    YourFeatureThreshold int  `yaml:"your_feature_threshold"`
}
```

In `userspace/internal/config/defaults.go`, add reasonable defaults:

```go
Dynamic: DynamicConfig{
    // ... existing defaults ...
    YourFeatureEnabled:   true,
    YourFeatureThreshold: 100,
},
```

### Step 6: Register in Metadata

In `userspace/internal/config/metadata.go`, add to `runtimeFields`:

```go
{
    Name: "dynamic.your_feature_enabled", Display: "Your Feature",
    Category: "Dynamic", Type: FieldBool,
    Description: "Enable your detection feature",
    RuntimeSafe: true,
    GetFunc: func(c *Config) interface{} { return c.Dynamic.YourFeatureEnabled },
    SetFunc: func(c *Config, v interface{}) error {
        b, ok := v.(bool)
        if !ok { return fmt.Errorf("expected bool") }
        c.Dynamic.YourFeatureEnabled = b
        return nil
    },
},
{
    Name: "dynamic.your_feature_threshold", Display: "Your Feature Threshold",
    Category: "Dynamic", Type: FieldInt,
    Min: 1, Max: 100000,
    Description: "Threshold for your feature",
    RuntimeSafe: true,
    GetFunc: func(c *Config) interface{} { return c.Dynamic.YourFeatureThreshold },
    SetFunc: func(c *Config, v interface{}) error {
        i, err := toInt(v)
        if err != nil { return err }
        c.Dynamic.YourFeatureThreshold = i
        return nil
    },
},
```

### Step 7: Wire in Loader config writer

In `userspace/internal/bpf/loader.go`, add your field to the `writeConfig()` function that assembles the C-side config struct:

```go
cfgStruct := bpf.Config{
    // ... existing fields ...
    YourFeatureEnabled:   boolToU8(cfg.Dynamic.YourFeatureEnabled),
    YourFeatureThreshold: uint32(cfg.Dynamic.YourFeatureThreshold),
}
```

### Step 8: Build & Test

```bash
make ebpf && make generate && make userspace
```

## Adding a New BPF Map

If your module needs its own BPF map:

1. **Define in `ebpf/headers/maps.h`**:
   ```c
   struct {
       __uint(type, BPF_MAP_TYPE_HASH);
       __type(key, u32);                    /* IP key */
       __type(value, struct your_struct);    /* custom value */
       __uint(max_entries, 65536);
       __uint(pinning, LIBBPF_PIN_BY_NAME);
   } your_map SEC(".maps");
   ```

2. **Include in bpf2go types** (in `userspace/Makefile`):
   ```makefile
   -type your_struct
   ```

3. **Add to `Maps` struct** in `userspace/internal/bpf/loader.go`:
   ```go
   type Maps struct {
       // ... existing maps ...
       YourMap *ebpf.Map
   }
   ```

4. **Wire in `Load()`** and `OpenPinnedMaps()`.

## freplace Approach (New)

For the freplace approach, see [freplace Design](/openshield-xdp/architecture/freplace) and the [Developer Guide freplace section](/openshield-xdp/developer-guide/overview#freplace-module-development).

### Key differences from #include:

1. **Stage functions are NOT `__always_inline`** — they are real BPF subprograms
2. Declared in `stages.h` as prototypes
3. Default implementation lives in `openshield.bpf.c`
4. Alternative implementation goes in `ebpf/modules/` with `SEC("freplace/stage_<name>")`
5. Loaded via `cilium/ebpf.AttachFreplace`
6. Can be hot-patched without reloading the main XDP program

## Related Pages

- [Config Struct Alignment](/openshield-xdp/development/config-alignment) — Critical for C↔Go consistency
- [BPF Development Patterns](/openshield-xdp/development/bpf-patterns) — Common code patterns
- [Developer Guide](/openshield-xdp/developer-guide/overview) — Full architecture overview
