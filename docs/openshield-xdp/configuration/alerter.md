# Alerter & Telemetry

```yaml
alerter:
  enabled: false
  webhook_url: ""
  events: [attack_start, ban_triggered, panic_mode]

telemetry:
  poll_interval: 1
  event_rate_limit: 100
  top_offenders_count: 20
  log_level: info
  snapshot_interval: 1

maps:
  ip_stats_max: 100000
  ban_max: 50000
  whitelist_max: 10000
  event_buffer_size: 262144
```

## Webhook Events

`attack_start`, `attack_end`, `ban_triggered`, `panic_mode`, `new_source_flood`, `threshold_violation`, `subnet_ban`, `entropy_spoof`, `ttl_anomaly`, `packet_size_anomaly`, `syn_fin_flood`, `conn_rate_flood`

Colour-coded embeds (Discord + Slack). Non-blocking dispatch.

