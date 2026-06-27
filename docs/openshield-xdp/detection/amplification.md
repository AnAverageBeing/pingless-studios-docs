# UDP Amplification Detection

OpenShield detects **UDP amplification/reflection attacks** — where an attacker spoofs the victim's IP and sends small UDP requests to open reflectors (DNS, NTP, SSDP, Memcached, etc.), causing large responses to flood the victim.

## Detection architecture

Two amplification detection paths coexist:

| Path | Config flag | Description |
|------|------------|-------------|
| **DNS-specific** | `dns_amplification_enabled` | Legacy single-port check: sport=53, verifies DNS QR bit is set (response) |
| **Generic 8-port** | `udp_amplification_enabled` + `amp_ports[8]` | Configurable per-port amplifier detection with minimum payload thresholds |

Both paths are checked in `stage_amp_check`, which runs before L7 filtering (stage 10 in the pipeline).

## DNS amplification detection

```c
if (!any_generic_enabled) {
    // Fallback: legacy DNS-only check
    if (!cfg->dns_amplification_enabled) return 0;
    if (info->sport != 53) return 0;
    if (info->l4_payload_len < cfg->dns_amp_payload_min) return 0;
    // Check DNS QR bit (response flag)
}
```

### DNS QR-bit check

When DNS amplification is enabled and `sport == 53`:

1. Parse the DNS header at offset `l2_offset + ip_hdr_len + 8` (UDP header = 8 bytes)
2. Read byte 2 of the DNS header (flags byte)
3. Check the **QR bit** (bit 7 of byte 2): `dns_flags & 0x80`
4. If QR bit is set (DNS response) → drop
5. If QR bit is clear (DNS query) → pass (not an amplified response)

```c
// L4 header starts at ip_start + ip_hdr_len
// DNS payload starts at L4 + 8 (UDP header)
void *dns = data + l2_offset + ip_hdr_len + 8;
u8 dns_flags = *((u8 *)dns + 2);    // Byte 2 of DNS header
if (!(dns_flags & 0x80))            // QR bit not set = query, not amp
    return 0;                        // Pass
// QR bit set = DNS response on port 53 → likely amplified
```

::: tip DNS QR-bit semantics
- `QR = 0`: Query (the request sent by the attacker to the reflector)
- `QR = 1`: Response (the amplified traffic flooding the victim)

Only DNS responses on port 53 with payload > `dns_amp_payload_min` are dropped. Legitimate DNS queries (QR=0) pass through regardless of payload size.
:::

## Generic amplification detection

Eight configurable slots, each with independent port and payload threshold:

```c
// Fast-path: check if ANY generic amp slot is enabled
u8 any_enabled = cfg->amp_enable[0] || cfg->amp_enable[1] || ...;
if (!any_enabled) {
    // Fallback to legacy DNS-only
}

// Check each enabled slot
for (u32 i = 0; i < 8; i++) {
    if (!cfg->amp_enable[i])       continue;
    if (cfg->amp_ports[i] == 0)   continue;
    if (info->sport != cfg->amp_ports[i]) continue;
    if (info->l4_payload_len < cfg->amp_payload_min[i]) continue;
    matched = 1;
}
```

### Config fields

| Field | Type | Description |
|-------|------|-------------|
| `udp_amplification_enabled` | `bool` | Master switch for generic amplification detection |
| `amp_ports[8]` | `u16[8]` | UDP source ports to check (0 = slot disabled) |
| `amp_payload_min[8]` | `u32[8]` | Minimum UDP payload bytes to trigger drop per slot |
| `amp_enable[8]` | `u8[8]` | Per-slot enable flag (1 = on) |
| `dns_amplification_enabled` | `bool` | Legacy DNS-specific amplification check |
| `dns_amp_payload_min` | `u32` | Minimum DNS response payload (default 512) |

### Default amplification ports

| Slot | Port | Protocol | Min payload | Rationale |
|------|------|----------|-------------|-----------|
| 0 | 53 | DNS | 512 | Standard DNS responses (typical amplification: 28–54×) |
| 1 | 123 | NTP | 90 | NTP monlist responses (amplification: 556×) |
| 2 | 1900 | SSDP | 256 | UPnP/SSDP discovery responses |
| 3 | 11211 | Memcached | 50 | Memcached UDP responses (amplification: 10,000–51,000×) |
| 4 | 17 | QOTD | 50 | Quote of the Day |
| 5 | 19 | Chargen | 50 | Character Generator |
| 6 | 520 | RIP | 50 | Routing Information Protocol |
| 7 | 69 | TFTP | 50 | Trivial File Transfer Protocol |

::: warning Disable unused ports
Each enabled slot adds one unrolled loop iteration (~10ns per slot). Set `amp_enable[i] = 0` for any slot you don't need. Port 53 is checked via either legacy DNS detection OR generic slot 0 — don't double-check it.
:::

## Minimum payload enforcement

UDP packets below the per-slot minimum payload are not checked. This prevents false positives from:

- DNS queries (typically ~50 bytes) being flagged as amplified responses
- NTP time sync requests (typically ~48 bytes)
- Small control packets that happen to use the same port

If an amplifier sends a response below the minimum payload, it's not large enough to be a useful amplification vector and is allowed through.

## Drop code

Both DNS and generic amplification drops use `DROP_AMP_REFLECTION` (code 9). Counters are tracked in:

- `PROF_DNS_AMPLIFY` (16) — legacy DNS amplification drops
- `PROF_UDP_AMP` (17) — generic amplification drops

## Configuration

```yaml
dynamic:
  # Legacy DNS amplification
  dns_amplification_enabled: true
  dns_amplification_payload_min: 512

  # Generic UDP amplification
  udp_amplification_enabled: true
  udp_amp_ports: [53, 123, 1900, 11211, 17, 19, 520, 69]
  udp_amp_payload_min: [512, 90, 256, 50, 50, 50, 50, 50]
```

## Related pages

[L3/L4 Detection](/openshield-xdp/detection/l3-l4) · [Detection Pipeline](/openshield-xdp/detection-engine/pipeline)
