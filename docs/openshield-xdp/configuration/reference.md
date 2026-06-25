# Configuration Reference

Full YAML reference for `/etc/openshield/openshield.yaml`.

## Top-Level

```yaml
interface: eno1          # Network interface
xdp_mode: auto           # auto | native | generic | offload
```

## `static`

| Field | Type | Default |
|-------|------|---------|
| `enabled` | bool | `true` |
| `pps_threshold` | int | `1000` |
| `bps_threshold` | int | `10485760` |
| `tcp_pps_threshold` | int | `800` |
| `udp_pps_threshold` | int | `500` |
| `icmp_pps_threshold` | int | `100` |
| `syn_pps_threshold` | int | `200` |
| `suspicion_threshold` | int | `100` |
| `ban_duration` | int | `3600` |
| `pps_score` | int | `20` |
| `bps_score` | int | `20` |
| `tcp_pps_score` | int | `15` |
| `udp_pps_score` | int | `15` |
| `icmp_pps_score` | int | `25` |
| `syn_pps_score` | int | `30` |
| `suspicion_decay` | float | `0.5` |
| `rate_limit_mode` | string | `threshold` |
| `token_rate` | uint32 | `0` |
| `token_burst` | uint32 | `0` |
| `enable_connection_tracking` | bool | `false` |
| `ct_syn_timeout_sec` | int | `30` |
| `star_duration_multiplicators` | []int | `[1,2,4,8,16,32]` |

## `dynamic`

| Field | Type | Default |
|-------|------|---------|
| `enabled` | bool | `true` |
| `baseline_alpha` | float | `0.1` |
| `spike_percentage` | int | `200` |
| `new_source_limit` | int | `100` |
| `panic_pps_rate` | uint32 | `0` |
| `panic_drop_ratio` | uint32 | `80` |
| `dns_amplification_enabled` | bool | `false` |
| `udp_amplification_enabled` | bool | `false` |
| `syn_fin_ratio_enabled` | bool | `true` |
| `entropy_spoof_enabled` | bool | `true` |
| `ttl_anomaly_enabled` | bool | `true` |
| `pkt_anomaly_enabled` | bool | `true` |
| `conn_rate_enabled` | bool | `true` |
| `auto_escalation_enabled` | bool | `true` |
| `mac_filter_enabled` | bool | `false` |
| `synproxy_enabled` | bool | `false` |
