# Global Configuration Reference

The global config (`configs/global.yaml`) applies cross-cutting settings to all proxies.

## Full Schema

```yaml
# API Server
api:
  enabled: true              # Enable REST management API
  bind: "0.0.0.0:9000"      # Listen host:port
  api_keys:                  # API credentials
    - key: "secret"          # Key secret
      label: "admin"         # Human-readable name
      permissions: ["*"]     # Scopes: metrics:read, proxies:read, *
  tls:
    enabled: false
    cert: ""
    key: ""

# Timezone (used for bandwidth resets, time-based features)
timezone: "UTC"

# Metrics Store
metrics:
  enabled: true
  retention_hours: 168       # 7 days
  flush_interval_seconds: 10
  sqlite_path: "./routex_metrics.db"
  formats: ["json", "prometheus", "influx", "csv"]

# Network Tuning
network:
  socket_buffer_size: 65536
  tcp_keepalive_enabled: true
  tcp_keepalive_interval: 30
  tcp_nodelay: true
  udp_read_buffer: 4194304   # 4 MB
  udp_write_buffer: 4194304  # 4 MB

# Global Connection Defaults (override per-proxy)
defaults:
  upstream_connect_timeout: 5s
  upstream_read_timeout: 30s
  upstream_write_timeout: 30s
  client_read_timeout: 30s
  client_write_timeout: 30s
  health_check_interval: 10s
  health_check_timeout: 3s
  health_check_failures_before_eject: 3
  health_check_passes_before_readmit: 2

# iptables
iptables:
  enabled: true
  chain_prefix: "ROUTEX"
  comment_prefix: "RouteX"
  auto_create_chains: true
  flush_on_start: false
  ipv6_enabled: false

# Global ACL (checked before per-proxy ACLs)
acl:
  enabled: false
  default_action: "allow"    # allow or deny
  rules:
    - action: "deny"
      cidr: "192.168.0.0/16"
      comment: "block private LAN"

# Logging
logging:
  level: "info"              # debug, info, warn, error
  format: "json"             # json or text
  output: "stdout"           # stdout or file
  file_path: "./routex.log"
  max_size_mb: 100
  max_backups: 5
```
