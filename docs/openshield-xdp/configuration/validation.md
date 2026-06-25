# Validation & Whitelist

```yaml
validation:
  filter_private: true
  filter_bogon: true
  filter_bogus_tcp: true
  filter_malformed: true

whitelist:
  enabled: true
  ips:
    - 10.0.0.1
    - 2001:db8::1
```

## Per-IP Whitelist Flags

| Flag | Value | Effect |
|------|-------|--------|
| Full bypass | 0x0000 | Skip all checks |
| Skip ban | 0x0001 | Skip ban + subnet ban |
| Skip rate | 0x0002 | Skip rate threshold |
| Skip validation | 0x0004 | Skip private/bogon/bogus TCP |

## Empty-Map Fast Path

When whitelist has 0 entries, `whitelist_empty` flag skips lookups entirely. Same for `bans_empty`. Both updated by userspace after every config change.

