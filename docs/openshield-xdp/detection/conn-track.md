# Connection Tracking

OpenShield's connection tracking detects **blind TCP state attacks** — ACK or RST packets sent to a server without a prior SYN handshake. These are typically used in TCP reset attacks or to bypass stateful firewalls by flooding random ACK packets at connection-tracking tables.

## Detection vectors

| Vector | Trigger | Config field |
|--------|---------|--------------|
| **Blind SYN-ACK** | SYN-ACK received without prior SYN from the client | `enable_connection_tracking` |
| **Blind ACK** | ACK received without prior SYN from the client (timed window) | `enable_connection_tracking` + `ct_syn_timeout_sec` |
| **Blind RST** | RST received without prior SYN from the client | `enable_connection_tracking` |

## How it works

### Per-IP SYN timestamp

Each `ip_stats` entry stores a `last_syn_seen_ns` timestamp:

```c
struct ip_stats {
    ...
    u64 last_syn_seen_ns;   // Timestamp of last SYN from this IP
    ...
};
```

This timestamp is set to `bpf_ktime_get_ns()` every time a SYN packet is seen from the IP:

```c
if (info->tcp_flags & TCP_SYN) {
    stats->last_syn_seen_ns = now;
}
```

### ACK validation (blind ACK detection)

When an ACK (not SYN+ACK) arrives:

```c
if (info->tcp_flags & TCP_ACK) {
    if (stats->last_syn_seen_ns == 0 ||
        (now - stats->last_syn_seen_ns) >
            ((u64)cfg->ct_syn_timeout_sec * NS_PER_SEC))
        return STAGE_DROP;  // Blind ACK — no prior SYN or SYN too old
}
```

- `last_syn_seen_ns == 0`: No SYN ever seen from this IP → DROP
- `now - last_syn_seen_ns > ct_syn_timeout_sec`: Last SYN too old → DROP

### RST validation (blind RST detection)

```c
if (info->tcp_flags & TCP_RST) {
    if (stats->last_syn_seen_ns == 0)
        return STAGE_DROP;  // Blind RST — no prior SYN
}
```

### SYN-ACK counting

SYN-ACK packets are counted for metrics but not dropped:

```c
if ((info->tcp_flags & (TCP_SYN | TCP_ACK)) == (TCP_SYN | TCP_ACK))
    stats->synack_count++;
```

## Configurable timeout

```yaml
static:
  enable_connection_tracking: true
  ct_syn_timeout_sec: 30          # Max seconds since last SYN before ACK/RST is blind
```

Setting `ct_syn_timeout_sec: 0` disables connection tracking. Setting it too low may drop legitimate ACKs from long-lived connections that pause for extended periods.

::: warning Long-lived connections
A TCP connection that sends no data for > `ct_syn_timeout_sec` seconds will have its ACKs dropped when it resumes. This does **not** affect established connections (the kernel already handles the connection — XDP only sees the individual ACK packets). However, if traffic is asymmetric (SYN on one path, ACK on another), the `last_syn_seen_ns` may be 0 on the ACK path, causing drops. Asymmetric routing scenarios should either whitelist the affected IPs or set `enable_connection_tracking: false`.
:::

## Stage location

Connection tracking runs at stage 14 in the pipeline, **after** IP stats lookup and per-packet tracking but **before** rate limiting. This means:

- Blind ACK/RST detection has access to `ip_stats` from existing IP tracking
- Valid connections pass through to rate limiting normally
- Connection tracking drops are tracked via `PROF_BOGUS_TCP` (same counter as TCP flag violations)

## Disabling connection tracking

```yaml
static:
  enable_connection_tracking: false   # Disable completely
  # or
  ct_syn_timeout_sec: 0               # Disable (zero timeout)
```

## Related pages

[Detection Pipeline](/openshield-xdp/detection-engine/pipeline) · [Rate-Based Detection](/openshield-xdp/detection-engine/rate-based)
