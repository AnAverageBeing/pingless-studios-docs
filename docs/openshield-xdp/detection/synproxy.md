# SYNPROXY

Cookie-based SYN flood mitigation at XDP.

## How It Works

1. Client sends SYN → OpenShield computes SplitMix64 cookie from 5-tuple + secret + timestamp
2. Rewrites to SYN-ACK → XDP_TX back to client
3. Stores cookie in `syn_cookie_map` (LRU_HASH, 100K entries)
4. Client ACK returns → extract cookie from `ack_seq - 1` → verify → XDP_PASS
5. Invalid → XDP_DROP

## Cookie Generation

```
cookie = SplitMix64(secret ^ timestamp ^ saddr ^ daddr ^ sport ^ dport)
cookie_hi32 = timestamp (expiry checkable without map lookup)
cookie_lo32 = hash & 0xFFFFFFFF
```

## Configuration

```yaml
dynamic:
  synproxy_enabled: false    # Off by default
  synproxy_secret: ""        # Auto-derived if empty
  synproxy_timeout_sec: 10   # Cookie TTL
```

## Limitations

- IPv4 only
- TCP options not reflected in SYN-ACK (kernel re-sends with originals)
- Enable after testing against your traffic profile

