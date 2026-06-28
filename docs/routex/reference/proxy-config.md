# Per-Proxy Configuration Reference

Each `.yaml` file in `configs/proxies/` is one proxy instance, loaded and validated independently.

## Full Schema

```yaml
name: "my-proxy"             # Unique identifier
enabled: true                # Start on load
description: "My service"    # Human-readable

# Listening
origin-ip: "0.0.0.0"        # Bind IP (0.0.0.0 = all interfaces)
origin-port: "25565:25575"   # Single port or range

# Upstream
dest-ip: "10.0.0.1, 10.0.0.2"    # Comma-separated
dest-port: "35565:35575"           # Single or range

# Port Mapping
one-to-one: true             # true = positional pairing (ranges must match)
                             # false = fan-out (any origin → any dest)
protocol: "tcp-udp"          # tcp, udp, or tcp-udp

# Load Balancing
load_balancing:
  algorithm: "least-conn"    # round-robin | least-conn | ip-hash | weighted | random
  sticky_sessions: false
  sticky_ttl: 3600           # seconds
  upstream_weights:          # Only for "weighted" algorithm
    "10.0.0.1": 3
    "10.0.0.2": 1
  health_check:
    interval: 10s
    timeout: 3s
    failures_before_eject: 3
    passes_before_readmit: 2

# iptables Rate Limits (0 = disabled)
rate_limits:
  tcp_pps_per_ip: 500              # Packets/sec per source IP
  udp_pps_per_ip: 1000
  new_conns_per_sec_per_ip: 20     # SYN rate per IP
  new_conns_per_sec_global: 500
  max_simultaneous_conns_per_ip: 10
  max_total_conns: 500             # Global conn cap
  drop_fragmented_packets: true
  min_ttl: 10                      # 0 = disabled
  max_ttl: 255
  min_packet_size: 20              # bytes, 0 = disabled
  max_packet_size: 65535
  tcp_syn_rate_per_ip: 10
  tcp_invalid_state_drop: true
  tcp_rst_rate_per_ip: 20
  udp_max_payload: 4096
  udp_min_payload: 1

# L7 Protection (optional — disabled by default)
l7_protection:
  enabled: false             # Set to true to enable
  slow_connection:
    enabled: true
    min_bytes_in_first: 8
    handshake_timeout: 5s
    min_recv_rate_bps: 64
  payload_rate_limit:
    enabled: true
    max_bytes_per_sec_per_ip: 5242880   # 5 MB/s
    burst_multiplier: 2.0
  connection_cycling:
    enabled: true
    window: 10s
    max_conns_in_window: 30
    ban_duration: 60s
  payload_inspection:
    enabled: true
    mode: "minecraft-java"  # minecraft-java | minecraft-bedrock | fivem | gmod | custom | none
  behavioral_scoring:
    enabled: true
    score_window: 30s
    ban_threshold: 100
    ban_duration: 120s
    score_rules:
      - event: "invalid_protocol"
        score: 30

# ACL (per-proxy, checked after global ACL)
acl:
  default_action: "allow"
  rules:
    - action: "deny"
      cidr: "10.0.0.0/8"
      comment: "internal block"

# Bandwidth Quotas
bandwidth:
  enabled: false
  hourly_limit: 10737418240    # 10 GB/hour (0 = unlimited)
  daily_limit: 107374182400    # 100 GB/day
  weekly_limit: 0
  monthly_limit: 2147483648000 # 2 TB/month
  suspend_on_limit: true

# TLS
tls:
  passthrough: true
  sni_routing: false

# Timeouts (override global defaults)
timeouts:
  upstream_connect: 5s
  upstream_read: 30s
  upstream_write: 30s
  client_read: 30s
  client_write: 30s

# Connection Draining
connection_draining:
  enabled: true
  timeout: 30s

# Logging
logging:
  level: "info"
  log_connections: true       # Log each connect/disconnect
  log_bytes: false            # Log byte counts (noisy)

# Metadata
metadata:
  tags: ["game", "minecraft"]
  owner: "infra-team"
```
