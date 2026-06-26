# Configuration

Runtime config at `/etc/openshield/openshield.yaml`.

## interface / xdp_mode

| Field | Default | Values |
|-------|---------|--------|
| `interface` | `eno1` | Any NIC name |
| `xdp_mode` | `auto` | `auto`, `native`, `generic`, `offload` |

`auto` tries offload → native → generic in order.

## static — Rate thresholds

| Field | Default | Purpose |
|-------|---------|---------|
| `enabled` | `true` | Master switch for per-IP rate limiting |
| `pps_threshold` | `1000` | Max packets/s per IP before scoring |
| `syn_pps_threshold` | `200` | Max SYN/s per IP |
| `suspicion_threshold` | `100` | Cumulative score to trigger ban |
| `ban_duration` | `3600` | Ban duration in seconds |
| `suspicion_decay` | `0.5` | Score retention per window (50%) |
| `rate_limit_mode` | `threshold` | `threshold` or `token_bucket` |

## dynamic — Advanced detection

| Field | Default | Purpose |
|-------|---------|---------|
| `synproxy_enabled` | `false` | Cookie-based SYN flood mitigation |
| `entropy_spoof_enabled` | `true` | Detect spoofed-source floods |
| `ttl_anomaly_enabled` | `true` | Per-IP TTL deviation |
| `conn_rate_limit` | `5000` | Max SYN/s per IP |
| `auto_escalation_threshold` | `5` | Bans per /24 before subnet ban |
| `mac_filter_enabled` | `false` | MAC whitelist/blacklist |

::: tip Full reference
See [Configuration Reference](/openshield-xdp/reference/configuration) for every field.
:::

## Next steps
[CLI Reference](/openshield-xdp/reference/cli) · [Detection](/openshield-xdp/detection-engine/overview)

