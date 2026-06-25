# Map Layout

| Map | Type | Entries | RW |
|-----|------|---------|-----|
| `config_map` | ARRAY | 1 | userspace write, kernel read |
| `whitelist_map` / `_v6` | HASH | 10K | userspace write, kernel read |
| `ip_stats_map` / `_v6` | LRU_HASH | 100K | kernel R/W, userspace read |
| `ban_map` / `_v6` | LRU_HASH | 50K | kernel write, userspace R/W |
| `subnet_ban_map` / `_v6` | LPM_TRIE | 1K/512 | userspace write, kernel read |
| `prefix_ban_map` | PERCPU_ARRAY | 256 | kernel R/W |
| `global_stats_map` | PERCPU_ARRAY | 1 | kernel write, userspace read |
| `baseline_map` | ARRAY | 1 | userspace write, kernel read |
| `panic_bucket_map` | PERCPU_ARRAY | 1 | kernel R/W |
| `events_map` | RINGBUF | 256 KB | kernel write, userspace read |
| `prof_map` | PERCPU_ARRAY | 27 | kernel write, userspace read |
| `l7_sig_map` | ARRAY | 16 | userspace write, kernel read |
| `syn_cookie_map` | LRU_HASH | 100K | kernel R/W |

## Map Type Selection

| Use case | Type |
|----------|------|
| Single config value | ARRAY |
| IP → data (evictable) | LRU_HASH |
| IP → data (permanent) | HASH |
| CIDR prefix | LPM_TRIE |
| Per-CPU counters | PERCPU_ARRAY |
| Kernel → userspace pipe | RINGBUF |

## Restart Behaviour

| Map | On restart |
|-----|-----------|
| `config_map` | Overwritten from YAML |
| `whitelist_map` | Cleared + repopulated |
| `ip_stats_map` | Cleared |
| `ban_map` | Kept (bans persist) |
| `subnet_ban_map` | Kept |
| `baseline_map` | Restored from `baseline.json` |
| `panic_bucket_map` | Auto-clears each second |
| `events_map` | Self-cleaning |
| `syn_cookie_map` | Cleared (cookies invalid on restart) |
