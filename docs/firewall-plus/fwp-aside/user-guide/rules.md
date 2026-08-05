---
title: Rule Types
description: All 13 Firewall-Plus iptables rule types — what each one does, when to use it, and how scopes work.
---

# Rule Types

Firewall-Plus supports **13 rule types**. Each rule is scoped either **per-port** (rendered into a `FWP-{serverId}-{port}` chain jumped to from INPUT with `--dport`) or **globally** for the server (`FWP-{serverId}` chain, multiport across allocations). All rules are comment-tagged for idempotency and applied atomically.

Admin-set limits (max rules per server, max rates) are enforced on save by the panel's LimitChecker.

---

## Rate & Volume Limits

### `syn_limit`
Limits the rate of inbound TCP SYN packets (new connection attempts). The primary defense against SYN floods; uses hashlimit-style matching per scope.

### `tcp_limit`
General TCP packet rate limit for the scope — caps total TCP packets/sec regardless of flags.

### `udp_limit`
UDP packet rate limit. The bread-and-butter rule for game servers, since most game traffic (and most L4 floods against them) is UDP.

### `connection_limit`
Caps the number of **concurrent connections** (per source or per scope, depending on configuration). Stops connection-exhaustion attacks that stay under packet-rate thresholds.

### `global_packet_limit`
A single packet/sec ceiling across the whole server, independent of protocol. Use as a coarse backstop behind the more specific limits.

### `new_connection_rate`
Limits how fast **new** connections may be established (state NEW), distinct from total packet rate. Slows down botnet connect floods and rapid reconnect abuse.

### `burst_protection`
An **alias** that maps onto the SYN limit engine with burst-oriented parameters — absorbs short legitimate bursts (map downloads, lobby joins) while still capping sustained SYN rates. Configuring it writes a syn-limit-style rule.

## Packet Hygiene

### `fragmented_drop`
Drops fragmented packets. Legitimate game traffic virtually never fragments; floods use fragments to bypass per-packet inspection and chew reassembly CPU. Safe and recommended for most game servers.

### `ttl_filter`
Filters packets by TTL value — drops packets whose TTL is implausibly low/high for real clients. Catches some spoofed and amplified traffic patterns.

### `packet_size_filter`
Drops packets outside a configured size range (min/max bytes). Game protocols have well-known packet sizes; floods are often tiny (or jumbo). Size filtering is cheap and surprisingly effective.

### `stateful_tracking`
Enables conntrack-based stateful matching: established/related traffic is accepted fast-path, and invalid-state packets are dropped. The foundation rule — enable it first, then layer limits on top.

## Advanced

### `geo_filter`
Filters traffic by source country using a MaxMind GeoLite2 database on the node.

::: warning Requires a GeoIP database
The node must have `geoipDbPath` set in `/etc/firewall-plus/config.json` pointing at a valid `.mmdb` you downloaded yourself (GeoLite2 is licensed and not redistributed). Enabling `geo_filter` without a DB is **rejected** — it fails loudly rather than silently passing traffic. Admin → Nodes shows GeoIP availability from the last health check, and the client Geo IP tab only appears when the node reports it available.
:::

### `connection_timeout`
**Legacy no-op.** Still accepted by the API so old database rows don't error, but the node intentionally emits **no iptables rules** for it and the panel UI no longer offers it. Existing rows are harmless; delete them at your convenience.

---

## Scopes: per-port vs global

| Scope | Chain | Matches |
|-------|-------|---------|
| Per-port | `FWP-{serverId}-{port}` | One allocation port, `--dport` jump from INPUT (tcp + udp) |
| Global | `FWP-{serverId}` | All of the server's allocations (multiport, with `-p`) |

Prefer **per-port** rules when a server has several allocations and only one faces the public (e.g. a game port vs. a query port). Use **global** rules for server-wide hygiene like `stateful_tracking` and `fragmented_drop`.

## Presets

The **Presets** tab ships system game presets (curated rule sets per game) and lets users save their own. Applying a preset creates its rules in one shot; nothing is pushed to the node until you click **Apply firewall**. Admins manage the system catalog from **Admin → Firewall → Presets**.

## Verify rendered rules (node, root)

```bash
iptables -L FWP-<serverId> -n -v
iptables -L FWP-<serverId>-<port> -n -v
ipset list fwp-wl-<serverId>
```

Duplicate rules are skipped automatically (comment-tagged idempotency), so re-applying is always safe.
