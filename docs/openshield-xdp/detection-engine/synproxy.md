# SYNPROXY

Cookie-based SYN flood mitigation at XDP line rate. When a TCP SYN arrives, OpenShield generates a cryptographic cookie, sends a SYN-ACK back to the client via `XDP_TX`, and only passes the connection to the kernel after the client returns a valid ACK with the cookie.

::: tip When to enable
Enable SYNPROXY when your server is under sustained TCP SYN floods that saturate connection tracking. Disabled by default — test against your traffic profile before enabling in production.
:::

## Packet flow

```
Client                OpenShield (XDP)              Server (kernel)
  |                         |                            |
  |--- SYN (seq=C) -------->|                            |
  |                         |-- compute cookie --------->|
  |<-- SYN-ACK (seq=cookie, ack=C+1) ---|                |
  |                         |                            |
  |--- ACK (ack=cookie+1) ->|                            |
  |                         |-- verify cookie ---------->|
  |                         |-- XDP_PASS (reinject SYN)->|
  |                         |                            |--- real handshake ---
```

1. Client sends SYN (`S → D`, seq=`C`)
2. OpenShield computes `cookie = SplitMix64(secret ^ timestamp ^ 5-tuple)`
3. Rewrites packet: swaps MAC/IP, sets flags `SYN|ACK`, seq=`cookie_hi32`, ack_seq=`C+1`, window=65535, recomputes TCP checksum
4. Sends `XDP_TX` back to client
5. Stores `{cookie, client_seq, expires_at}` in `syn_cookie_map` (LRU_HASH, 100K entries)
6. Client ACKs (`ack_seq = cookie_hi32 + 1`)
7. Extracts `cookie_hi32 = ack_seq - 1`, checks expiry, recomputes expected cookie
8. Match → `XDP_PASS` (kernel completes real handshake with original SYN parameters)
9. Mismatch → `XDP_DROP`

## Cookie structure

```
cookie = SplitMix64(secret ^ timestamp_sec ^ saddr ^ daddr ^ sport ^ dport)
cookie_hi32 = timestamp_sec   ← expiry detectable without map lookup
cookie_lo32 = hash & 0xFFFFFFFF
```

SplitMix64 is constant-time and branchless: 3 XOR + 3 multiply/shift (~30 BPF instructions).

## Configuration

```yaml
dynamic:
  synproxy_enabled: false          # Master switch
  synproxy_secret: ""              # Hex string or empty (auto-derived at load)
  synproxy_timeout_sec: 10         # Cookie validity (seconds)
```

## Limitations

| Limitation | Detail |
|-----------|--------|
| IPv4 only | IPv6 header layout differs; not yet supported |
| TCP options | MSS, window scaling, SACK not reflected in SYN-ACK. Kernel re-sends original SYN with all options after cookie passes |
| Not stateful | Each cookie is independent. No connection rate limiting within SYNPROXY itself |
| Secret rotation | Userspace generates a new secret at load time. Stale cookies are invalidated |

## Common problems

### "SYNPROXY enabled but SYN floods still hitting the server"

Check that `xdp_mode` is `native` (not `generic`). Generic/SKB mode may not support `XDP_TX`.

### "Legitimate connections failing after enabling SYNPROXY"

Increase `synproxy_timeout_sec` if clients are on high-latency links. Check that your kernel version supports `XDP_TX` rewriting (≥ 5.15 recommended).

## Related pages

[Detection Engine Overview](/openshield-xdp/detection-engine/overview) · [Mitigation Overview](/openshield-xdp/mitigation/overview)
