# SYNPROXY (scalar SYN gate)

Scalar, rate-based SYN-flood mitigation at XDP — loads on every supported kernel (5.15+) with no per-kernel patching.

## How It Works

1. `synproxy_check_listener()` runs early in the pipeline using **only** pre-parsed scalar fields (`is_tcp_syn`) — no packet access, no version-specific helpers.
2. It accounts each SYN for profiling and returns `STAGE_PASS` (the baseline never drops here).
3. The **rate-limiting stage** tracks per-IP SYN pps. Sources above `syn_pps_threshold` accrue `syn_pps_score` and are banned once they cross the suspicion threshold.

This replaces the older cookie/`XDP_TX` design, which could fail to verify on some kernels. The scalar gate is portable by construction; richer listener verification is available as an opt-in freplace module on kernel ≥ 6.10.

## Configuration

```yaml
dynamic:
  synproxy_enabled: false    # scalar SYN gate (off by default)
static:
  syn_pps_threshold: 170     # per-IP SYN pps before scoring
  syn_pps_score: 50          # score added per violation
```

::: tip Defense in depth
Also enable the kernel's own SYN cookies as a complementary second layer:
`sysctl -w net.ipv4.tcp_syncookies=1`.
:::

## Notes

- Works for both IPv4 and IPv6 (mitigation rides on `ip_stats_map` / `ip_stats_map_v6`).
- Tune `syn_pps_threshold` to your legitimate per-IP SYN rate; test against your traffic profile before enabling.
