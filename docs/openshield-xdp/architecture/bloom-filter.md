# Bloom Filter

OpenShield-XDP uses a **Bloom filter** as a fast negative-check before the HASH whitelist lookup. This avoids an expensive hash table lookup for the common case — packets from non-whitelisted IPs.

## Why a Bloom Filter?

The HASH whitelist lookup costs ~100-200ns per packet (hash computation + bucket walk + key comparison). For a server fielding 10M pps, that's 1-2 seconds of CPU time per second just for whitelist lookups.

The Bloom filter costs ~60-100ns (3 array lookups + 3 SplitMix64 hashes). If the IP is **not** whitelisted (the common case), the Bloom filter says "definitely not present" and we skip the HASH lookup entirely — saving ~100ns per packet.

```
                    ┌──────────────┐
     Packet ───────▶│ Bloom Filter │
                    └──────┬───────┘
                           │
              ┌────────────┴────────────┐
              ▼                         ▼
     "definitely NOT"            "MAYBE present"
              │                         │
              │                         ▼
              │               ┌─────────────────┐
              │               │ HASH Whitelist   │
              │               │ (authoritative)  │
              │               └────────┬────────┘
              │                        │
              ▼                  ┌─────┴─────┐
        Continue pipeline        ▼           ▼
                           Found (PASS)  Not found
                                         (continue)
```

::: tip No false negatives
The Bloom filter is guaranteed to have **zero false negatives**. If an IP is in the whitelist, the Bloom filter will always say "maybe present" (all 3 bits are set). The HASH whitelist is the authoritative source of truth.
:::

## Implementation

### Map Structure

```c
// ebpf/headers/maps.h
#define BLOOM_MAX_ENTRIES 150000

struct {
    __uint(type, BPF_MAP_TYPE_ARRAY);
    __type(key, u32);          // word index (0..149999)
    __type(value, u64);        // 64-bit word (64 Bloom positions per word)
    __uint(max_entries, BLOOM_MAX_ENTRIES);
    __uint(pinning, LIBBPF_PIN_BY_NAME);
} bloom_map SEC(".maps");
```

| Parameter | Value |
|-----------|-------|
| Map type | `BPF_MAP_TYPE_ARRAY` |
| Entries | 150,000 × u64 = **1.2 MB** |
| Total bits | 150,000 × 64 = **9,600,000 bits** |
| Hash functions (k) | 3 |
| Target FPR | ~1% at 1,000,000 IPs |

### Hash Functions

Three SplitMix64 hash functions are derived from a single pass with a per-index seed mix-in:

```c
// ebpf/headers/bloom.h
#define BLOOM_HASH_COUNT 3

static __always_inline u32 bloom_hash(u32 ip, u32 hash_idx)
{
    u64 h = (u64)ip;
    h ^= (u64)hash_idx * 0x9E3779B9ULL;        // mix in hash index
    h = (h ^ (h >> 30)) * 0xBF58476D1CE4E5B9ULL;
    h = (h ^ (h >> 27)) * 0x94D049BB133111EBULL;
    h = h ^ (h >> 31);
    return (u32)h;
}
```

The 3 hash functions differ only in the `hash_idx` seed (0, 1, 2), making the unrolled loop compact:

```c
static __always_inline int bloom_check_v4(u32 ip)
{
    #pragma unroll
    for (u32 i = 0; i < BLOOM_HASH_COUNT; i++) {
        u32 h = bloom_hash(ip, i);
        u32 idx, bit;
        bloom_indices(h, &idx, &bit);
        u64 *val = bpf_map_lookup_elem(&bloom_map, &idx);
        if (!val || !(*val & (1ULL << bit)))
            return 0;   // Definitely NOT present — skip HASH lookup
    }
    return 1;           // MAYBE present — fall through to HASH lookup
}
```

### Index Derivation

Each hash produces:
- **Word index** = `hash % 150000` (which word in the array)
- **Bit position** = `(hash / 150000) % 64` (which bit within that word)

This spreads consecutive hash outputs across different bit positions, reducing intra-word collisions.

### IPv6 Hash Folding

IPv6 addresses are folded to 32 bits before hashing:

```c
static __always_inline int bloom_check_v6(struct ip6_key *key)
{
    u32 ip32 = (u32)(key->hi ^ key->lo);   // XOR halves
    // ... same 3-hash check as IPv4 ...
}
```

::: warning IPv6 Collision Caveat
XOR-folding 128 bits → 32 bits means distinct IPv6 addresses can map to the same Bloom input. The false positive rate for IPv6 is slightly higher than for IPv4, but the HASH whitelist lookup serves as the final arbiter. This trade-off keeps the Bloom check fast (no 128-bit arithmetic in the hot path).
:::

## Performance

| Scenario | Without Bloom | With Bloom | Savings |
|----------|:------------:|:----------:|:-------:|
| Non-whitelisted packet | HASH lookup (~100-200ns) | Bloom check only (~60-100ns) | ~100ns |
| Whitelisted packet | HASH lookup (~100-200ns) | Bloom check + HASH lookup (~160-300ns) | −100ns (slight overhead) |
| At 10M pps, 99% non-wl | 1-2s CPU/s | 0.6-1s CPU/s | ~50% reduction |

The Bloom filter is **most effective** when most traffic is non-whitelisted (the common case for edge DDoS mitigation).

## Go-Side: PopulateBloomFilter

The Bloom filter is populated by `PopulateBloomFilter()` in `userspace/internal/bpf/bloom.go`:

```go
func (m *Maps) PopulateBloomFilter(whitelistIPs []uint32, whitelistIPsV6 []Ip6Key, maxEntries int) error {
    // 1. Clear all 150K entries
    m.ClearBloomFilter(maxEntries)

    // 2. For each whitelisted IPv4, set 3 bits
    for _, ip := range whitelistIPs {
        for i := uint32(0); i < bloomHashCount; i++ {
            h := bloomHash(ip, i)
            idx := h % uint32(maxEntries)
            bit := (h / uint32(maxEntries)) % bloomBitsPerEntry

            var val uint64
            m.BloomMap.Lookup(idx, &val)
            val |= 1 << bit
            m.BloomMap.Put(idx, val)
        }
    }

    // 3. For each whitelisted IPv6 (XOR-folded), set 3 bits
    for _, key := range whitelistIPsV6 {
        ip32 := uint32(key.Hi ^ key.Lo)
        // ... same 3-bit insertion ...
    }
}
```

This is called:
- On initial config load
- On config reload (`openshield config reload`)
- After whitelist changes

## Configuration

```yaml
# openshield.yaml
maps:
  bloom_filter_enabled: true   # default: true
```

When `bloom_filter_enabled` is `false`, the Bloom check is skipped entirely — every packet goes directly to the HASH whitelist lookup.

The flag is stored in the `config` struct as `cfg->bloom_filter_enabled` and checked in the fast path:

```c
if (cfg->bloom_filter_enabled)
    bloom_hit = bloom_check_v4(info.src_ip);
```

## Known Limitations

### Stale After Runtime Updates

The Bloom filter is **not updated when whitelist entries change at runtime** (e.g., adding/removing a single IP via the CLI). The Bloom filter only reflects the state at the time of `PopulateBloomFilter()`.

**Workaround**: The Bloom filter is rebuilt on every config reload. For runtime whitelist changes, trigger a config reload:

```bash
openshield config reload
```

### No Deletion Support

Bloom filters do not support deletion (removing a bit could collide with another IP's bit). When whitelist entries are removed, the Bloom filter must be **completely rebuilt** from the remaining entries. `ClearBloomFilter()` + `PopulateBloomFilter()` handles this.

### False Positive Rate Increases with Entries

| Whitelist Size | Approximate FPR |
|:--------------:|:---------------:|
| 1,000 | < 0.001% |
| 10,000 | ~0.01% |
| 100,000 | ~0.1% |
| 1,000,000 | ~1% |
| 10,000,000 | ~30% (Bloom saturated) |

At 1M whitelisted IPs, ~1% of non-whitelisted packets will incur the HASH lookup anyway — still a 99% saving. Beyond ~5M entries, the filter saturates and provides diminishing returns.
